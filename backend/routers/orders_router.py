"""Orders + escrow + delivery confirmation."""
import uuid
import logging
import hashlib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from db import get_db
from financial_transactions import atomic_operation
from money import money_product, commission, minor_units, record_release
from stock import aggregate_items, reserve_stock, release_stock
from models import OrderCreateRequest, ConfirmDeliveryRequest
from auth import get_current_user_dep, require_role, generate_otp
from notifications import create_notification

logger = logging.getLogger(__name__)
router = APIRouter(tags=["orders"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _timeline_event(status: str, label: str) -> dict:
    return {"status": status, "label": label, "timestamp": _now()}


def _gen_code() -> str:
    return generate_otp()


SELF_DELIVERY_FEE_TIERS = {7500, 10000, 15000, 20000}
AFRIMARKET_DELIVERY_FEE = 16_000.0


def _resolve_item_mode(requested_mode: str, product_modes: list) -> str:
    """Determine the effective delivery mode for one cart item, given the buyer's
    requested mode and what the product actually supports. Falls back to the
    product's only supported mode when the request isn't available for it."""
    modes = product_modes or ["delivery", "collect"]
    if requested_mode in modes:
        return requested_mode
    # Buyer asked for a mode this product doesn't support — use what's available.
    return modes[0]


@router.post("/orders", status_code=201)
@atomic_operation
async def create_order(req: OrderCreateRequest, user: dict = Depends(require_role("buyer")), idempotency_key: str | None = Header(default=None, max_length=128)):
    """Create an order from the cart. Carts spanning multiple sellers are split into
    one sub-order per seller, grouped under a single order_group_id. Within a single
    seller, items are further split by delivery mode (delivery vs collect) when the
    seller's products don't all support the same mode — e.g. one product is
    delivery-only and another is pickup-only, producing two separate sub-orders for
    that seller. A single Mobile Money payment covers the whole group; funds are
    split into per-order escrows.
    """
    db = get_db()
    if not isinstance(idempotency_key, str) or not 8 <= len(idempotency_key) <= 128:
        raise HTTPException(422, detail="Idempotency-Key requis (8 à 128 caractères)")
    request_id = user["id"] + ":" + idempotency_key
    request_hash = hashlib.sha256(json.dumps(req.model_dump(), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    previous = await db.checkout_requests.find_one({"_id": request_id})
    if previous:
        if previous["request_hash"] != request_hash:
            raise HTTPException(409, detail="Clé d'idempotence réutilisée pour un panier différent")
        return previous["response"]
    if not req.items:
        raise HTTPException(status_code=400, detail="Panier vide")
    if req.delivery_mode not in ("delivery", "collect"):
        raise HTTPException(status_code=400, detail="Mode de livraison invalide")

    req = req.model_copy(update={"items": aggregate_items(req.items)})

    # Fetch all products
    product_ids = [it.product_id for it in req.items]
    products = {p["id"]: p async for p in db.products.find({"id": {"$in": product_ids}}, {"_id": 0})}
    if len(products) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Produit introuvable dans le panier")

    if len({p["currency"] for p in products.values()}) != 1:
        raise HTTPException(422, detail="Les paniers multi-devises nécessitent une conversion validée")

    # Group requested items by (seller_id, effective_delivery_mode).
    # A seller with mixed delivery/collect-only products yields two groups → two sub-orders.
    items_by_group: dict[tuple, list] = {}
    for it in req.items:
        p = products[it.product_id]
        if p.get("is_active") is False:
            raise HTTPException(status_code=400, detail="Produit indisponible")
        if p["stock"] < it.quantity:
            raise HTTPException(status_code=400, detail=f"Stock insuffisant pour {p['name']}")
        effective_mode = _resolve_item_mode(req.delivery_mode, p.get("delivery_modes"))
        key = (p["seller_id"], effective_mode)
        items_by_group.setdefault(key, []).append((it, p))

    seller_ids = list({sid for sid, _mode in items_by_group.keys()})
    sellers = {s["id"]: s async for s in db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0})}
    missing = [sid for sid in seller_ids if sid not in sellers]
    if missing:
        raise HTTPException(status_code=404, detail="Vendeur introuvable")

    group_id = str(uuid.uuid4())
    reservations = await reserve_stock(db, req.items)
    try:
        now = _now()
        created_orders = []
        grand_total = 0.0
        currency = user["currency"]

        # Build one sub-order per (seller, effective delivery mode)
        for (seller_id, item_mode), entries in items_by_group.items():
            seller = sellers[seller_id]
            items_full = []
            sub_total = 0.0
            for it, p in entries:
                subtotal = money_product(p["price"], it.quantity)
                sub_total = (minor_units(sub_total) + minor_units(subtotal)) / 100
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
            commission_amount = commission(sub_total, commission_rate)

            # Frais de livraison: definis par le vendeur (palier self_delivery_fee)
            # si livraison propre, ou fixes 16 000 FC si reseau AfriMarket. Aucun frais
            # pour le retrait en boutique.
            seller_delivery = seller.get("delivery_service", "self")
            if item_mode == "delivery" and seller_delivery == "afrimarket":
                delivery_fee = AFRIMARKET_DELIVERY_FEE
            elif item_mode == "delivery" and seller_delivery == "self":
                tier = seller.get("self_delivery_fee", 7500)
                delivery_fee = float(tier if tier in SELF_DELIVERY_FEE_TIERS else 7500)
            else:
                delivery_fee = 0.0
            amount_due = sub_total + delivery_fee
            qr_token = str(uuid.uuid4()) if item_mode == "collect" else None
            grand_total = (minor_units(grand_total) + minor_units(amount_due)) / 100

            order = {
                "id": str(uuid.uuid4()),
                "order_group_id": group_id,
                "buyer_id": user["id"],
                "seller_id": seller_id,
                "seller_name": seller.get("shop_name"),
                "items": items_full,
                "total_amount": sub_total,
                "commission_amount": commission_amount,
                "delivery_fee": delivery_fee,
                "amount_due": amount_due,
                "currency": currency,
                "delivery_mode": item_mode,
                "delivery_address": req.delivery_address if item_mode == "delivery" else None,
                "delivery_neighborhood": req.delivery_neighborhood if item_mode == "delivery" else None,
                "delivery_landmark": req.delivery_landmark if item_mode == "delivery" else None,
                "pickup_slot": req.pickup_slot if item_mode == "collect" else None,
                "payment_method": req.payment_method,
                "checkout_currency": req.checkout_currency or "FC",
                "status": "confirmed",
                "escrow_status": "held" if req.payment_method == "cash" else "awaiting_payment",
                "payment_confirmed": False,
                "confirmation_code": _gen_code(),
                "qr_code": qr_token,
                "country_code": user["country_code"],
                "created_at": now,
                "timeline": [_timeline_event("confirmed", "Commande confirmée")],
            }
            await db.orders.insert_one(order)
            order.pop("_id", None)
            created_orders.append(order)

            # Per-order escrow transaction
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()),
                "order_id": order["id"],
                "order_group_id": group_id,
                "amount": amount_due,
                "currency": currency,
                "payment_method": req.payment_method,
                "payment_status": "cash_pending" if req.payment_method == "cash" else "pending",
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
            "payment_status": "cash_pending" if req.payment_method == "cash" else "unpaid",
            "country_code": user["country_code"],
            "created_at": now,
        })

    except Exception:
        try:
            await db.orders.delete_many({"order_group_id": group_id})
            await db.transactions.delete_many({"order_group_id": group_id})
            await db.order_groups.delete_one({"id": group_id})
            await release_stock(db, reservations)
        except Exception:
            logger.exception("Order compensation failed for group %s", group_id)
        raise

    # Schedule evaluation after commit; transaction retries must not send alerts.
    await db.fraud_outbox.insert_one({"id": group_id, "user_id": user["id"], "status": "pending"})

    response = {
        "order_group_id": group_id,
        "seller_count": len(created_orders),
        "grand_total": grand_total,
        "currency": currency,
        "orders": created_orders,
    }
    await db.checkout_requests.insert_one({"_id": request_id, "request_hash": request_hash, "response": response})
    return response


