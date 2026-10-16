"""Direct declarations, never money movements. Author: Jonathan Kakesa (JonathanK-N)."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from auth import get_current_user_dep
from db import get_db
from financial_transactions import atomic_operation
from notifications import create_notification
from commerce_mode import integrated_payments_enabled, legacy_financial_actions_enabled
from direct_orders import open_direct_dispute

router = APIRouter(tags=["direct-payment"])


class DeclarationRequest(BaseModel):
    action: str = Field(pattern="^(buyer_declared|seller_received|seller_not_received|buyer_disagrees)$")
    note: str = Field(default="", max_length=500)


async def authorize(db, order_id, user):
    order = await db.orders.find_one({"id": order_id})
    if not order or order.get("payment_method") != "direct":
        raise HTTPException(404, "Commande en paiement direct introuvable")
    seller = await db.sellers.find_one({"id": order["seller_id"]})
    buyer = user.get("role") == "buyer" and order["buyer_id"] == user["id"]
    owner = user.get("role") == "seller" and seller and seller.get("user_id") == user["id"]
    if not buyer and not owner:
        raise HTTPException(404, "Commande introuvable")
    return order, seller, "buyer" if buyer else "seller"


@router.get("/commerce/features")
async def features():
    return {"direct_payment": True, "funds_held_by_platform": False, "cinetpay_enabled": integrated_payments_enabled(), "wallet_withdrawals_enabled": integrated_payments_enabled() and legacy_financial_actions_enabled(), "direct_refunds_automatic": False}


class DirectDisputeRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


@router.post("/orders/{order_id}/direct-dispute", status_code=201)
@atomic_operation
async def dispute_direct(order_id: str, req: DirectDisputeRequest, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    order, _, _ = await authorize(db, order_id, user)
    return await open_direct_dispute(db, order, user, req.reason)


@router.post("/orders/{order_id}/direct-payment")
@atomic_operation
async def declare_payment(order_id: str, req: DeclarationRequest, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    order, seller, role = await authorize(db, order_id, user)
    expected_role = "buyer" if req.action in {"buyer_declared", "buyer_disagrees"} else "seller"
    if role != expected_role:
        raise HTTPException(403, "Cette déclaration appartient à l’autre participant")
    target = {"buyer_declared": "buyer_declared", "seller_received": "seller_declared_received", "seller_not_received": "seller_declared_not_received", "buyer_disagrees": "disputed_declaration"}[req.action]
    current = order.get("payment_status", "to_arrange")
    if current == target:
        order.pop("_id", None)
        if role == "seller":
            order.pop("confirmation_code", None)
            order.pop("qr_code", None)
        return order
    if order["status"] != "confirmed" or order.get("dispute_status") == "open":
        raise HTTPException(409, "Déclaration suspendue après traitement ou pendant un litige")
    allowed = {"buyer_declared": {"to_arrange", "seller_declared_not_received"}, "seller_received": {"to_arrange", "buyer_declared", "seller_declared_not_received"}, "seller_not_received": {"to_arrange", "buyer_declared"}, "buyer_disagrees": {"seller_declared_received", "seller_declared_not_received"}}
    if current not in allowed[req.action]:
        raise HTTPException(409, "Déclaration contradictoire ; ouvrez un litige")
    now = datetime.now(timezone.utc).isoformat()
    event = {"action": req.action, "actor_id": user["id"], "role": role, "timestamp": now, "note": req.note.strip(), "verified_by_platform": False}
    result = await db.orders.update_one({"id": order_id, "revision": order.get("revision", 0), "payment_status": current, "status": "confirmed"}, {"$set": {"payment_status": target, "payment_verification": "not_verified_by_platform", "payment_confirmed": False}, "$inc": {"revision": 1}, "$push": {"payment_history": event}})
    if result.modified_count != 1:
        raise HTTPException(409, "Commande déjà modifiée")
    await create_notification(seller["user_id"] if role == "buyer" else order["buyer_id"], "order_received", "Déclaration de paiement direct", "Une déclaration hors plateforme a été ajoutée à votre commande. Elle n’est pas vérifiée par AfriMarket.", {"order_id": order_id})
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if role == "seller":
        order.pop("confirmation_code", None)
        order.pop("qr_code", None)
    return order


@router.post("/orders/{order_id}/cancel-direct")
@atomic_operation
async def cancel_direct(order_id: str, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    order, _, _ = await authorize(db, order_id, user)
    if order["status"] == "cancelled":
        return {"ok": True, "status": "cancelled", "automatic_refund": False}
    if order["status"] != "confirmed" or order.get("payment_status") not in {"to_arrange", "buyer_declared", "seller_declared_not_received"} or order.get("dispute_status") == "open":
        raise HTTPException(409, "Annulation automatique indisponible ; ouvrez un litige et contactez le vendeur")
    event = {"status": "cancelled", "label": "Annulation avant traitement — aucun remboursement automatique", "timestamp": datetime.now(timezone.utc).isoformat(), "actor_id": user["id"]}
    result = await db.orders.update_one({"id": order_id, "status": "confirmed", "revision": order.get("revision", 0)}, {"$set": {"status": "cancelled"}, "$inc": {"revision": 1}, "$push": {"timeline": event}})
    if result.modified_count != 1:
        raise HTTPException(409, "Commande déjà modifiée")
    for item in order["items"]:
        await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": item["quantity"]}})
    return {"ok": True, "status": "cancelled", "automatic_refund": False}
