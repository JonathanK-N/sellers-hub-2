"""Disputes management."""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db import get_db
from auth import require_role, get_current_user_dep

logger = logging.getLogger(__name__)
router = APIRouter(tags=["disputes"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class DisputeRequest(BaseModel):
    order_id: str
    reason: str
    photo_url: str | None = None


class ResolveRequest(BaseModel):
    decision: str  # refund_buyer | release_seller | partial_refund
    partial_buyer_amount: float | None = None
    note: str = ""


@router.post("/disputes", status_code=201)
async def open_dispute(req: DisputeRequest, user: dict = Depends(require_role("buyer"))):
    db = get_db()
    order = await db.orders.find_one({"id": req.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order["buyer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    # Allow only within 7 days of delivery for resolved orders, OR while still in transit
    if order["status"] in ("delivered", "collected"):
        delivered_event = next((e for e in order.get("timeline", []) if e["status"] in ("delivered", "collected")), None)
        if delivered_event:
            t = datetime.fromisoformat(delivered_event["timestamp"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - t > timedelta(days=7):
                raise HTTPException(status_code=400, detail="Délai de 7 jours dépassé")

    existing = await db.disputes.find_one({"order_id": req.order_id, "status": "open"})
    if existing:
        raise HTTPException(status_code=400, detail="Un litige est déjà ouvert pour cette commande")

    dispute = {
        "id": str(uuid.uuid4()),
        "order_id": req.order_id,
        "buyer_id": user["id"],
        "seller_id": order["seller_id"],
        "country_code": order["country_code"],
        "reason": req.reason.strip(),
        "photo_url": req.photo_url,
        "status": "open",
        "created_at": _now(),
        "admin_decision": None,
        "resolved_at": None,
    }
    await db.disputes.insert_one(dispute)
    # Freeze escrow
    await db.orders.update_one(
        {"id": req.order_id},
        {"$set": {"escrow_status": "frozen"}, "$push": {"timeline": {"status": "dispute_opened", "label": "Litige ouvert", "timestamp": _now()}}},
    )
    dispute.pop("_id", None)
    return dispute


@router.get("/disputes/my")
async def my_disputes(user: dict = Depends(get_current_user_dep)):
    db = get_db()
    if user["role"] == "buyer":
        q = {"buyer_id": user["id"]}
    else:
        seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
        if not seller:
            return []
        q = {"seller_id": seller["id"]}
    items = await db.disputes.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@router.get("/admin/disputes")
async def admin_list(_: dict = Depends(require_role("admin"))):
    db = get_db()
    items = await db.disputes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Enrich + priority
    now = datetime.now(timezone.utc)
    for d in items:
        o = await db.orders.find_one({"id": d["order_id"]}, {"_id": 0})
        d["order"] = o
        # Priority: urgent if > 5 days
        created = datetime.fromisoformat(d["created_at"].replace("Z", "+00:00"))
        age_days = (now - created).total_seconds() / 86400
        d["priority"] = "urgent" if age_days > 5 else ("high" if age_days > 2 else "normal")
    return items


@router.post("/admin/disputes/{dispute_id}/resolve")
async def admin_resolve(dispute_id: str, req: ResolveRequest, _: dict = Depends(require_role("admin"))):
    db = get_db()
    dispute = await db.disputes.find_one({"id": dispute_id}, {"_id": 0})
    if not dispute:
        raise HTTPException(status_code=404, detail="Litige introuvable")
    if dispute["status"] != "open":
        raise HTTPException(status_code=400, detail="Litige déjà résolu")

    order = await db.orders.find_one({"id": dispute["order_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    if req.decision == "refund_buyer":
        new_escrow = "refunded"
        timeline_label = "Litige résolu — remboursé"
    elif req.decision == "release_seller":
        new_escrow = "released"
        timeline_label = "Litige résolu — libéré vendeur"
    elif req.decision == "partial_refund":
        new_escrow = "partial_refund"
        timeline_label = "Litige résolu — remboursement partiel"
    else:
        raise HTTPException(status_code=400, detail="Décision invalide")

    await db.disputes.update_one(
        {"id": dispute_id},
        {"$set": {"status": "resolved", "admin_decision": req.decision, "admin_note": req.note, "partial_buyer_amount": req.partial_buyer_amount, "resolved_at": _now()}},
    )
    await db.orders.update_one(
        {"id": order["id"]},
        {"$set": {"escrow_status": new_escrow}, "$push": {"timeline": {"status": "dispute_resolved", "label": timeline_label, "timestamp": _now()}}},
    )
    await db.transactions.update_one(
        {"order_id": order["id"]},
        {"$set": {"payment_status": new_escrow, "escrow_released_at": _now() if new_escrow != "frozen" else None}},
    )
    return {"ok": True, "decision": req.decision, "escrow_status": new_escrow}
