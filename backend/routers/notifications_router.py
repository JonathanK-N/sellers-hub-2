"""In-app notifications feed + FCM device token registration + preferences."""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db import get_db
from auth import get_current_user_dep
from notifications import NOTIF_TYPES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Feed ----------
@router.get("")
async def list_notifications(user: dict = Depends(get_current_user_dep)):
    db = get_db()
    items = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return items


@router.get("/unread-count")
async def unread_count(user: dict = Depends(get_current_user_dep)):
    db = get_db()
    count = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": count}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    res = await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True, "read_at": _now()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user: dict = Depends(get_current_user_dep)):
    db = get_db()
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True, "read_at": _now()}},
    )
    return {"ok": True}


# ---------- Device tokens (FCM) ----------
class DeviceTokenRequest(BaseModel):
    token: str
    platform: str = "web"  # web | android | ios


@router.post("/device-token")
async def register_device_token(req: DeviceTokenRequest, user: dict = Depends(get_current_user_dep)):
    """Register or refresh an FCM device token for push notifications."""
    db = get_db()
    if not req.token.strip():
        raise HTTPException(status_code=400, detail="Token requis")
    await db.device_tokens.update_one(
        {"token": req.token.strip()},
        {"$set": {
            "user_id": user["id"],
            "token": req.token.strip(),
            "platform": req.platform,
            "is_active": True,
            "updated_at": _now(),
        }, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": _now()}},
        upsert=True,
    )
    return {"ok": True}


@router.delete("/device-token")
async def remove_device_token(req: DeviceTokenRequest, user: dict = Depends(get_current_user_dep)):
    """Deactivate a device token (e.g. on logout or permission revoke)."""
    db = get_db()
    await db.device_tokens.update_one(
        {"token": req.token.strip(), "user_id": user["id"]},
        {"$set": {"is_active": False, "updated_at": _now()}},
    )
    return {"ok": True}


# ---------- Preferences ----------
@router.get("/preferences")
async def get_preferences(user: dict = Depends(get_current_user_dep)):
    """Return per-type notification preferences. Missing types default to enabled."""
    db = get_db()
    prefs = await db.notification_prefs.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    result = []
    for ntype, label in NOTIF_TYPES.items():
        enabled = prefs.get(ntype, True)
        result.append({"type": ntype, "label": label, "enabled": enabled})
    return result


class PreferenceUpdateRequest(BaseModel):
    type: str
    enabled: bool


@router.patch("/preferences")
async def update_preference(req: PreferenceUpdateRequest, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    if req.type not in NOTIF_TYPES:
        raise HTTPException(status_code=400, detail="Type de notification inconnu")
    await db.notification_prefs.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], req.type: req.enabled, "updated_at": _now()}},
        upsert=True,
    )
    return {"ok": True, "type": req.type, "enabled": req.enabled}
