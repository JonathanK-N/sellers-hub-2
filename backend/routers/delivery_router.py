"""Delivery partner (livreur) endpoints + seller assignment + admin management."""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db import get_db
from auth import require_role, get_current_user_dep
from notifications import create_notification

logger = logging.getLogger(__name__)
router = APIRouter(tags=["delivery"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _timeline_event(status: str, label: str) -> dict:
    return {"status": status, "label": label, "timestamp": _now()}


class AssignRequest(BaseModel):
    deliverer_id: str


class ConfirmCodeRequest(BaseModel):
    code: str


# ---------- Seller: assign a deliverer ----------
@router.get("/deliverers/available")
async def available_deliverers(user: dict = Depends(require_role("seller"))):
    """List active deliverers in the seller's country for assignment."""
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    country = seller.get("country_code") if seller else user["country_code"]
    rows = []
    async for u in db.users.find(
        {"role": "deliverer", "country_code": country, "suspended": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "phone": 1},
    ):
        prof = await db.deliverers.find_one({"user_id": u["id"]}, {"_id": 0}) or {}
        if prof.get("is_active", True):
            u["vehicle"] = prof.get("vehicle", "moto")
            u["active_deliveries"] = await db.orders.count_documents(
                {"deliverer_id": u["id"], "status": {"$in": ["assigned", "picked_up", "out_for_delivery"]}}
            )
            rows.append(u)
    return rows


@router.post("/orders/{order_id}/assign")
async def assign_deliverer(order_id: str, req: AssignRequest, user: dict = Depends(require_role("seller"))):
    """Seller assigns a deliverer to a confirmed home-delivery order."""
    db = get_db()
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not my_seller or my_seller["id"] != o["seller_id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if o["delivery_mode"] != "delivery":
        raise HTTPException(status_code=400, detail="Seules les commandes en livraison peuvent être assignées")
    if o["status"] not in ("confirmed", "preparing"):
        raise HTTPException(status_code=400, detail="Commande trop avancée pour assigner un livreur")

    deliverer = await db.users.find_one({"id": req.deliverer_id, "role": "deliverer"}, {"_id": 0})
    if not deliverer:
        raise HTTPException(status_code=404, detail="Livreur introuvable")

    event = _timeline_event("assigned", f"Livreur assigné : {deliverer['name']}")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"deliverer_id": req.deliverer_id, "deliverer_name": deliverer["name"], "status": "assigned"},
         "$push": {"timeline": event}},
    )
    try:
        await create_notification(
            req.deliverer_id, "order_received", "Nouvelle livraison",
            f"Une livraison vous a été assignée à {o.get('delivery_neighborhood') or 'votre zone'}.",
            {"order_id": order_id},
        )
    except Exception as e:
        logger.warning(f"notify deliverer failed: {e}")
    return {"ok": True, "deliverer_id": req.deliverer_id, "status": "assigned"}


# ---------- Deliverer: profile + deliveries ----------
@router.get("/deliverer/me")
async def deliverer_me(user: dict = Depends(require_role("deliverer"))):
    db = get_db()
    prof = await db.deliverers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not prof:
        prof = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "vehicle": "moto",
            "is_active": True,
            "country_code": user["country_code"],
            "created_at": _now(),
        }
        await db.deliverers.insert_one(prof)
        prof.pop("_id", None)
    return prof


@router.get("/deliverer/deliveries")
async def my_deliveries(user: dict = Depends(require_role("deliverer"))):
    """Deliveries assigned to the current deliverer."""
    db = get_db()
    orders = await db.orders.find(
        {"deliverer_id": user["id"]}, {"_id": 0, "confirmation_code": 0}
    ).sort("created_at", -1).to_list(200)
    seller_ids = list({o["seller_id"] for o in orders})
    sellers = {s["id"]: s async for s in db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0})}
    for o in orders:
        s = sellers.get(o["seller_id"]) or {}
        o["seller_name"] = s.get("shop_name")
        o["pickup_neighborhood"] = s.get("neighborhood")
        o["pickup_address"] = s.get("address")
    return orders


@router.get("/deliverer/earnings")
async def deliverer_earnings(user: dict = Depends(require_role("deliverer"))):
    """Today's completed deliveries + simple earnings estimate."""
    db = get_db()
    today = datetime.now(timezone.utc).date().isoformat()
    completed_today = 0
    total_today = 0
    completed_all = await db.orders.count_documents({"deliverer_id": user["id"], "status": "delivered"})
    async for o in db.orders.find({"deliverer_id": user["id"], "status": "delivered"}, {"_id": 0, "delivered_at": 1}):
        if (o.get("delivered_at") or "").startswith(today):
            completed_today += 1
            total_today += 1000  # flat fee per delivery (sandbox)
    return {
        "completed_today": completed_today,
        "completed_all": completed_all,
        "earnings_today": total_today,
        "currency": user["currency"],
    }


@router.post("/deliverer/orders/{order_id}/picked-up")
async def mark_picked_up(order_id: str, user: dict = Depends(require_role("deliverer"))):
    db = get_db()
    o = await db.orders.find_one({"id": order_id, "deliverer_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Livraison introuvable")
    if o["status"] not in ("assigned", "preparing"):
        raise HTTPException(status_code=400, detail="Statut incorrect")
    event = _timeline_event("picked_up", "Colis récupéré chez le vendeur")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "picked_up"}, "$push": {"timeline": event}})
    return {"ok": True, "status": "picked_up"}


