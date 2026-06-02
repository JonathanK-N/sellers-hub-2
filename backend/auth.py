"""Phone+OTP authentication with JWT."""
import os
import random
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
    return f"{random.randint(0, 999999):06d}"


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_DAYS),
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])


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
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "otp_code": 0, "otp_expires_at": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user_dep)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Accès refusé")
        return user
    return checker
