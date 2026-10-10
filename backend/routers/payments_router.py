"""Payment initiation (hosted checkout) + provider webhook handling."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from db import get_db
from auth import require_role
from payments.service import get_provider, cinetpay_configured, CinetPayProvider, is_sandbox

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class InitRequest(BaseModel):
    order_group_id: str


@router.post("/init")
async def init_payment(req: InitRequest, user: dict = Depends(require_role("buyer"))):
    """Create a hosted-checkout payment for an order group.

    - payment_method == "cash": no external provider needed; escrow is
      considered captured and will be released when the buyer confirms delivery.
    - Otherwise: CinetPay hosted checkout (sandbox or live).
    """
    db = get_db()
    group = await db.order_groups.find_one({"id": req.order_group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Groupe de commandes introuvable")
    if group["buyer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if group.get("payment_status") in {"paid", "cash_on_delivery"}:
        return {"simulated": False, "cash": group.get("payment_method") == "cash",
                "status": group["payment_status"], "order_group_id": req.order_group_id}

    # ── Cash on delivery: pas de prestataire externe ──────────────────────────
    if group.get("payment_method") == "cash":
        await db.order_groups.update_one(
            {"id": req.order_group_id},
            {"$set": {"payment_status": "cash_on_delivery"}},
        )
        await db.orders.update_many(
            {"order_group_id": req.order_group_id, "escrow_status": "held"},
            {"$set": {"escrow_status": "held", "payment_confirmed": True}},
        )
        await db.transactions.update_many(
            {"order_group_id": req.order_group_id, "payment_status": {"$nin": ["released", "refunded", "partial_refund"]}},
            {"$set": {"payment_status": "cash_pending"}},
        )
        return {
            "simulated": False,
            "cash": True,
            "status": "cash_on_delivery",
            "order_group_id": req.order_group_id,
        }

    # ── Mobile Money via CinetPay ─────────────────────────────────────────────
    if not cinetpay_configured():
        if not is_sandbox():
            raise HTTPException(status_code=503, detail="Prestataire de paiement non configuré")
        raise HTTPException(status_code=503, detail="Paiement Mobile Money de test indisponible")

    provider = get_provider(group.get("payment_method", ""))
    phone = user.get("phone", "")
    result = await provider.collect(
        phone=phone,
        amount=group["grand_total"],
        currency=group["currency"],
        external_ref=req.order_group_id,
        description=f"AfriMarket - {group['seller_count']} commande(s)",
    )
    if not result.ok:
        raise HTTPException(status_code=502, detail=f"Échec initiation paiement: {result.error}")

    await db.order_groups.update_one(
        {"id": req.order_group_id},
        {"$set": {"payment_status": "pending", "payment_ref": result.reference, "payment_url": result.payment_url}},
    )
    return {"simulated": False, "payment_url": result.payment_url, "reference": result.reference}


@router.post("/webhook/cinetpay")
async def cinetpay_webhook(request: Request):
    """CinetPay notify_url callback. Verifies the transaction status server-side
    (never trusts the POST body alone), then releases or fails the order group.
    """
    if not cinetpay_configured():
        raise HTTPException(status_code=503, detail="Webhook du prestataire indisponible")
    db = get_db()
    form = {}
    try:
        form = dict(await request.form())
    except Exception:
        try:
            form = await request.json()
        except Exception:
            form = {}

    transaction_id = form.get("cpm_trans_id") or form.get("transaction_id")
    if not transaction_id:
        raise HTTPException(status_code=400, detail="transaction_id manquant")

    provider = CinetPayProvider()
    verified = await provider.check(transaction_id)

    if transaction_id.startswith("premium_"):
        sub_id = transaction_id[len("premium_"):]
        sub = await db.premium_subscriptions.find_one({"id": sub_id}, {"_id": 0})
        if not sub:
            return {"ok": True}
        if verified.status == "SUCCESS":
            from routers.premium_router import _activate_premium
            await _activate_premium(db, sub["seller_id"], sub["user_id"], sub_id)
            logger.info(f"[CINETPAY] premium {sub_id} activated")
        elif verified.status == "FAILED":
            await db.premium_subscriptions.update_one({"id": sub_id}, {"$set": {"status": "failed"}})
        return {"ok": True}

    group = await db.order_groups.find_one({"id": transaction_id}, {"_id": 0})
    if not group:
        logger.warning(f"[CINETPAY] webhook for unknown group {transaction_id}")
        return {"ok": True}
    if group.get("payment_status") == "paid":
        return {"ok": True}

    if verified.status == "SUCCESS":
        await db.order_groups.update_one({"id": transaction_id}, {"$set": {"payment_status": "paid", "paid_at": _now()}})
        await db.orders.update_many(
            {"order_group_id": transaction_id, "escrow_status": {"$in": ["awaiting_payment", "held"]}, "status": {"$nin": ["cancelled", "delivered", "collected"]}},
            {"$set": {"escrow_status": "held", "payment_confirmed": True}},
        )
        await db.transactions.update_many(
            {"order_group_id": transaction_id, "payment_status": {"$nin": ["released", "refunded", "partial_refund"]}},
            {"$set": {"payment_status": "captured_in_escrow", "confirmed_at": _now()}},
        )
        logger.info(f"[CINETPAY] group {transaction_id} paid -> escrow held")
    elif verified.status == "FAILED":
        await db.order_groups.update_one({"id": transaction_id}, {"$set": {"payment_status": "failed"}})
        await db.orders.update_many(
            {"order_group_id": transaction_id, "status": "confirmed"},
            {"$set": {"status": "cancelled", "escrow_status": "refunded"}},
        )
        logger.info(f"[CINETPAY] group {transaction_id} payment failed -> orders cancelled")

    return {"ok": True}


@router.get("/status/{order_group_id}")
async def payment_status(order_group_id: str, user: dict = Depends(require_role("buyer"))):
    """Buyer polls the payment status of their order group."""
    db = get_db()
    group = await db.order_groups.find_one({"id": order_group_id}, {"_id": 0})
    if not group or group["buyer_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Introuvable")
    return {"order_group_id": order_group_id, "payment_status": group.get("payment_status", "unpaid")}
