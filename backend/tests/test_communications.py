"""Transactional email safety and official templates. Author: JonathanK-N."""
import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import urlparse

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient

from communications import outbox, tokens, webhooks
from communications.config import configuration
from communications.render import CATALOG, render
from communications.affiliation import can_assign, compatible
from communications.router import router
from auth import create_access_token, decode_token, get_current_user_dep


def context():
    result = {field: "Texte synthétique" for item in CATALOG.values() for field in item["required"]}
    return {**result, "prenom": '<script>alert("x")</script>', "logo_url": "https://afri-market.app/assets/email/afrimarket-official.png",
        "lien_action": "https://afri-market.app/email/verify#token=synthetic-only"}


@pytest.mark.parametrize("name", list(CATALOG))
def test_official_templates_escape_and_produce_text(name):
    subject, html, text = render(name, context())
    assert subject and text and "https://afri-market.app" in text
    assert "<script>" not in html and "&lt;script&gt;" in html
    assert "data:image" not in html and "{{" not in html
    assert '<table' in html and '#078747' in html


@pytest.mark.parametrize("url", ["javascript:alert(1)", "http://afri-market.app", "https://user:secret@host/", "https://host/\n"])
def test_template_links_reject_unsafe_urls(url):
    with pytest.raises(ValueError):
        render("welcome", {**context(), "lien_action": url})


def test_required_variables_and_disabled_default():
    with pytest.raises(ValueError):
        render("welcome", {})
    with patch.dict(os.environ, {}, clear=True):
        assert configuration()["mode"] == "disabled"


def signed(raw, timestamp=None):
    key = b"synthetic webhook fixture only"
    timestamp = str(int(time.time()) if timestamp is None else timestamp)
    event_id = "fixture-delivery"
    signature = base64.b64encode(hmac.new(key, event_id.encode() + b"." + timestamp.encode() + b"." + raw, hashlib.sha256).digest()).decode()
    return {"svix-id": event_id, "svix-timestamp": timestamp, "svix-signature": "v1," + signature}, "whsec_" + base64.b64encode(key).decode()


def test_webhook_raw_bytes_timestamp_and_rotation():
    raw = b'{"type":"email.delivered","data":{"email_id":"fixture"}}'
    headers, secret = signed(raw)
    assert webhooks.verify(raw, headers, secret)[1]["type"] == "email.delivered"
    assert webhooks.verify(raw, {**headers, "svix-signature": "v1,invalid " + headers["svix-signature"]}, secret)
    for invalid in (raw + b" ", b"{}"):
        with pytest.raises(ValueError):
            webhooks.verify(invalid, headers, secret)
    old, secret = signed(raw, int(time.time()) - 301)
    with pytest.raises(ValueError):
        webhooks.verify(raw, old, secret)


def test_affiliation_is_exclusive():
    assert can_assign({"is_active": True, "affiliation": "afrimarket"}, "any")
    assert can_assign({"is_active": True, "affiliation": "shop", "seller_id": "a"}, "a")
    assert not can_assign({"is_active": True, "affiliation": "shop", "seller_id": "a"}, "b")
    assert not can_assign({}, "a")
    assert not compatible({"affiliation": "afrimarket"}, "shop", "a")


