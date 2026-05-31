"""AI-style fraud detection (heuristic rules-based)."""
from __future__ import annotations
import logging
from datetime import datetime, timezone, timedelta

from db import get_db

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def score_user(user_id: str) -> dict:
    """Compute fraud risk score for a user. Returns dict with score & signals."""
    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return {"score": 0, "signals": []}

    signals = []
    score = 0

    # Signal 1: account < 24h with high-value order
    try:
        created = datetime.fromisoformat(user["created_at"].replace("Z", "+00:00"))
        age_hours = (_now() - created).total_seconds() / 3600
        if age_hours < 24:
            big_orders = 0
            async for o in db.orders.find({"buyer_id": user_id}, {"_id": 0, "total_amount": 1}):
                if o["total_amount"] > 50000:
                    big_orders += 1
            if big_orders > 0:
                signals.append({"key": "young_account_big_order", "label": "Compte <24h avec grosse commande", "weight": 35})
                score += 35
    except Exception:
        pass

    # Signal 2: order > 10x avg basket
    orders = []
    async for o in db.orders.find({"buyer_id": user_id}, {"_id": 0}):
        orders.append(o)
    if len(orders) >= 3:
        amounts = sorted([o["total_amount"] for o in orders])
        avg = sum(amounts[:-1]) / max(1, len(amounts) - 1)
        if amounts[-1] > 10 * avg and avg > 0:
            signals.append({"key": "order_10x_avg", "label": "Commande > 10× le panier moyen", "weight": 25})
            score += 25

    # Signal 3 (sellers): dispute rate > 30%
    seller = await db.sellers.find_one({"user_id": user_id}, {"_id": 0})
    if seller:
        total = await db.orders.count_documents({"seller_id": seller["id"]})
        disputes = await db.disputes.count_documents({"seller_id": seller["id"]})
        if total >= 5 and (disputes / total) > 0.30:
            signals.append({"key": "high_dispute_rate", "label": f"Taux de litiges {int(disputes/total*100)}%", "weight": 40})
            score += 40

    # Signal 4: many OTP attempts
    cutoff = (_now() - timedelta(hours=1)).isoformat()
    otp_attempts = await db.otp_attempts.count_documents({"phone": user.get("phone"), "at": {"$gte": cutoff}})
    if otp_attempts > 5:
        signals.append({"key": "many_otp_attempts", "label": f"{otp_attempts} tentatives OTP en 1h", "weight": 20})
        score += 20

    # Signal 5: multiple reviews from same phone in <1h (proxy for IP)
    if seller:
        cutoff = (_now() - timedelta(hours=1)).isoformat()
        recent_reviews = await db.reviews.count_documents({"seller_id": seller["id"], "created_at": {"$gte": cutoff}})
        if recent_reviews >= 5:
            signals.append({"key": "review_burst", "label": "Avis groupés en <1h", "weight": 15})
            score += 15

    return {"score": min(100, score), "signals": signals}


async def evaluate_and_log(user_id: str):
    """Compute score and persist alert if threshold reached. Returns dict with action taken."""
    db = get_db()
    result = await score_user(user_id)
    score = result["score"]
    if score < 50:
        return {"score": score, "action": "none"}

    if score < 70:
        level = "info"
        action = "flag"
    elif score < 90:
        level = "warning"
        action = "alert"
    else:
        level = "danger"
        action = "auto_suspend"
        await db.users.update_one({"id": user_id}, {"$set": {"suspended": True, "suspended_at": _now().isoformat(), "suspended_reason": "Score fraude > 90"}})

    # Upsert alert
    await db.fraud_alerts.update_one(
        {"user_id": user_id, "status": "open"},
        {"$set": {
            "user_id": user_id,
            "score": score,
            "signals": result["signals"],
            "level": level,
            "status": "open",
            "action_taken": action,
            "created_at": _now().isoformat(),
        }},
        upsert=True,
    )
    logger.info(f"[FRAUD] user={user_id} score={score} action={action}")
    return {"score": score, "action": action, "signals": result["signals"]}
