"""Auth routes: register, send OTP, verify OTP."""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends

from db import get_db
from models import RegisterRequest, SendOtpRequest, VerifyOtpRequest, UserPublic
from auth import (
    generate_otp,
    normalize_phone,
    create_access_token,
    get_current_user_dep,
    OTP_EXPIRY_MINUTES,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _strip_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k not in {"_id", "otp_code", "otp_expires_at"}}


@router.post("/register")
async def register(req: RegisterRequest):
    db = get_db()
    phone = normalize_phone(req.phone)
    if req.role not in ("buyer", "seller"):
        raise HTTPException(status_code=400, detail="Rôle invalide")

    country = await db.countries.find_one({"code": req.country_code}, {"_id": 0})
    if not country:
        raise HTTPException(status_code=400, detail="Pays invalide")

    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="Ce numéro est déjà utilisé. Connectez-vous plutôt.")

    user_doc = {
        "id": str(uuid.uuid4()),
        "name": req.name.strip(),
        "phone": phone,
        "role": req.role,
        "country_code": country["code"],
        "currency": country["currency"],
        "kyc_level": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)

    # Generate OTP
    code = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    await db.otp_codes.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "code": code, "expires_at": expires}},
        upsert=True,
    )
    logger.info(f"[OTP-SIMULATED] phone={phone} code={code}")
    return {
        "message": "Compte créé. Un code de vérification a été envoyé.",
        "phone": phone,
        "otp_dev": code,  # SIMULATED - only for dev/demo
    }


@router.post("/send-otp")
async def send_otp(req: SendOtpRequest):
    db = get_db()
    phone = normalize_phone(req.phone)
    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=404, detail="Aucun compte trouvé pour ce numéro")

    code = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    await db.otp_codes.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "code": code, "expires_at": expires}},
        upsert=True,
    )
    logger.info(f"[OTP-SIMULATED] phone={phone} code={code}")
    return {
        "message": "Code envoyé.",
        "phone": phone,
        "otp_dev": code,  # SIMULATED
    }


@router.post("/verify-otp")
async def verify_otp(req: VerifyOtpRequest):
    db = get_db()
    phone = normalize_phone(req.phone)
    otp_doc = await db.otp_codes.find_one({"phone": phone})
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Aucun code en attente")

    expires = otp_doc.get("expires_at")
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code expiré")

    if otp_doc["code"] != req.code.strip():
        raise HTTPException(status_code=400, detail="Code incorrect")

    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    # Clear OTP
    await db.otp_codes.delete_one({"phone": phone})

    token = create_access_token(user["id"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _strip_user(user),
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user_dep)):
    return _strip_user(user)
