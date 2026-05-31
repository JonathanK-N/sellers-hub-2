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
    """Send a push via FCM.

    Modes (in order of preference):
    1. HTTP v1 API — set FIREBASE_PROJECT_ID + FIREBASE_SA_JSON (service account JSON).
    2. Legacy API — set FIREBASE_SERVER_KEY (deprecated by Google but still works for now).
    3. Simulated — no keys: log and return (sandbox/dev).
    """
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    sa_json = os.environ.get("FIREBASE_SA_JSON")
    server_key = os.environ.get("FIREBASE_SERVER_KEY")

    if project_id and sa_json:
        await _send_fcm_v1(project_id, sa_json, tokens, title, body, data)
        return

    if server_key:
        headers = {"Authorization": f"key={server_key}", "Content-Type": "application/json"}
        payload = {
            "registration_ids": tokens,
            "notification": {"title": title, "body": body, "sound": "default"},
            "data": {k: str(v) for k, v in data.items()},
        }
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post("https://fcm.googleapis.com/fcm/send", headers=headers, json=payload)
                logger.info(f"FCM(legacy) response {r.status_code}")
        except Exception as e:
            logger.warning(f"FCM(legacy) error: {e}")
        return

    logger.info(f"[FCM-SIMULATED] {title} → {len(tokens)} tokens")


async def _send_fcm_v1(project_id: str, sa_json: str, tokens: list[str], title: str, body: str, data: dict):
    """FCM HTTP v1 — sends one message per token using an OAuth2 token from the service account."""
    try:
        import json
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request as GoogleRequest

        info = json.loads(sa_json)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/firebase.messaging"]
        )
        creds.refresh(GoogleRequest())
        access_token = creds.token
    except Exception as e:
        logger.warning(f"FCM(v1) auth error: {e}")
        return

    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    str_data = {k: str(v) for k, v in data.items()}
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            for token in tokens:
                payload = {"message": {
                    "token": token,
                    "notification": {"title": title, "body": body},
                    "data": str_data,
                }}
                r = await c.post(url, headers=headers, json=payload)
                if r.status_code >= 400:
                    logger.warning(f"FCM(v1) {r.status_code} for token …{token[-6:]}")
    except Exception as e:
        logger.warning(f"FCM(v1) send error: {e}")
