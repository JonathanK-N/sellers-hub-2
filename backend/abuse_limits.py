"""Compteurs anti-abus persistés en base.

Ils complètent slowapi : derrière le proxy Railway, l'IP vue par uvicorn n'est
pas celle du client, et un attaquant peut de toute façon répartir ses essais
sur plusieurs IP. Les compteurs ci-dessous sont donc indexés par numéro de
téléphone, par compte ou par commande.
"""
import hmac
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from pymongo import ReturnDocument

OTP_MAX_ATTEMPTS = 5
OTP_SEND_PER_HOUR = 5
HANDOFF_MAX_FAILURES = 10
HANDOFF_LOCK_MINUTES = 15


def _now():
    return datetime.now(timezone.utc)


def codes_match(expected, supplied) -> bool:
    """Comparaison à temps constant d'un code secret saisi par l'utilisateur."""
    if not isinstance(expected, str) or not expected or not isinstance(supplied, str):
        return False
    return hmac.compare_digest(expected.encode("utf-8"), supplied.strip().encode("utf-8"))


async def consume_quota(db, scope: str, key: str, limit: int, window_seconds: int, detail: str):
    """Fenêtre fixe stockée dans message_rate_limits (index TTL sur expires_at)."""
    now = _now()
    bucket = f"{scope}:{key}:{int(now.timestamp()) // window_seconds}"
    rate = await db.message_rate_limits.find_one_and_update(
        {"_id": bucket},
        {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": now + timedelta(seconds=2 * window_seconds)}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    if rate["count"] > limit:
        raise HTTPException(429, detail, headers={"Retry-After": str(window_seconds)})


async def check_otp(collection, query: dict, otp_doc: dict, supplied: str):
    """Valide un OTP ; compte les échecs et invalide le code après OTP_MAX_ATTEMPTS."""
    current = {**query, "code": otp_doc.get("code")}
    if otp_doc.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        await collection.delete_one(current)
        raise HTTPException(429, "Trop de tentatives. Demandez un nouveau code.")
    if codes_match(otp_doc.get("code"), supplied):
        return
    updated = await collection.find_one_and_update(
        current, {"$inc": {"attempts": 1}}, return_document=ReturnDocument.AFTER,
    )
    if updated and updated.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        await collection.delete_one(current)
        raise HTTPException(429, "Trop de tentatives. Demandez un nouveau code.")
    raise HTTPException(400, "Code incorrect")


def _unbound(db):
    """Les échecs doivent survivre à l'annulation de la transaction financière."""
    from financial_transactions import SessionDatabase
    return db.database if isinstance(db, SessionDatabase) else db


def ensure_handoff_unlocked(order: dict):
    until = order.get("handoff_locked_until")
    if not until:
        return
    try:
        locked = datetime.fromisoformat(str(until).replace("Z", "+00:00"))
    except ValueError:
        return
    if locked.tzinfo is None:
        locked = locked.replace(tzinfo=timezone.utc)
    if locked > _now():
        raise HTTPException(429, "Trop de codes incorrects. Réessayez dans quelques minutes.",
                            headers={"Retry-After": str(HANDOFF_LOCK_MINUTES * 60)})


async def record_handoff_failure(db, order_id: str):
    """Compte un code de remise erroné ; bloque la commande 15 min après 10 échecs."""
    raw = _unbound(db)
    updated = await raw.orders.find_one_and_update(
        {"id": order_id}, {"$inc": {"handoff_code_failures": 1}},
        projection={"_id": 0, "handoff_code_failures": 1}, return_document=ReturnDocument.AFTER,
    )
    if updated and updated.get("handoff_code_failures", 0) >= HANDOFF_MAX_FAILURES:
        until = (_now() + timedelta(minutes=HANDOFF_LOCK_MINUTES)).isoformat()
        await raw.orders.update_one(
            {"id": order_id}, {"$set": {"handoff_code_failures": 0, "handoff_locked_until": until}},
        )


async def verify_handoff_code(db, order: dict, order_id: str, supplied: str, detail: str = "Code incorrect"):
    ensure_handoff_unlocked(order)
    if not codes_match(order.get("confirmation_code"), supplied):
        await record_handoff_failure(db, order_id)
        raise HTTPException(400, detail)
