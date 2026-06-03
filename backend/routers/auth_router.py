"""Auth routes: register, OTP verification, password login, admin login."""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends

from db import get_db
from models import (
    RegisterRequest, SendOtpRequest, VerifyOtpRequest, UserPublic,
    LoginRequest, AdminLoginRequest, SetPasswordRequest,
)
from auth import (
    generate_otp,
    normalize_phone,
    create_access_token,
    get_current_user_dep,
    hash_password,
    verify_password,
    OTP_EXPIRY_MINUTES,
)
from sms import send_otp_sms, is_sms_configured

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _strip_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k not in {"_id", "otp_code", "otp_expires_at", "password_hash"}}


@router.post("/register")
async def register(req: RegisterRequest):
    db = get_db()
    phone = normalize_phone(req.phone)
    if req.role not in ("buyer", "seller", "deliverer"):
        raise HTTPException(status_code=400, detail="Rôle invalide")
    if len(req.password or "") < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")

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
        "password_hash": hash_password(req.password),
        "phone_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)

    # Send OTP to verify the phone number once
    code = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    await db.otp_codes.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "code": code, "expires_at": expires}},
        upsert=True,
    )
    await send_otp_sms(phone, code)
    resp = {"message": "Compte créé. Vérifiez votre numéro avec le code envoyé.", "phone": phone}
    if not is_sms_configured():
        resp["otp_dev"] = code  # visible only in simulation mode
    return resp


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
    await send_otp_sms(phone, code)
    resp = {"message": "Code envoyé.", "phone": phone}
    if not is_sms_configured():
        resp["otp_dev"] = code  # visible only in simulation mode
    return resp


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

    # Clear OTP and mark the phone as verified
    await db.otp_codes.delete_one({"phone": phone})
    await db.users.update_one({"phone": phone}, {"$set": {"phone_verified": True}})
    user["phone_verified"] = True

    token = create_access_token(user["id"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _strip_user(user),
    }


@router.post("/login")
async def login(req: LoginRequest):
    """Password login by phone number (after the phone was verified once)."""
    db = get_db()
    phone = normalize_phone(req.phone)
    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=404, detail="Aucun compte trouvé pour ce numéro")
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Utilisez la page de connexion administrateur")
    if not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Numéro ou mot de passe incorrect")
    if not user.get("phone_verified", False):
        # Phone never verified: re-issue an OTP and ask the user to verify
        code = generate_otp()
        expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
        await db.otp_codes.update_one({"phone": phone}, {"$set": {"phone": phone, "code": code, "expires_at": expires}}, upsert=True)
        await send_otp_sms(phone, code)
        raise HTTPException(status_code=403, detail="VERIFY_REQUIRED")

    token = create_access_token(user["id"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": _strip_user(user)}


@router.post("/admin/login")
async def admin_login(req: AdminLoginRequest):
    """Dedicated admin login. Credentials come from environment variables:
    ADMIN_PHONE + ADMIN_PASSWORD. The admin account is provisioned at startup.
    """
    db = get_db()
    phone = normalize_phone(req.phone)
    admin_phone = normalize_phone(os.environ.get("ADMIN_PHONE", "+243000000001"))
    admin_password = os.environ.get("ADMIN_PASSWORD", "")

    if phone != admin_phone:
        raise HTTPException(status_code=401, detail="Identifiants administrateur invalides")

    user = await db.users.find_one({"phone": admin_phone, "role": "admin"})
    if not user:
        raise HTTPException(status_code=401, detail="Compte administrateur introuvable")

    # Prefer the stored hash; fall back to comparing against ADMIN_PASSWORD env.
    ok = False
    if user.get("password_hash"):
        ok = verify_password(req.password, user["password_hash"])
    elif admin_password:
        ok = (req.password == admin_password)
    if not ok:
        raise HTTPException(status_code=401, detail="Identifiants administrateur invalides")

    token = create_access_token(user["id"], "admin")
    return {"access_token": token, "token_type": "bearer", "user": _strip_user(user)}


@router.post("/reset-password")
async def reset_password(req: SetPasswordRequest):
    """Reset a forgotten password using an OTP sent to the phone."""
    db = get_db()
    phone = normalize_phone(req.phone)
    if len(req.new_password or "") < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    otp_doc = await db.otp_codes.find_one({"phone": phone})
    if not otp_doc or otp_doc.get("code") != req.code.strip():
        raise HTTPException(status_code=400, detail="Code incorrect")
    expires = otp_doc.get("expires_at")
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code expiré")
    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    await db.users.update_one({"phone": phone}, {"$set": {"password_hash": hash_password(req.new_password), "phone_verified": True}})
    await db.otp_codes.delete_one({"phone": phone})
    token = create_access_token(user["id"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": _strip_user({**user, "phone_verified": True})}


@router.get("/me")
async def me(user: dict = Depends(get_current_user_dep)):
    return _strip_user(user)
