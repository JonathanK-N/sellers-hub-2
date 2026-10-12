"""Business number verification. Author: Jonathan Kakesa (JonathanK-N)."""
import hashlib
import hmac
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from db import get_db
from auth import require_role, generate_otp, require_otp_delivery, otp_sandbox_enabled
from sms import send_otp_sms, is_sms_configured
from whatsapp_contact import international_phone

router = APIRouter(prefix="/seller/whatsapp", tags=["whatsapp"])


class ContactRequest(BaseModel):
    phone: str = Field(max_length=40)
    visible: bool = False


class CodeRequest(BaseModel):
    code: str = Field(pattern=r"^[0-9]{6}$")


async def shop(db, user):
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(404, "Boutique introuvable")
    return seller


@router.put("")
async def configure(req: ContactRequest, user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await shop(db, user)
    phone = international_phone(req.phone)
    old = seller.get("whatsapp_contact") or {}
    verified = (old.get("phone") == phone and old.get("verified") is True) or (phone == user.get("phone") and user.get("phone_verified") is True)
    contact = {"phone": phone, "visible": req.visible, "verified": verified, "consent_at": datetime.now(timezone.utc).isoformat(), "verification_source": "account_phone" if phone == user.get("phone") and user.get("phone_verified") else (old.get("verification_source") if verified else None)}
    await db.sellers.update_one({"id": seller["id"]}, {"$set": {"whatsapp_contact": contact}, "$unset": {"whatsapp_verification": ""}})
    return contact


@router.post("/send-code")
async def send_code(user: dict = Depends(require_role("seller"))):
    require_otp_delivery()
    db = get_db()
    seller = await shop(db, user)
    contact = seller.get("whatsapp_contact") or {}
    phone = international_phone(contact.get("phone", ""))
    now = datetime.now(timezone.utc)
    rate = await db.message_rate_limits.find_one_and_update({"_id": "whatsapp:" + user["id"] + ":" + str(int(now.timestamp()) // 3600)}, {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": now + timedelta(hours=2)}}, upsert=True, return_document=ReturnDocument.AFTER)
    if rate["count"] > 5:
        raise HTTPException(429, "Trop de demandes de vérification")
    code, salt = generate_otp(), uuid.uuid4().hex
    verification = {"phone": phone, "digest": hashlib.sha256((salt + code).encode()).hexdigest(), "salt": salt, "expires_at": now + timedelta(minutes=5), "attempts": 0}
    result = await db.sellers.update_one({"id": seller["id"], "whatsapp_contact.phone": phone}, {"$set": {"whatsapp_verification": verification}})
    if result.modified_count != 1:
        raise HTTPException(409, "Contact modifié ; recommencez")
    if not await send_otp_sms(phone, code):
        await db.sellers.update_one({"id": seller["id"], "whatsapp_verification.salt": salt}, {"$unset": {"whatsapp_verification": ""}})
        raise HTTPException(503, "Envoi du code indisponible")
    response = {"status": "verification_sent"}
    if otp_sandbox_enabled() and not is_sms_configured():
        response["otp_dev"] = code
    return response


@router.post("/verify")
async def verify(req: CodeRequest, user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await shop(db, user)
    proof = seller.get("whatsapp_verification") or {}
    expires = proof.get("expires_at")
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not proof or not expires or expires < datetime.now(timezone.utc) or proof.get("attempts", 0) >= 5:
        raise HTTPException(409, "Vérification expirée ; demandez un nouveau code")
    attempted = await db.sellers.update_one({"id": seller["id"], "whatsapp_verification.salt": proof["salt"], "whatsapp_verification.attempts": {"$lt": 5}}, {"$inc": {"whatsapp_verification.attempts": 1}})
    if attempted.modified_count != 1:
        raise HTTPException(409, "Vérification déjà modifiée")
    if not hmac.compare_digest(proof["digest"], hashlib.sha256((proof["salt"] + req.code).encode()).hexdigest()):
        raise HTTPException(400, "Code incorrect")
    result = await db.sellers.update_one({"id": seller["id"], "whatsapp_contact.phone": proof["phone"], "whatsapp_verification.salt": proof["salt"]}, {"$set": {"whatsapp_contact.verified": True, "whatsapp_contact.verification_source": "sms_otp", "whatsapp_contact.verified_at": datetime.now(timezone.utc).isoformat()}, "$unset": {"whatsapp_verification": ""}})
    if result.modified_count != 1:
        raise HTTPException(409, "Contact modifié pendant la vérification")
    return {"verified": True}
