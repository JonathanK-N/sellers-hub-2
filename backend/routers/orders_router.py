"""Orders + escrow + delivery confirmation."""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from db import get_db
from models import OrderCreateRequest, ConfirmDeliveryRequest
from auth import get_current_user_dep, require_role, generate_otp

logger = logging.getLogger(__name__)
router = APIRouter(tags=["orders"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _timeline_event(status: str, label: str) -> dict:
    return {"status": status, "label": label, "timestamp": _now()}


@router.post("/orders", status_code=201)
async def create_order(req: OrderCreateRequest, user: dict = Depends(require_role("buyer"))):
    db = get_db()
    if not req.items:
        raise HTTPException(status_code=400, detail="Panier vide")
    if req.delivery_mode not in ("delivery", "collect"):
        raise HTTPException(status_code=400, detail="Mode de livraison invalide")

    # Fetch products and group by seller (one order per seller for simplicity, but MVP combines into 1)
    product_ids = [it.product_id for it in req.items]
    products = {p["id"]: p async for p in db.products.find({"id": {"$in": product_ids}}, {"_id": 0})}
    if len(products) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Produit introuvable dans le panier")

    seller_ids = {products[pid]["seller_id"] for pid in product_ids}
    if len(seller_ids) > 1:
        raise HTTPException(status_code=400, detail="Un panier ne peut contenir des produits que d'un seul vendeur en MVP")

    seller_id = next(iter(seller_ids))
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur introuvable")

    items_full = []
    total = 0.0
    currency = user["currency"]
    for it in req.items:
        p = products[it.product_id]
        if p["stock"] < it.quantity:
            raise HTTPException(status_code=400, detail=f"Stock insuffisant pour {p['name']}")
        subtotal = p["price"] * it.quantity
        total += subtotal
        items_full.append({
            "product_id": p["id"],
            "name": p["name"],
            "price": p["price"],
            "quantity": it.quantity,
            "photo": p["photos"][0] if p.get("photos") else None,
            "subtotal": subtotal,
        })
        currency = p["currency"]

    commission_rate = seller.get("commission_rate", 0.07)
    commission_amount = round(total * commission_rate, 2)
    confirmation_code = f"{__import__('random').randint(0, 999999):06d}"
    qr_token = str(uuid.uuid4()) if req.delivery_mode == "collect" else None

    order = {
        "id": str(uuid.uuid4()),
        "buyer_id": user["id"],
        "seller_id": seller_id,
        "items": items_full,
        "total_amount": total,
        "commission_amount": commission_amount,
        "currency": currency,
        "delivery_mode": req.delivery_mode,
        "delivery_address": req.delivery_address,
        "delivery_neighborhood": req.delivery_neighborhood,
        "delivery_landmark": req.delivery_landmark,
        "pickup_slot": req.pickup_slot,
        "payment_method": req.payment_method,
        "status": "confirmed",
        "escrow_status": "held",
        "confirmation_code": confirmation_code,
        "qr_code": qr_token,
        "country_code": user["country_code"],
        "created_at": _now(),
        "timeline": [_timeline_event("confirmed", "Commande confirmée")],
    }
    await db.orders.insert_one(order)

    # Decrement stock
    for it in req.items:
        await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.quantity}})

    # Record simulated transaction
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "order_id": order["id"],
        "amount": total,
        "currency": currency,
        "payment_method": req.payment_method,
        "payment_status": "captured_in_escrow",
        "escrow_released_at": None,
        "created_at": _now(),
    })

    order.pop("_id", None)
    return order


@router.get("/orders/my")
async def my_orders(user: dict = Depends(get_current_user_dep)):
    db = get_db()
    q = {"buyer_id": user["id"]} if user["role"] == "buyer" else {"seller_id": (await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1}) or {}).get("id")}
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Enrich seller
    seller_ids = list({o["seller_id"] for o in orders})
    sellers = {s["id"]: s async for s in db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0})}
    for o in orders:
        s = sellers.get(o["seller_id"])
        if s:
            o["seller_name"] = s.get("shop_name")
    return orders


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    seller = await db.sellers.find_one({"id": o["seller_id"]}, {"_id": 0})
    buyer = await db.users.find_one({"id": o["buyer_id"]}, {"_id": 0})
    if seller:
        o["seller_name"] = seller.get("shop_name")
        o["seller_neighborhood"] = seller.get("neighborhood")
    if buyer:
        o["buyer_name"] = buyer.get("name")
        o["buyer_phone"] = buyer.get("phone")
    # Auth
    if user["role"] == "buyer" and o["buyer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if user["role"] == "seller":
        my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
        if not my_seller or my_seller["id"] != o["seller_id"]:
            raise HTTPException(status_code=403, detail="Accès refusé")
        # Hide confirmation code from seller until delivery
    return o


@router.post("/orders/{order_id}/advance")
async def advance_order(order_id: str, user: dict = Depends(require_role("seller"))):
    """Seller transitions order: confirmed -> preparing -> out_for_delivery."""
    db = get_db()
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not my_seller or my_seller["id"] != o["seller_id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    transitions = {
        "confirmed": ("preparing", "Vendeur prépare la commande"),
        "preparing": (
            ("out_for_delivery", "En cours de livraison") if o["delivery_mode"] == "delivery"
            else ("ready_for_pickup", "Prêt pour retrait")
        ),
    }
    next_state = transitions.get(o["status"])
    if not next_state:
        raise HTTPException(status_code=400, detail="Transition impossible")
    new_status, label = next_state
    event = _timeline_event(new_status, label)
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": new_status}, "$push": {"timeline": event}},
    )
    o["status"] = new_status
    o["timeline"].append(event)
    return o


@router.post("/orders/{order_id}/confirm-delivery")
async def confirm_delivery(order_id: str, req: ConfirmDeliveryRequest, user: dict = Depends(get_current_user_dep)):
    """Buyer/livreur enters 6-digit code -> escrow released."""
    db = get_db()
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if o["delivery_mode"] != "delivery":
        raise HTTPException(status_code=400, detail="Mode incorrect")
    if o["escrow_status"] != "held":
        raise HTTPException(status_code=400, detail="Escrow déjà libéré")
    if o["confirmation_code"] != req.code.strip():
        raise HTTPException(status_code=400, detail="Code incorrect")

    event = _timeline_event("delivered", "Livré et paiement libéré")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "delivered", "escrow_status": "released"}, "$push": {"timeline": event}},
    )
    await db.transactions.update_one(
        {"order_id": order_id},
        {"$set": {"payment_status": "released", "escrow_released_at": _now()}},
    )
    return {"ok": True, "status": "delivered", "escrow_status": "released"}
