"""Verify Svix signatures on raw bytes and persist replay-safe delivery facts."""
import base64
import hashlib
import hmac
import json
import time


def verify(raw, headers, secret, clock=None):
    if not secret or len(raw) > 262144:
        raise ValueError("Invalid webhook")
    try:
        event_id = headers["svix-id"]
        timestamp = headers["svix-timestamp"]
        if not event_id or len(event_id) > 200 or abs((clock or time.time)() - int(timestamp)) > 300:
            raise ValueError("Invalid webhook")
        key = base64.b64decode(secret.removeprefix("whsec_"), validate=True)
        signed = event_id.encode() + b"." + timestamp.encode() + b"." + raw
        expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
        signatures = headers["svix-signature"].split()
        if not any(hmac.compare_digest(signature, "v1," + expected) for signature in signatures):
            raise ValueError("Invalid webhook")
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("Invalid webhook")
        return event_id, payload
    except (KeyError, TypeError, OverflowError, UnicodeError) as exc:
        raise ValueError("Invalid webhook") from exc


async def handle(db, event_id, payload):
    kind = payload.get("type")
    status = {"email.sent": "accepted", "email.delivered": "delivered",
              "email.bounced": "bounced", "email.complained": "complained",
              "email.delivery_delayed": "delayed", "email.failed": "failed"}.get(kind)
    message_id = payload.get("data", {}).get("email_id")
    if not status or not isinstance(message_id, str):
        return {"ok": True, "ignored": True}
    # Store only non-sensitive facts. Replaying a partially handled event resumes it.
    await db.email_webhooks.update_one({"_id": event_id}, {"$setOnInsert": {
        "provider_id": message_id, "type": kind, "status": "pending"}}, upsert=True)
    event = await db.email_webhooks.find_one({"_id": event_id})
    if event.get("status") == "completed":
        return {"ok": True}
    item = await db.email_outbox.find_one({"provider_id": message_id})
    if not item:
        # Acceptance may not yet be committed; return retryable status at the HTTP boundary.
        return {"ok": False}
    if status in ("bounced", "complained"):
        await db.email_suppressions.update_one({"_id": item["recipient_hash"]},
            {"$set": {"reason": status}}, upsert=True)
    rank = {"sending": 0, "accepted": 1, "delayed": 2, "delivered": 3, "failed": 4, "bounced": 5, "complained": 6}
    allowed = [state for state, value in rank.items() if value <= rank[status]]
    await db.email_outbox.update_one({"_id": item["_id"], "status": {"$in": allowed}},
                                   {"$set": {"status": status}})
    await db.email_webhooks.update_one({"_id": event_id}, {"$set": {"status": "completed"}})
    return {"ok": True}
