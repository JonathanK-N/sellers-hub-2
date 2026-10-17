"""Phone+OTP authentication with JWT."""
import os
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
import bcrypt
from fastapi import HTTPException, Request, Depends

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_DAYS = 7
OTP_EXPIRY_MINUTES = 10


def hash_password(password: str) -> str:
    """Hash a password with bcrypt; returns a UTF-8 string for storage."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash."""
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET not configured")
    return secret


def generate_otp() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def create_access_token(user_id: str, role: str, auth_version: int = 0) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_DAYS),
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "av": auth_version,
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM], options={"require": ["sub", "exp", "iat", "type"]})
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Invalid token type")
    return payload


def normalize_phone(phone: str) -> str:
    """Strip spaces, dashes, parentheses; keep leading +."""
    phone = phone.strip()
    cleaned = "".join(c for c in phone if c.isdigit() or c == "+")
    if not cleaned.startswith("+") and cleaned:
        cleaned = "+" + cleaned
    return cleaned


async def get_current_user_dep(request: Request):
    """FastAPI dependency to extract current user from JWT."""
    from db import get_db  # lazy import to avoid circular

    auth_header = request.headers.get("Authorization", "")
    token: Optional[str] = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

    db = get_db()
    user = await db.users.find_one({"id": payload["sub"]}, dict.fromkeys(("_id", "otp_code", "otp_expires_at", "password_hash"), 0))
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    if payload.get("av", 0) != user.get("auth_version", 0):
        raise HTTPException(401, "Session expirée")
    # Bloquer les comptes suspendus/bannis — même avec un token encore valide
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Votre compte a été banni. Contactez le support.")
    if user.get("suspended"):
        raise HTTPException(status_code=403, detail="Votre compte est temporairement suspendu. Contactez le support.")
    if user.get("is_deleted") or user.get("deleted") or user.get("is_active") is False:
        raise HTTPException(403, "Compte désactivé")
    return user


def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user_dep)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Accès refusé")
        return user
    return checker

async def get_current_user_optional(request: Request):
    """Like get_current_user_dep but returns None instead of raising when
    there's no valid session. Used for endpoints that serve both public and
    private content (e.g. file serving) depending on the resource."""
    from db import get_db  # lazy import to avoid circular

    auth_header = request.headers.get("Authorization", "")
    token: Optional[str] = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = decode_token(token)
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

    db = get_db()
    user = await db.users.find_one({"id": payload["sub"]}, dict.fromkeys(("_id", "otp_code", "otp_expires_at", "password_hash"), 0))
    if user and (payload.get("av", 0) != user.get("auth_version", 0) or user.get("banned") or user.get("suspended") or user.get("deleted") or user.get("is_deleted") or user.get("is_active") is False):
        return None
    return user


def otp_sandbox_enabled():
    return os.environ.get("AUTH_MODE", "live").lower() == "sandbox"


def require_otp_delivery():
    from sms import is_sms_configured
    if not is_sms_configured() and not otp_sandbox_enabled():
        raise HTTPException(status_code=503, detail="Vérification téléphonique temporairement indisponible")
