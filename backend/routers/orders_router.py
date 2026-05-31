"""Orders + escrow + delivery confirmation."""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db import get_db
from models import OrderCreateRequest, ConfirmDeliveryRequest
from auth import get_current_user_dep, require_role, generate_otp
from notifications import create_notification

logger = logging.getLogger(__name__)
router = APIRouter(tags=["orders"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _timeline_event(status: str, label: str) -> dict:
    return {"status": status, "label": label, "timestamp": _now()}


import random


def _gen_code() -> str:
    return f"{random.randint(0, 999999):06d}"


@router.post("/orders", status_code=201)
async def create_order(req: OrderCreateRequest, user: dict = Depends(require_role("buyer"))):
    """Create an order from the cart. Carts spanning multiple sellers are split into
    one sub-order per seller, grouped under a single order_group_id. A single Mobile
    Money payment covers the whole group; funds are split into per-seller escrows.
    """
    db = get_db()
    if not req.items:
        raise HTTPException(status_code=400, detail="Panier vide")
    if req.delivery_mode not in ("delivery", "collect"):
        raise HTTPException(status_code=400, detail="Mode de livraison invalide")

    # Fetch all products
    product_ids = [it.product_id for it in req.items]
    products = {p["id"]: p async for p in db.products.find({"id": {"$in": product_ids}}, {"_id": 0})}
    if len(products) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Produit introuvable dans le panier")

    # Group requested items by seller
    items_by_seller: dict[str, list] = {}
    for it in req.items:
        p = products[it.product_id]
        if p["stock"] < it.quantity:
            raise HTTPException(status_code=400, detail=f"Stock insuffisant pour {p['name']}")
        items_by_seller.setdefault(p["seller_id"], []).append((it, p))

    seller_ids = list(items_by_seller.keys())
    sellers = {s["id"]: s async for s in db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0})}
    missing = [sid for sid in seller_ids if sid not in sellers]
    if missing:
        raise HTTPException(status_code=404, detail="Vendeur introuvable")

    group_id = str(uuid.uuid4())
    now = _now()
    created_orders = []
    grand_total = 0.0
    currency = user["currency"]

    # Build one sub-order per seller
    for seller_id, entries in items_by_seller.items():
        seller = sellers[seller_id]
        items_full = []
        sub_total = 0.0
        for it, p in entries:
            subtotal = p["price"] * it.quantity
            sub_total += subtotal
            currency = p["currency"]
            items_full.append({
                "product_id": p["id"],
                "name": p["name"],
                "price": p["price"],
                "quantity": it.quantity,
                "photo": p["photos"][0] if p.get("photos") else None,
                "subtotal": subtotal,
            })

        commission_rate = seller.get("commission_rate", 0.07)
        commission_amount = round(sub_total * commission_rate, 2)
        qr_token = str(uuid.uuid4()) if req.delivery_mode == "collect" else None
        grand_total += sub_total

        order = {
            "id": str(uuid.uuid4()),
            "order_group_id": group_id,
            "buyer_id": user["id"],
            "seller_id": seller_id,
            "seller_name": seller.get("shop_name"),
            "items": items_full,
            "total_amount": sub_total,
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
            "confirmation_code": _gen_code(),
            "qr_code": qr_token,
            "country_code": user["country_code"],
            "created_at": now,
            "timeline": [_timeline_event("confirmed", "Commande confirmée")],
        }
        await db.orders.insert_one(order)
        order.pop("_id", None)
        created_orders.append(order)

        # Decrement stock for this seller's items
        for it, _p in entries:
            await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.quantity}})

        # Per-seller escrow transaction
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "order_id": order["id"],
            "order_group_id": group_id,
            "amount": sub_total,
            "currency": currency,
            "payment_method": req.payment_method,
            "payment_status": "captured_in_escrow",
            "escrow_released_at": None,
            "created_at": now,
        })

        # Notify seller of the new order
        try:
            await create_notification(
                seller["user_id"],
                "order_received",
                "Nouvelle commande",
                f"Vous avez reçu une commande de {sub_total:.0f} {currency}.",
                {"order_id": order["id"], "order_group_id": group_id},
            )
        except Exception as e:
            logger.warning(f"notify seller failed: {e}")

    # Record the payment group (single Mobile Money charge for the whole cart)
    await db.order_groups.insert_one({
        "id": group_id,
        "buyer_id": user["id"],
        "order_ids": [o["id"] for o in created_orders],
        "seller_count": len(created_orders),
        "grand_total": grand_total,
        "currency": currency,
        "payment_method": req.payment_method,
        "country_code": user["country_code"],
        "created_at": now,
    })

    # Trigger fraud evaluation for the buyer (non-blocking best-effort)
    try:
        from fraud import evaluate_and_log
        await evaluate_and_log(user["id"])
    except Exception as e:
        logger.warning(f"fraud eval failed: {e}")

    return {
        "order_group_id": group_id,
        "seller_count": len(created_orders),
        "grand_total": grand_total,
        "currency": currency,
        "orders": created_orders,
    }


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


@router.get("/order-groups/{group_id}")
async def get_order_group(group_id: str, user: dict = Depends(get_current_user_dep)):
    """Buyer recap view: all sub-orders of a multi-seller cart, grouped by seller."""
    db = get_db()
    group = await db.order_groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Groupe de commandes introuvable")
    if user["role"] == "buyer" and group["buyer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    orders = await db.orders.find({"order_group_id": group_id}, {"_id": 0}).to_list(50)
    for o in orders:
        o.pop("confirmation_code", None)
    group["orders"] = orders
    return group
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


class ScanQrRequest(BaseModel):
    qr_token: str


@router.post("/orders/{order_id}/scan-qr")
async def scan_qr(order_id: str, req: ScanQrRequest, user: dict = Depends(require_role("seller"))):
    """Seller scans buyer's QR code -> escrow released for Click & Collect."""
    db = get_db()
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not my_seller or my_seller["id"] != o["seller_id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if o["delivery_mode"] != "collect":
        raise HTTPException(status_code=400, detail="Cette commande n'est pas en Click & Collect")
    if o["escrow_status"] != "held":
        raise HTTPException(status_code=400, detail="Escrow déjà libéré")
    if o.get("qr_code") != req.qr_token.strip():
        raise HTTPException(status_code=400, detail="QR code invalide")

    event = _timeline_event("collected", "Retiré et paiement libéré")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "collected", "escrow_status": "released"}, "$push": {"timeline": event}},
    )
    await db.transactions.update_one(
        {"order_id": order_id},
        {"$set": {"payment_status": "released", "escrow_released_at": _now()}},
    )
    return {"ok": True, "status": "collected", "escrow_status": "released"}


@router.get("/orders/by-qr/{qr_token}")
async def get_order_by_qr(qr_token: str, user: dict = Depends(require_role("seller"))):
    """Lookup order by QR token (seller-side scanner uses this)."""
    db = get_db()
    o = await db.orders.find_one({"qr_code": qr_token}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="QR introuvable")
    my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not my_seller or my_seller["id"] != o["seller_id"]:
        raise HTTPException(status_code=403, detail="Cette commande n'appartient pas à votre boutique")
    return o