def test_delivery_assignments_after_explicit_synthetic_affiliation_migration():
    async def run(db):
        import db as database_module
        from routers import delivery_router as delivery
        from unittest.mock import AsyncMock
        owner = {"id": "synthetic-owner", "role": "seller"}
        await db.sellers.insert_one({"id": "synthetic-shop", "user_id": owner["id"]})
        await db.users.insert_one({"id": "synthetic-driver", "role": "deliverer",
                                  "name": "Synthetic driver", "country_code": "CD"})
        await db.deliverers.insert_one({"user_id": "synthetic-driver", "is_active": True})
        def order(identifier):
            return {"id": identifier, "seller_id": "synthetic-shop", "country_code": "CD",
                    "delivery_mode": "delivery", "status": "confirmed", "payment_method": "direct",
                    "payment_status": "seller_declared_received", "revision": 0}
        await db.orders.insert_many([order("unapproved"), order("network"), order("own-shop"),
                                     order("other-shop"), order("inactive")])
        request = delivery.AssignRequest(deliverer_id="synthetic-driver")
        with patch.object(database_module, "_db", db), patch.object(delivery, "create_notification", new_callable=AsyncMock):
            with pytest.raises(HTTPException) as failure:
                await delivery.assign_deliverer("unapproved", request, owner)
            assert failure.value.status_code == 409
            assert (await db.orders.find_one({"id": "unapproved"}))["status"] == "confirmed"
            # Explicit decisions apply to this fixture only; no inference from an account's role.
            await db.deliverers.update_one({"user_id": "synthetic-driver"}, {"$set": {"affiliation": "afrimarket"}})
            assert (await delivery.assign_deliverer("network", request, owner))["status"] == "assigned"
            await db.deliverers.update_one({"user_id": "synthetic-driver"},
                {"$set": {"affiliation": "shop", "seller_id": "synthetic-shop"}})
            assert (await delivery.assign_deliverer("own-shop", request, owner))["status"] == "assigned"
            await db.deliverers.update_one({"user_id": "synthetic-driver"}, {"$set": {"seller_id": "synthetic-other"}})
            with pytest.raises(HTTPException):
                await delivery.assign_deliverer("other-shop", request, owner)
            await db.deliverers.update_one({"user_id": "synthetic-driver"},
                {"$set": {"affiliation": "afrimarket", "is_active": False}})
            with pytest.raises(HTTPException):
                await delivery.assign_deliverer("inactive", request, owner)
            assert await db.orders.count_documents({"status": "assigned"}) == 2
    asyncio.run(isolated(run))


def test_preview_requires_admin():
    app = FastAPI()
    app.include_router(router)
    async def buyer():
        return {"id": "buyer", "role": "buyer"}
    app.dependency_overrides[get_current_user_dep] = buyer
    with TestClient(app) as client:
        assert client.get("/communications/admin/templates").status_code == 403


async def isolated(callback):
    uri = os.getenv("TEST_MONGO_TRANSACTION_URL")
    if not uri:
        pytest.skip("Explicit loopback replica set required")
    if urlparse(uri).hostname not in ("127.0.0.1", "localhost"):
        raise RuntimeError("Tests only permit loopback Mongo")
    client = AsyncIOMotorClient(uri, tz_aware=True, serverSelectionTimeoutMS=3000)
    db = client["afrimarket_test_emails_" + uuid.uuid4().hex]
    env = {"EMAIL_MODE": "test", "RESEND_API_KEY": "synthetic-transport-fixture",
        "EMAIL_FROM": "AfriMarket <fixture@afri-market.app>", "EMAIL_REPLY_TO": "fixture@afri-market.app",
        "FRONTEND_URL": "https://afri-market.app", "EMAIL_LOGO_URL": context()["logo_url"],
        "EMAIL_OUTBOX_KEY": Fernet.generate_key().decode()}
    try:
        with patch.dict(os.environ, env):
            await callback(db)
    finally:
        await client.drop_database(db.name)
        client.close()


def test_outbox_duplicate_acceptance_delivery_complaint_and_suppression():
    async def run(db):
        subject, html, text = render("welcome", context())
        async def queue():
            return await outbox.enqueue(db, "welcome/fixture", "delivered@resend.dev", subject, html, text)
        ids = await asyncio.gather(*[queue() for _ in range(5)])
        assert len(set(ids)) == 1 and await db.email_outbox.count_documents({}) == 1
        row = await db.email_outbox.find_one({"_id": ids[0]})
        assert "synthetic-only" not in row["payload"] and "delivered@resend.dev" not in row["payload"]
        seen = []
        def transport(request):
            seen.append(request)
            return httpx.Response(200, json={"id": "provider-fixture"})
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            await asyncio.gather(outbox.process_one(db, client), outbox.process_one(db, client))
        assert len(seen) == 1
        assert (await db.email_outbox.find_one({"_id": ids[0]}))["status"] == "accepted"
        await webhooks.handle(db, "delivery-fixture", {"type": "email.delivered", "data": {"email_id": "provider-fixture"}})
        assert (await db.email_outbox.find_one({"_id": ids[0]}))["status"] == "delivered"
        complaint = {"type": "email.complained", "data": {"email_id": "provider-fixture"}}
        await webhooks.handle(db, "complaint-fixture", complaint)
        await webhooks.handle(db, "complaint-fixture", complaint)
        await webhooks.handle(db, "late-sent-fixture", {"type": "email.sent", "data": {"email_id": "provider-fixture"}})
        assert (await db.email_outbox.find_one({"_id": ids[0]}))["status"] == "complained"
        assert await db.email_suppressions.count_documents({}) == 1
    asyncio.run(isolated(run))


