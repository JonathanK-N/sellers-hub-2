"""One-use, purpose-bound email links. Only token hashes are stored in this collection."""
import hashlib
import secrets
from datetime import timedelta
from fastapi import HTTPException
from pymongo import ReturnDocument
from .outbox import now


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


async def issue(db, purpose, user_id, minutes, **context):
    token = secrets.token_urlsafe(32)
    await db.email_tokens.insert_one({"_id": digest(token), "purpose": purpose,
        "user_id": user_id, "expires_at": now() + timedelta(minutes=minutes),
        "used": False, **context})
    return token


async def consume(db, token, purpose):
    if not 20 <= len(token) <= 200:
        raise HTTPException(400, "Lien invalide ou expiré")
    row = await db.email_tokens.find_one_and_update(
        {"_id": digest(token), "purpose": purpose, "used": False, "expires_at": {"$gt": now()}},
        {"$set": {"used": True}}, return_document=ReturnDocument.AFTER)
    if not row:
        raise HTTPException(400, "Lien invalide ou expiré")
    return row


async def allow_request(db, namespace, identity, maximum=5, seconds=900):
    bucket = int(now().timestamp()) // seconds
    key = digest(namespace + ":" + identity + ":" + str(bucket))
    row = await db.email_limits.find_one_and_update({"_id": key},
        {"$inc": {"count": 1}, "$setOnInsert": {"created_at": now()}},
        upsert=True, return_document=ReturnDocument.AFTER)
    return row["count"] <= maximum
