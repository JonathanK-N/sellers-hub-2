"""Off-platform order actions. Author: Jonathan Kakesa (JonathanK-N)."""
from datetime import datetime, timezone
from fastapi import HTTPException
import uuid
from communications.business import best_effort_order, dispute_event


async def open_direct_dispute(db, order, actor, reason):
    if order.get("dispute_status") == "open" or await db.disputes.find_one({"order_id": order["id"], "status": "open"}):
        raise HTTPException(409, "Un litige est déjà ouvert")
    now = datetime.now(timezone.utc).isoformat()
    dispute = {"id": str(uuid.uuid4()), "order_id": order["id"], "buyer_id": order["buyer_id"], "seller_id": order["seller_id"], "country_code": order["country_code"], "opened_by": actor["id"], "reason": reason.strip(), "status": "open", "payment_mode": "direct", "funds_held_by_platform": False, "created_at": now, "admin_decision": None, "resolved_at": None}
    result = await db.orders.update_one({"id": order["id"], "revision": order.get("revision", 0), "payment_method": "direct", "escrow_status": "not_applicable"}, {"$set": {"dispute_status": "open"}, "$inc": {"revision": 1}, "$push": {"timeline": {"status": "dispute_opened", "label": "Litige ouvert — paiement hors plateforme", "timestamp": now, "actor_id": actor["id"]}}})
    if result.modified_count != 1:
        raise HTTPException(409, "Commande déjà modifiée")
    await db.disputes.insert_one(dispute)
    await dispute_event(db, dispute["id"], "dispute_opened")
    dispute.pop("_id", None)
    return dispute


async def finish_handoff(db, order, actor, status):
    if order.get("payment_method") != "direct" or order.get("escrow_status") != "not_applicable":
        raise HTTPException(409, "Commande incompatible avec le paiement direct")
    if order.get("dispute_status") == "open":
        raise HTTPException(409, "Commande en litige")
    if order.get("payment_status") != "seller_declared_received":
        raise HTTPException(409, "Le vendeur doit déclarer la réception du paiement hors plateforme")
    now = datetime.now(timezone.utc).isoformat()
    event = {"status": status, "label": "Livraison confirmée — paiement hors plateforme non vérifié" if status == "delivered" else "Retrait confirmé — paiement hors plateforme non vérifié", "timestamp": now, "actor_id": actor["id"]}
    result = await db.orders.update_one({"id": order["id"], "status": order["status"], "payment_method": "direct", "payment_status": "seller_declared_received", "escrow_status": "not_applicable", "revision": order.get("revision", 0)}, {"$set": {"status": status, "delivered_at": now}, "$inc": {"revision": 1}, "$push": {"timeline": event}})
    if result.modified_count != 1:
        raise HTTPException(409, "Commande déjà modifiée")
    await best_effort_order(db, order["id"])
    return {"ok": True, "status": status, "payment_status": "seller_declared_received", "payment_verified_by_platform": False, "escrow_status": "not_applicable"}
