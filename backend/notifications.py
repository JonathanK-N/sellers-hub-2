"""In-app + push notifications (FCM stub)."""
from __future__ import annotations
import os
import uuid
import logging
from datetime import datetime, timezone

import httpx

from db import get_db

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


NOTIF_TYPES = {
    "order_received": "Nouvelle commande",
    "order_shipped": "Commande en livraison",
    "order_ready": "Commande prête pour retrait",
    "order_delivered": "Commande livrée",
    "dispute_opened": "Litige ouvert",
    "dispute_resolved": "Litige résolu",
    "kyc_approved": "KYC approuvé",
    "kyc_rejected": "KYC rejeté",
    "message_received": "Nouveau message",
    "review_received": "Nouvel avis",
    "withdrawal_completed": "Retrait effectué",
    "fraud_alert": "Alerte fraude",
}


async def create_notification(user_id: str, ntype: str, title: str, body: str, data: dict | None = None):
    """Create an in-app notification and trigger push (best-effort)."""
    db = get_db()
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": ntype,
        "title": title,
        "body": body,
        "data": data or {},
        "read": False,
        "created_at": _now(),
    }
    await db.notifications.insert_one(notif)

    # Push via FCM if configured
    try:
        prefs = await db.notification_prefs.find_one({"user_id": user_id}, {"_id": 0}) or {}
        if prefs.get(ntype) is False:
            return notif
        tokens = []
        async for d in db.device_tokens.find({"user_id": user_id, "is_active": True}, {"_id": 0, "token": 1}):
            tokens.append(d["token"])
        if tokens:
            await _send_fcm(tokens, title, body, data or {})
    except Exception as e:
        logger.warning(f"FCM push failed: {e}")
    notif.pop("_id", None)
    return notif


async def _send_fcm(tokens: list[str], title: str, body: str, data: dict):
    server_key = os.environ.get("FIREBASE_SERVER_KEY")
    if not server_key:
        logger.info(f"[FCM-SIMULATED] {title} → {len(tokens)} tokens")
        return
    headers = {"Authorization": f"key={server_key}", "Content-Type": "application/json"}
    payload = {
        "registration_ids": tokens,
        "notification": {"title": title, "body": body, "sound": "default"},
        "data": {k: str(v) for k, v in data.items()},
    }
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post("https://fcm.googleapis.com/fcm/send", headers=headers, json=payload)
            logger.info(f"FCM response {r.status_code}")
    except Exception as e:
        logger.warning(f"FCM error: {e}")