def test_retry_reuses_frozen_payload_and_stops_after_window():
    async def run(db):
        item = await outbox.enqueue(db, "retry/fixture", "delivered@resend.dev", "Fixture", "<p>Fixture</p>", "Fixture")
        requests = []
        def transport(request):
            requests.append(request)
            return httpx.Response(429, headers={"Retry-After": "120"})
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            await outbox.process_one(db, client)
            row = await db.email_outbox.find_one({"_id": item})
            assert row["due_at"] >= outbox.now() + timedelta(seconds=115)
            await db.email_rate.delete_many({})
            await db.email_outbox.update_one({"_id": item}, {"$set": {"due_at": outbox.now()}})
            await outbox.process_one(db, client)
            assert requests[0].content == requests[1].content
            assert requests[0].headers["Idempotency-Key"] == requests[1].headers["Idempotency-Key"]
            await db.email_outbox.update_one({"_id": item}, {"$set": {
                "first_attempt_at": outbox.now() - timedelta(hours=24), "due_at": outbox.now()}})
            await outbox.process_one(db, client)
            assert (await db.email_outbox.find_one({"_id": item}))["status"] == "reconciliation_required"
            assert len(requests) == 2
        with pytest.raises(ValueError):
            await outbox.enqueue(db, "not-permitted", "client@example.com", "Fixture", "Fixture", "Fixture")
    asyncio.run(isolated(run))


def test_token_expiration_purpose_and_single_use():
    async def run(db):
        value = await tokens.issue(db, "password_reset", "fixture", 30)
        stored = await db.email_tokens.find_one({})
        assert value not in json.dumps(stored, default=str)
        with pytest.raises(HTTPException):
            await tokens.consume(db, value, "verify_email")
        outcomes = await asyncio.gather(tokens.consume(db, value, "password_reset"), tokens.consume(db, value, "password_reset"), return_exceptions=True)
        assert sum(isinstance(item, dict) for item in outcomes) == 1
        expired = await tokens.issue(db, "password_reset", "fixture", -1)
        with pytest.raises(HTTPException):
            await tokens.consume(db, expired, "password_reset")
    asyncio.run(isolated(run))


def test_email_verification_reset_revokes_existing_sessions_atomically():
    async def run(db):
        import db as database_module
        from communications import router as routes
        from starlette.requests import Request
        user = {"id": "buyer", "role": "buyer", "name": "Fixture", "email_verified": False}
        await db.users.insert_one(user.copy())
        with patch.object(database_module, "_db", db), patch.dict(os.environ, {"JWT_SECRET": "synthetic-session-key-for-isolated-tests"}):
            value = await tokens.issue(db, "verify_email", "buyer", 30, email="delivered@resend.dev")
            await routes.verify_email(routes.Token(token=value))
            with pytest.raises(HTTPException):
                await routes.verify_email(routes.Token(token=value))
            verified = await db.users.find_one({"id": "buyer"})
            assert verified["email_verified"] is True
            session = create_access_token("buyer", "buyer")
            reset = await tokens.issue(db, "password_reset", "buyer", 30, email="delivered@resend.dev")
            await routes.reset_password(routes.Reset(token=reset, password="fixture-long-password"))
            changed = await db.users.find_one({"id": "buyer"})
            assert changed["auth_version"] == 1
            assert "fixture-long-password" not in changed["password_hash"]
            request = Request({"type": "http", "headers": [(b"authorization", ("Bearer " + session).encode())]})
            with pytest.raises(HTTPException) as failure:
                await get_current_user_dep(request)
            assert failure.value.status_code == 401
            with pytest.raises(HTTPException):
                await routes.reset_password(routes.Reset(token=reset, password="other-long-password"))
            assert await db.email_outbox.count_documents({}) == 2  # Welcome + password change.
    asyncio.run(isolated(run))


