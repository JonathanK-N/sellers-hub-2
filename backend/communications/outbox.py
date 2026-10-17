"""Persistent Resend outbox with immutable encrypted payloads and bounded retries."""
import hashlib
import json
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from cryptography.fernet import Fernet
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from .config import configuration, mailbox

logger = logging.getLogger(__name__)
TEST_RECIPIENTS = {"delivered@resend.dev", "bounced@resend.dev", "complained@resend.dev"}


def now():
    return datetime.now(timezone.utc)


def cipher():
    # A dedicated key is required; rotating it requires draining/re-encrypting the queue.
    return Fernet(os.environ["EMAIL_OUTBOX_KEY"].encode("ascii"))


def recipient_hash(address):
    return hashlib.sha256(mailbox(address).encode()).hexdigest()


async def enqueue(db, event_key, recipient, subject, html, text, expires_at=None):
    config = configuration()
    if config["mode"] == "disabled":
        return None
    address = mailbox(recipient)
    if config["mode"] == "test" and address not in TEST_RECIPIENTS:
        raise ValueError("Test mode only permits Resend test recipients")
    if not event_key or len(event_key) > 512 or not text.strip():
        raise ValueError("A stable event key and plain text are required")
    item_id = hashlib.sha256((event_key + "\0" + address).encode()).hexdigest()
    payload = {"from": config["from"], "reply_to": config["reply_to"], "to": [address],
               "subject": subject, "html": html, "text": text}
    encrypted = cipher().encrypt(json.dumps(payload, ensure_ascii=False).encode()).decode()
    # _id uniqueness works without a new index or migration, including in transactions.
    await db.email_outbox.update_one({"_id": item_id}, {"$setOnInsert": {
        "payload": encrypted, "recipient_hash": recipient_hash(address), "status": "pending",
        "attempts": 0, "created_at": now(), "due_at": now(), "mode": config["mode"],
        "expires_at": expires_at,
    }}, upsert=True)
    return item_id


def retry_delay(response, attempts):
    delay = min(3600, 15 * (2 ** min(attempts, 8))) + secrets.randbelow(10)
    if response is not None:
        try:
            delay = max(delay, float(response.headers.get("retry-after", 0)))
        except (TypeError, ValueError):
            pass
    return delay


async def process_one(db, client=None):
    config = configuration()
    if config["mode"] == "disabled":
        return False
    current = now()
    # A crash after HTTP acceptance is ambiguous. Reuse the same key only inside 24h.
    await db.email_outbox.update_many(
        {"status": "sending", "lease_until": {"$lt": current}},
        {"$set": {"status": "pending", "due_at": current}})
    item = await db.email_outbox.find_one_and_update(
        {"status": "pending", "due_at": {"$lte": current}, "mode": config["mode"]},
        {"$set": {"status": "sending", "lease_until": current + timedelta(minutes=2)},
         "$inc": {"attempts": 1}}, return_document=ReturnDocument.AFTER)
    if not item:
        return False
    identity = {"_id": item["_id"], "status": "sending", "attempts": item["attempts"]}

    async def finish(**values):
        await db.email_outbox.update_one(identity, {"$set": values})

    first = item.get("first_attempt_at")
    if item.get("expires_at") and item["expires_at"].replace(tzinfo=timezone.utc) <= current:
        await finish(status="expired", error="link_expired")
        return True
    if first and (current - first.replace(tzinfo=timezone.utc)).total_seconds() >= 23 * 3600:
        await finish(status="reconciliation_required", error="idempotency_window")
        return True
    if await db.email_suppressions.find_one({"_id": item["recipient_hash"]}):
        await finish(status="suppressed")
        return True
    # Global database lease throttles all workers; conservative one request / second.
    try:
        slot = await db.email_rate.find_one_and_update(
            {"_id": "resend", "$or": [{"until": {"$lte": current}}, {"until": {"$exists": False}}]},
            {"$set": {"until": current + timedelta(seconds=1)}}, upsert=True,
            return_document=ReturnDocument.AFTER)
    except DuplicateKeyError:
        slot = None
    if not slot:
        await db.email_outbox.update_one(identity, {"$set": {"status": "pending",
            "due_at": current + timedelta(seconds=2)}, "$inc": {"attempts": -1}})
        return True
    response = None
    try:
        payload = json.loads(cipher().decrypt(item["payload"].encode()))
        if config["mode"] == "test" and payload["to"][0] not in TEST_RECIPIENTS:
            await finish(status="failed", error="test_recipient")
            return True
        await db.email_outbox.update_one(identity, {"$set": {"first_attempt_at": first or current}})
        headers = {"Authorization": "Bearer " + config["key"], "Idempotency-Key": "afrimarket/" + item["_id"]}
        if client is None:
            async with httpx.AsyncClient(timeout=15) as transport:
                response = await transport.post("https://api.resend.com/emails", json=payload, headers=headers)
        else:
            response = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
        if response.status_code in (200, 201):
            message_id = response.json().get("id")
            if not isinstance(message_id, str) or not message_id:
                raise ValueError("Missing provider message id")
            await finish(status="accepted", provider_id=message_id, accepted_at=now(), error=None)
            return True
        if response.status_code not in (408, 409, 429) and response.status_code < 500:
            await finish(status="failed", error="provider_" + str(response.status_code))
            return True
    except Exception:
        # Never log payloads, recipient addresses, API responses or exception strings.
        logger.warning("Transactional email attempt unavailable")
    delay = retry_delay(response, item["attempts"])
    await finish(status="pending" if item["attempts"] < 10 else "reconciliation_required",
                 due_at=now() + timedelta(seconds=delay), error="retryable")
    return True
