"""Seller wallet & Mobile Money withdrawal (simulated)."""
import uuid
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from financial_transactions import atomic_operation

from db import get_db
from auth import require_role
from money import minor_units

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/seller/wallet", tags=["wallet"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WithdrawRequest(BaseModel):
    amount: float = Field(gt=0, allow_inf_nan=False)
    mobile_money_number: str
    operator: str  # MTN MoMo, Airtel Money, etc.


async def _compute_balance(db, seller_id: str, session=None) -> dict:
    """Available = sum(released order net) - sum(completed/in_progress withdrawals)."""
    gross_minor = commission_minor = withdrawn_minor = 0
    currencies = set()
    async for order in db.orders.find({"seller_id": seller_id, "escrow_status": "released"}, session=session):
        if not order.get("currency"):
            raise HTTPException(409, "Devise historique manquante ; rapprochement requis")
        currencies.add("CDF" if order["currency"] == "FC" else order["currency"])
        gross_minor += minor_units(order["total_amount"])
        commission_minor += minor_units(order["commission_amount"])
    async for w in db.withdrawals.find({"seller_id": seller_id, "status": {"$in": ["in_progress", "processing", "provider_pending", "manual_review", "reconciliation_required", "completed"]}}, session=session):
        currencies.add("CDF" if w["currency"] == "FC" else w["currency"])
        withdrawn_minor += minor_units(w["amount"])
    if len(currencies) > 1:
        raise HTTPException(409, "Solde multi-devises ; rapprochement requis")
    gross, commission, withdrawn = gross_minor / 100, commission_minor / 100, withdrawn_minor / 100
    net_earnings = (gross_minor - commission_minor) / 100

    return {
        "gross_sales": gross,
        "commission_paid": commission,
        "net_earnings": net_earnings,
        "withdrawn": withdrawn,
        "available": (gross_minor - commission_minor - withdrawn_minor) / 100,
        "account_currency": next(iter(currencies), None),
    }


@router.get("")
async def wallet_overview(user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=400, detail="Boutique manquante")
    balance = await _compute_balance(db, seller["id"])
    balance["currency"] = user["currency"]
    return balance


@router.get("/transactions")
async def list_transactions(user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        return []

    # Sales transactions (released orders)
    sales = []
    async for o in db.orders.find({"seller_id": seller["id"], "escrow_status": {"$in": ["released", "partial_refund"]}}, {"_id": 0}).sort("created_at", -1):
        sales.append({
            "id": f"sale_{o['id']}",
            "type": "sale",
            "amount": o["total_amount"] - o["commission_amount"],
            "commission": o["commission_amount"],
            "gross": o["total_amount"],
            "currency": o["currency"],
            "order_id": o["id"],
            "status": "completed",
            "created_at": o["created_at"],
        })

    withdrawals = []
    async for w in db.withdrawals.find({"seller_id": seller["id"]}, {"_id": 0}).sort("created_at", -1):
        withdrawals.append({
            "id": w["id"],
            "type": "withdrawal",
            "amount": -w["amount"],
            "currency": w["currency"],
            "mobile_money_number": w["mobile_money_number"],
            "operator": w["operator"],
            "status": w["status"],
            "created_at": w["created_at"],
        })

    return sorted(sales + withdrawals, key=lambda x: x["created_at"], reverse=True)


@router.post("/withdraw", status_code=201)
@atomic_operation
async def withdraw(req: WithdrawRequest, user: dict = Depends(require_role("seller")), idempotency_key: str = Header(alias="Idempotency-Key", min_length=8, max_length=128)):
    if not isinstance(idempotency_key, str) or not 8 <= len(idempotency_key) <= 128:
        raise HTTPException(422, "Clé de retrait requise")
    amount_minor = minor_units(req.amount)
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=400, detail="Boutique manquante")
    request_id = user["id"] + ":" + idempotency_key
    fingerprint = hashlib.sha256(json.dumps(req.model_dump(), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    replay = await db.withdrawal_requests.find_one({"_id": request_id})
    if replay:
        if replay["fingerprint"] != fingerprint:
            raise HTTPException(409, "Clé déjà utilisée pour un retrait différent")
        return replay["response"]
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")
    if not req.mobile_money_number.strip():
        raise HTTPException(status_code=400, detail="Numéro Mobile Money requis")
    balance = await _compute_balance(db, seller["id"])
    if req.amount > balance["available"]:
        raise HTTPException(status_code=400, detail=f"Solde insuffisant. Disponible: {balance['available']:.0f}")

    withdrawal = {
        "id": str(uuid.uuid4()),
        "seller_id": seller["id"],
        "user_id": user["id"],
        "amount": req.amount,
        "currency": user["currency"],
        "mobile_money_number": req.mobile_money_number.strip(),
        "operator": req.operator,
        "status": "in_progress",
        "created_at": _now(),
        "completed_at": None,
    }
    # The seller document serializes competing reservations in this transaction.
    await db.sellers.update_one({"id": seller["id"]}, {"$inc": {"wallet_revision": 1}})
    fresh_balance = await _compute_balance(db, seller["id"])
    currency = "CDF" if user["currency"] == "FC" else user["currency"]
    if fresh_balance["account_currency"] not in {None, currency}:
        raise HTTPException(409, "Devise du solde incompatible")
    if amount_minor > minor_units(fresh_balance["available"]):
        raise HTTPException(409, "Solde insuffisant")
    await db.withdrawals.insert_one(withdrawal)
    await db.financial_ledger.insert_one({
        "_id": "withdrawal:" + withdrawal["id"], "currency": user["currency"],
        "lines": [{"account": "seller:" + seller["id"], "minor": -amount_minor},
                  {"account": "withdrawal_reserved:" + withdrawal["id"], "minor": amount_minor}],
    })
    withdrawal.pop("_id", None)
    await db.withdrawal_requests.insert_one({"_id": request_id, "fingerprint": fingerprint, "response": withdrawal})
    return withdrawal

# ============================================================
# Wallet livreur
# ============================================================

@router.get("/deliverer/balance")
async def deliverer_wallet(user: dict = Depends(require_role("deliverer"))):
    """Solde et stats du wallet livreur."""
    db = get_db()
    w = await db.deliverer_wallets.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    completed_all = await db.orders.count_documents({"deliverer_id": user["id"], "status": "delivered"})
    return {
        "balance": w.get("balance", 0.0),
        "currency": w.get("currency", user.get("currency", "CDF")),
        "completed_deliveries": completed_all,
        "total_earned": w.get("balance", 0.0),
    }


@router.get("/deliverer/transactions")
async def deliverer_wallet_transactions(user: dict = Depends(require_role("deliverer"))):
    """Historique des gains du livreur."""
    db = get_db()
    txs = await db.deliverer_wallet_transactions.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return txs