@router.get("/orders/my")
async def my_orders(user: dict = Depends(get_current_user_dep)):
    """Order history. For buyers: their own orders, enriched with seller +
    deliverer info and whether they can still review the seller. For
    sellers: orders received, enriched with buyer info and whether they
    can still rate that buyer."""
    db = get_db()
    q = {"buyer_id": user["id"]} if user["role"] == "buyer" else {"seller_id": (await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1}) or {}).get("id")}
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)

    seller_ids = list({o["seller_id"] for o in orders})
    sellers = {s["id"]: s async for s in db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0})}

    buyer_ids = list({o["buyer_id"] for o in orders})
    buyers = {b["id"]: b async for b in db.users.find({"id": {"$in": buyer_ids}}, {"_id": 0, "id": 1, "name": 1})}

    deliverer_ids = list({o["deliverer_id"] for o in orders if o.get("deliverer_id")})
    deliverers = {d["id"]: d async for d in db.users.find({"id": {"$in": deliverer_ids}}, {"_id": 0, "id": 1, "name": 1})} if deliverer_ids else {}

    order_ids = [o["id"] for o in orders]
    DELIVERED_STATUSES = ("delivered", "collected")

    if user["role"] == "buyer":
        reviewed = {
            r["order_id"]
            async for r in db.reviews.find({"order_id": {"$in": order_ids}, "buyer_id": user["id"]}, {"_id": 0, "order_id": 1})
        } if order_ids else set()
    else:
        reviewed = {
            r["order_id"]
            async for r in db.buyer_reviews.find({"order_id": {"$in": order_ids}, "rater_user_id": user["id"]}, {"_id": 0, "order_id": 1})
        } if order_ids else set()

    for o in orders:
        if user["role"] != "buyer":
            o.pop("confirmation_code", None)
            o.pop("qr_code", None)
        s = sellers.get(o["seller_id"])
        if s:
            o["seller_name"] = s.get("shop_name")
        b = buyers.get(o["buyer_id"])
        if b:
            o["buyer_name"] = b.get("name")
        if o.get("deliverer_id"):
            d = deliverers.get(o["deliverer_id"])
            if d:
                o["deliverer_name"] = d.get("name")
        is_delivered = o["status"] in DELIVERED_STATUSES
        if user["role"] == "buyer":
            o["can_review_seller"] = is_delivered and o["id"] not in reviewed
        else:
            o["can_review_buyer"] = is_delivered and o["id"] not in reviewed
    return orders


