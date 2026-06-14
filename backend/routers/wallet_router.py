"""Seller wallet & Mobile Money withdrawal (simulated)."""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db import get_db
from auth import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/seller/wallet", tags=["wallet"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WithdrawRequest(BaseModel):
    amount: float
    mobile_money_number: str
    operator: str  # MTN MoMo, Airtel Money, etc.


async def _compute_balance(db, seller_id: str) -> dict:
    """Available = sum(released order net) - sum(completed/in_progress withdrawals)."""
    pipeline = [
        {"$match": {"seller_id": seller_id, "escrow_status": {"$in": ["released", "partial_refund"]}}},
        {"$group": {"_id": None, "gross": {"$sum": "$total_amount"}, "commission": {"$sum": "$commission_amount"}}},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(1)
    if rows:
        gross = rows[0]["gross"]
        commission = rows[0]["commission"]
    else:
        gross = 0
        commission = 0
    net_earnings = gross - commission

    # Withdrawals are finalized by the background scheduler (cron), not on read.
    # Count in-progress/processing/completed against the balance so a seller can't
    # double-withdraw funds that are mid-flight.
    withdrawn = 0
    async for w in db.withdrawals.find({"seller_id": seller_id, "status": {"$in": ["in_progress", "processing", "completed"]}}):
        withdrawn += w["amount"]

    return {
        "gross_sales": gross,
        "commission_paid": commission,
        "net_earnings": net_earnings,
        "withdrawn": withdrawn,
        "available": net_earnings - withdrawn,
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
async def withdraw(req: WithdrawRequest, user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=400, detail="Boutique manquante")
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
    await db.withdrawals.insert_one(withdrawal)
    withdrawal.pop("_id", None)
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