@router.post("/deliverer/orders/{order_id}/en-route")
async def mark_en_route(order_id: str, user: dict = Depends(require_role("deliverer"))):
    db = get_db()
    o = await db.orders.find_one({"id": order_id, "deliverer_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Livraison introuvable")
    if o["status"] != "picked_up":
        raise HTTPException(status_code=400, detail="Récupérez d'abord le colis")
    event = _timeline_event("out_for_delivery", "En cours de livraison")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "out_for_delivery"}, "$push": {"timeline": event}})
    try:
        await create_notification(
            o["buyer_id"], "order_shipped", "Votre commande arrive",
            "Le livreur est en route vers vous.", {"order_id": order_id},
        )
    except Exception:
        pass
    return {"ok": True, "status": "out_for_delivery"}


@router.post("/deliverer/orders/{order_id}/confirm")
async def deliverer_confirm(order_id: str, req: ConfirmCodeRequest, user: dict = Depends(require_role("deliverer"))):
    """Deliverer enters the buyer's 6-digit code -> escrow released."""
    db = get_db()
    o = await db.orders.find_one({"id": order_id, "deliverer_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Livraison introuvable")
    if o["escrow_status"] != "held":
        raise HTTPException(status_code=400, detail="Escrow déjà libéré")
    if o.get("confirmation_code") != req.code.strip():
        raise HTTPException(status_code=400, detail="Code incorrect")

    event = _timeline_event("delivered", "Livré et paiement libéré")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "delivered", "escrow_status": "released", "delivered_at": _now()},
         "$push": {"timeline": event}},
    )
    await db.transactions.update_one(
        {"order_id": order_id},
        {"$set": {"payment_status": "released", "escrow_released_at": _now()}},
    )
    try:
        await create_notification(
            o["buyer_id"], "order_delivered", "Commande livrée",
            "Votre commande a été livrée. Merci !", {"order_id": order_id},
        )
    except Exception:
        pass
    return {"ok": True, "status": "delivered", "escrow_status": "released"}




# ---------- GPS Tracking ----------

class LocationUpdate(BaseModel):
    lat: float
    lng: float


@router.post("/deliverer/orders/{order_id}/location")
async def update_location(order_id: str, loc: LocationUpdate, user: dict = Depends(require_role("deliverer"))):
    """Livreur envoie sa position GPS en temps reel."""
    db = get_db()
    o = await db.orders.find_one({"id": order_id, "deliverer_id": user["id"]}, {"_id": 0, "status": 1})
    if not o:
        raise HTTPException(status_code=404, detail="Livraison introuvable")
    if o["status"] not in ("assigned", "picked_up", "out_for_delivery"):
        raise HTTPException(status_code=400, detail="Livraison non active")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"deliverer_location": {"lat": loc.lat, "lng": loc.lng, "updated_at": _now()}}},
    )
    return {"ok": True}


@router.get("/orders/{order_id}/tracking")
async def get_tracking(order_id: str, user: dict = Depends(get_current_user_dep)):
    """Acheteur/vendeur recupere la position du livreur + statut."""
    db = get_db()
    o = await db.orders.find_one(
        {"id": order_id},
        {"_id": 0, "status": 1, "deliverer_location": 1, "deliverer_name": 1,
         "delivery_neighborhood": 1, "delivery_landmark": 1,
         "buyer_id": 1, "seller_id": 1},
    )
    if not o:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if user["role"] == "buyer" and o["buyer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    if user["role"] == "seller":
        my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        if not my_seller or my_seller["id"] != o.get("seller_id"):
            raise HTTPException(status_code=403, detail="Acces refuse")
    loc = o.get("deliverer_location")
    fresh = False
    if loc:
        try:
            updated = datetime.fromisoformat(loc["updated_at"].replace("Z", "+00:00"))
            fresh = (datetime.now(timezone.utc) - updated).total_seconds() < 30
        except Exception:
            fresh = False
    return {
        "status": o["status"],
        "deliverer_name": o.get("deliverer_name"),
        "deliverer_location": loc,
        "location_fresh": fresh,
        "delivery_neighborhood": o.get("delivery_neighborhood"),
        "delivery_landmark": o.get("delivery_landmark"),
    }

# ---------- Admin: manage deliverers ----------
@router.get("/admin/deliverers")
async def admin_list_deliverers(_: dict = Depends(require_role("admin"))):
    db = get_db()
    rows = []
    async for u in db.users.find({"role": "deliverer"}, {"_id": 0, "otp_code": 0}):
        prof = await db.deliverers.find_one({"user_id": u["id"]}, {"_id": 0}) or {}
        u["vehicle"] = prof.get("vehicle", "moto")
        u["is_active"] = prof.get("is_active", True)
        u["completed_all"] = await db.orders.count_documents({"deliverer_id": u["id"], "status": "delivered"})
        u["active_deliveries"] = await db.orders.count_documents(
            {"deliverer_id": u["id"], "status": {"$in": ["assigned", "picked_up", "out_for_delivery"]}}
        )
        rows.append(u)
    return rows


class DelivererToggleRequest(BaseModel):
    is_active: bool


@router.patch("/admin/deliverers/{user_id}")
async def admin_toggle_deliverer(user_id: str, req: DelivererToggleRequest, _: dict = Depends(require_role("admin"))):
    db = get_db()
    u = await db.users.find_one({"id": user_id, "role": "deliverer"}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Livreur introuvable")
    await db.deliverers.update_one(
        {"user_id": user_id},
        {"$set": {"is_active": req.is_active, "user_id": user_id}},
        upsert=True,
    )
    return {"ok": True, "user_id": user_id, "is_active": req.is_active}