def test_invitation_ownership_cancellation_resend_acceptance_and_affiliation():
    async def run(db):
        import re
        import db as database_module
        from communications import invitations as routes
        owner = {"id": "seller", "role": "seller", "name": "Owner"}
        buyer = {"id": "buyer", "role": "buyer", "name": "Recipient", "email": "delivered@resend.dev", "email_verified": True}
        await db.users.insert_many([owner.copy(), buyer.copy()])
        await db.sellers.insert_one({"id": "shop", "user_id": "seller", "shop_name": "Fixture shop"})
        async def latest_token():
            messages = await db.email_outbox.find({}).sort("created_at", -1).to_list(10)
            html = json.loads(outbox.cipher().decrypt(messages[0]["payload"].encode()))["html"]
            return re.search(r"#token=([A-Za-z0-9_-]+)", html).group(1)
        with patch.object(database_module, "_db", db):
            item = await routes.invite(routes.InvitationRequest(email=buyer["email"], name="Recipient"), owner)
            first = await latest_token()
            with pytest.raises(HTTPException):
                await routes.manage(item["id"], "cancel", {"id": "other", "role": "seller"})
            await routes.manage(item["id"], "cancel", owner)
            with pytest.raises(HTTPException):
                await routes.accept(routes.Token(token=first), buyer)
            await routes.manage(item["id"], "resend", owner)
            second = await latest_token()
            assert first != second
            with pytest.raises(HTTPException):
                await routes.accept(routes.Token(token=first), buyer)
            with pytest.raises(HTTPException):
                await routes.accept(routes.Token(token=second), {**buyer, "email": "other@resend.dev"})
            await db.deliverers.insert_one({"user_id": "buyer", "affiliation": "afrimarket"})
            with pytest.raises(HTTPException):
                await routes.accept(routes.Token(token=second), buyer)
            await db.deliverers.delete_many({})
            result = await routes.accept(routes.Token(token=second), buyer)
            assert result["next"] == "/become-deliverer?shop=shop"
            assert await db.deliverers.count_documents({}) == 0
            assert (await db.users.find_one({"id": "buyer"}))["role"] == "buyer"
            with pytest.raises(HTTPException):
                await routes.accept(routes.Token(token=second), buyer)
    asyncio.run(isolated(run))


def test_transaction_abort_never_leaks_queued_message():
    async def run(db):
        from financial_transactions import run_transaction
        # Create collection outside the transaction so rollback assertions also work on older Mongo.
        await db.create_collection("email_outbox")
        async def operation(bound):
            await outbox.enqueue(bound, "abort/fixture", "delivered@resend.dev", "Fixture", "<p>Fixture</p>", "Fixture")
            raise RuntimeError("synthetic abort")
        with pytest.raises(RuntimeError):
            await run_transaction(db, operation)
        assert await db.email_outbox.count_documents({}) == 0
    asyncio.run(isolated(run))


def test_disabled_transport_never_reads_database_or_sends():
    async def run():
        with patch.dict(os.environ, {"EMAIL_MODE": "disabled"}):
            assert await outbox.process_one(None) is False
            assert await outbox.enqueue(None, "disabled", "client@example.com", "Fixture", "Fixture", "Fixture") is None
    asyncio.run(run())


def test_malformed_mode_blocks_email_without_breaking_business_notification():
    async def run():
        from communications.events import emit
        from communications.business import from_notification, verified_payment
        with patch.dict(os.environ, {"EMAIL_MODE": '"disabled",'}):
            with pytest.raises(ValueError):
                configuration()
            assert await emit(None, "welcome", "fixture", {}) is None
            assert await from_notification(None, "fixture", "order_received", "Nouvelle commande", {}) is None
            assert await verified_payment(None, {}, "SUCCESS", "fixture") is None
            from communications.router import enabled
            with pytest.raises(HTTPException) as unavailable:
                enabled()
            assert unavailable.value.status_code == 503
    asyncio.run(run())


def test_expired_link_never_reaches_transport():
    async def run(db):
        item = await outbox.enqueue(db, "expired/fixture", "delivered@resend.dev", "Fixture", "Fixture", "Fixture",
            expires_at=outbox.now() - timedelta(seconds=1))
        def forbidden(request):
            raise AssertionError("Expired link must never reach provider")
        async with httpx.AsyncClient(transport=httpx.MockTransport(forbidden)) as client:
            await outbox.process_one(db, client)
        assert (await db.email_outbox.find_one({"_id": item}))["status"] == "expired"
    asyncio.run(isolated(run))