@router.get("/order-groups/{group_id}")
async def get_order_group(group_id: str, user: dict = Depends(get_current_user_dep)):
    """Buyer recap view: all sub-orders of a multi-seller cart, grouped by seller."""
    db = get_db()
    group = await db.order_groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Groupe de commandes introuvable")
    if user["role"] != "admin" and (user["role"] != "buyer" or group["buyer_id"] != user["id"]):
        raise HTTPException(status_code=403, detail="Accès refusé")
    orders = await db.orders.find({"order_group_id": group_id}, {"_id": 0}).to_list(50)
    for o in orders:
        o.pop("confirmation_code", None)
    group["orders"] = orders
    return group


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
    if user["role"] == "deliverer" and o.get("deliverer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if user["role"] not in {"buyer", "seller", "deliverer", "admin"}:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if user["role"] not in {"buyer", "admin"}:
        o.pop("confirmation_code", None)
        o.pop("qr_code", None)
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

    if o.get("payment_method") != "cash" and not o.get("payment_confirmed"):
        raise HTTPException(409, detail="Paiement non confirmé")

    transitions = {
        "confirmed": ("preparing", "Vendeur prépare la commande"),
        "preparing": (
            ("out_for_delivery", "En cours de livraison") if o["delivery_mode"] == "delivery"
            else ("ready_for_pickup", "Prêt pour retrait")
        ),
    }
    # If a deliverer is assigned, the seller stops after "preparing":
    # the deliverer drives the pickup -> en-route -> delivered transitions.
    if o["delivery_mode"] == "delivery" and o.get("deliverer_id") and o["status"] == "preparing":
        raise HTTPException(status_code=400, detail="Un livreur est assigné : il gère la suite de la livraison")
    next_state = transitions.get(o["status"])
    if not next_state:
        raise HTTPException(status_code=400, detail="Transition impossible")
    new_status, label = next_state
    event = _timeline_event(new_status, label)
    result = await db.orders.update_one(
        {"id": order_id, "status": o["status"]},
        {"$set": {"status": new_status}, "$push": {"timeline": event}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Commande déjà modifiée")
    o["status"] = new_status
    o["timeline"].append(event)
    o.pop("confirmation_code", None)
    o.pop("qr_code", None)
    return o


@router.post("/orders/{order_id}/confirm-delivery")
@atomic_operation
async def confirm_delivery(order_id: str, req: ConfirmDeliveryRequest, user: dict = Depends(get_current_user_dep)):
    """Buyer/livreur enters 6-digit code -> escrow released."""
    db = get_db()
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if o["delivery_mode"] != "delivery":
        raise HTTPException(status_code=400, detail="Mode incorrect")
    if not (user["id"] == o["buyer_id"] or
            (user.get("role") == "deliverer" and user["id"] == o.get("deliverer_id"))):
        raise HTTPException(status_code=403, detail="Accès refusé")
    if o["status"] != "out_for_delivery":
        raise HTTPException(status_code=409, detail="Commande non disponible pour livraison")
    if o.get("payment_method") != "cash" and not o.get("payment_confirmed"):
        raise HTTPException(status_code=409, detail="Paiement non confirmé")
    if o["escrow_status"] != "held":
        raise HTTPException(status_code=400, detail="Escrow déjà libéré")
    if o["confirmation_code"] != req.code.strip():
        raise HTTPException(status_code=400, detail="Code incorrect")

    event = _timeline_event("delivered", "Livré et paiement libéré")
    result = await db.orders.update_one(
        {"id": order_id, "status": o["status"], "escrow_status": "held"},
        {"$set": {"status": "delivered", "escrow_status": "released"}, "$push": {"timeline": event}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Commande déjà modifiée")
    await db.transactions.update_one(
        {"order_id": order_id},
        {"$set": {"payment_status": "released", "escrow_released_at": _now()}},
    )
    await record_release(db, o)
    return {"ok": True, "status": "delivered", "escrow_status": "released"}


class ScanQrRequest(BaseModel):
    qr_token: str


@router.post("/orders/{order_id}/confirm-collect")
@atomic_operation
async def confirm_collect(order_id: str, user: dict = Depends(require_role("seller"))):
    """Seller confirms cash handoff for Click & Collect — no QR needed for cash payment."""
    db = get_db()
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not my_seller or my_seller["id"] != o["seller_id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if o["delivery_mode"] != "collect":
        raise HTTPException(status_code=400, detail="Cette commande n'est pas en retrait boutique")
    if o.get("payment_method") != "cash":
        raise HTTPException(status_code=409, detail="La remise cash exige une commande cash")
    if o.get("escrow_status") != "held":
        raise HTTPException(status_code=409, detail="Paiement non disponible pour remise")
    if o["status"] == "collected":
        raise HTTPException(status_code=400, detail="Commande déjà marquée comme retirée")
    allowed = {"ready_for_pickup", "confirmed", "preparing"}
    if o["status"] not in allowed:
        raise HTTPException(status_code=400, detail="Statut incompatible avec une confirmation de retrait")

    now = datetime.now(timezone.utc).isoformat()
    event = {"status": "collected", "timestamp": now, "actor": "seller",
             "note": "Remise en main propre confirmée par le vendeur (paiement cash)"}

    result = await db.orders.update_one(
        {"id": order_id, "status": o["status"], "escrow_status": "held"},
        {"$set": {
            "status": "collected",
            "escrow_status": "released",
            "collected_at": now,
        },
         "$push": {"timeline": event}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Commande déjà modifiée")
    await db.transactions.update_many(
        {"order_id": order_id},
        {"$set": {"payment_status": "released", "released_at": now}},
    )
    await create_notification(
        o["buyer_id"], "order",
        "Retrait confirmé",
        f"Votre commande #{order_id[:8].upper()} a été remise. Merci pour votre achat !",
        {"order_id": order_id},
    )
    await record_release(db, o)
    return {"ok": True, "status": "collected", "order_id": order_id}


@router.post("/orders/{order_id}/scan-qr")
@atomic_operation
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
    if o["status"] != "ready_for_pickup":
        raise HTTPException(status_code=409, detail="Commande non disponible pour retrait")
    if o.get("payment_method") != "cash" and not o.get("payment_confirmed"):
        raise HTTPException(status_code=409, detail="Paiement non confirmé")
    if o["escrow_status"] != "held":
        raise HTTPException(status_code=400, detail="Escrow déjà libéré")
    if o.get("qr_code") != req.qr_token.strip():
        raise HTTPException(status_code=400, detail="QR code invalide")

    event = _timeline_event("collected", "Retiré et paiement libéré")
    result = await db.orders.update_one(
        {"id": order_id, "status": o["status"], "escrow_status": "held"},
        {"$set": {"status": "collected", "escrow_status": "released"}, "$push": {"timeline": event}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Commande déjà modifiée")
    await db.transactions.update_one(
        {"order_id": order_id},
        {"$set": {"payment_status": "released", "escrow_released_at": _now()}},
    )
    await record_release(db, o)
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
    o.pop("confirmation_code", None)
    o.pop("qr_code", None)
    return o