def test_provider_suppression_is_persistent_and_blocks_next_message():
    async def run(db):
        first = await outbox.enqueue(db, "provider-suppressed/first", "delivered@resend.dev", "Fixture", "Fixture", "Fixture")
        await db.email_outbox.update_one({"_id": first}, {"$set": {"provider_id": "suppressed-fixture", "status": "accepted"}})
        result = await webhooks.handle(db, "suppressed-event", {"type": "email.suppressed", "data": {"email_id": "suppressed-fixture"}})
        assert result["ok"] is True
        assert (await db.email_outbox.find_one({"_id": first}))["status"] == "suppressed"
        second = await outbox.enqueue(db, "provider-suppressed/next", "delivered@resend.dev", "Fixture", "Fixture", "Fixture")
        await outbox.process_one(db)
        assert (await db.email_outbox.find_one({"_id": second}))["status"] == "suppressed"
        assert await db.email_suppressions.count_documents({}) == 1
    asyncio.run(isolated(run))


def test_direct_payment_declaration_never_emits_confirmation():
    async def run(db):
        from communications.business import from_notification, verified_payment
        from unittest.mock import AsyncMock
        with patch("communications.business.emit", new=AsyncMock()) as emit:
            await from_notification(db, "buyer", "order_received", "Déclaration de paiement direct", {"order_id": "fixture"})
            await verified_payment(db, {"payment_method": "direct"}, "SUCCESS", "fixture")
            await verified_payment(db, {"payment_method": "cash"}, "SUCCESS", "fixture")
            emit.assert_not_awaited()
    asyncio.run(isolated(run))


def test_concurrent_approvals_cannot_create_incompatible_affiliations():
    async def run(db):
        import db as database_module
        from routers import deliverer_applications_router as routes
        for collection in ("deliverers", "notifications", "notification_outbox", "email_outbox"):
            await db.create_collection(collection)
        await db.users.insert_one({"id": "candidate", "role": "buyer", "name": "Fixture"})
        await db.sellers.insert_one({"id": "shop", "user_id": "seller"})
        await db.deliverer_applications.insert_many([
            {"id": "network", "user_id": "candidate", "application_type": "afrimarket", "status": "pending"},
            {"id": "exclusive", "user_id": "candidate", "application_type": "shop", "seller_id": "shop", "status": "pending"},
        ])
        with patch.object(database_module, "_db", db):
            results = await asyncio.gather(
                routes.admin_approve_application("network", {"id": "admin", "role": "admin"}),
                routes.seller_approve_application("exclusive", {"id": "seller", "role": "seller"}), return_exceptions=True)
            assert sum(isinstance(value, dict) for value in results) == 1
            assert sum(isinstance(value, HTTPException) and value.status_code == 409 for value in results) == 1
            assert await db.deliverers.count_documents({"user_id": "candidate"}) == 1
            assert await db.deliverer_applications.count_documents({"status": "approved"}) == 1
    asyncio.run(isolated(run))


def test_phone_otp_reset_keeps_existing_flow_and_queues_password_change():
    async def run(db):
        import db as database_module
        from routers import auth_router as routes
        from models import SetPasswordRequest
        phone = "+243000000001"
        await db.users.insert_one({"id": "phone-fixture", "role": "buyer", "phone": phone,
            "name": "Fixture", "email": "delivered@resend.dev", "email_verified": True})
        await db.otp_codes.insert_one({"phone": phone, "code": "123456", "expires_at": outbox.now() + timedelta(minutes=5)})
        with patch.object(database_module, "_db", db), patch.dict(os.environ, {"JWT_SECRET": "synthetic-session-key-for-isolated-tests"}):
            result = await routes.reset_password(SetPasswordRequest(phone=phone, code="123456", new_password="fixture-new-password"))
            assert decode_token(result["access_token"])["av"] == 1
            assert not ({"password_hash", "otp_code"} & result["user"].keys())
            assert await db.otp_codes.count_documents({}) == 0
            assert await db.email_outbox.count_documents({}) == 1
    asyncio.run(isolated(run))
