"""Account transitions and committed notification isolation on disposable MongoDB."""
import asyncio
import os
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from auth import active_workspace, create_access_token, get_current_user_dep, require_role
from test_communications import isolated


def request(token):
    return Request({"type": "http", "headers": [(b"authorization", ("Bearer " + token).encode())]})


@pytest.mark.parametrize("role", ["admin", "deliverer", "seller"])
def test_token_cannot_grant_roles(role):
    assert active_workspace({"role": "buyer"}, {"role": role})["role"] == "buyer"
    assert active_workspace({"role": "buyer", "seller_enabled": True}, {"role": role})["role"] == ("seller" if role == "seller" else "buyer")
    assert active_workspace({"role": "deliverer"}, {"role": role})["role"] == "deliverer"


def test_buyer_becomes_seller_without_losing_buyer_identity_or_history():
    async def run(db):
        import db as database
        from routers.auth_router import become_seller, switch_role, WorkspaceRequest
        from routers.sellers_router import setup_boutique
        from models import SellerSetupRequest
        buyer = {"id": "buyer", "role": "buyer", "name": "Fixture", "phone_verified": True,
                 "country_code": "CD", "email_verified": True, "email": "delivered@resend.dev"}
        await db.users.insert_one(buyer.copy())
        await db.orders.insert_one({"id": "existing-purchase", "buyer_id": "buyer"})
        with patch.object(database, "_db", db), patch.dict(os.environ, {"JWT_SECRET": "synthetic-session-key-for-isolated-tests"}):
            sessions = await asyncio.gather(*(become_seller(buyer) for _ in range(3)))
            seller = await get_current_user_dep(request(sessions[0]["token"]))
            assert seller["role"] == "seller" and seller["account_role"] == "buyer"
            assert "password_hash" not in sessions[0]["user"]
            await require_role("seller")(seller)
            with pytest.raises(HTTPException):
                await require_role("admin")(seller)
            shops = await asyncio.gather(*(setup_boutique(SellerSetupRequest(shop_name="Fixture shop"), seller) for _ in range(3)))
            assert len({shop["id"] for shop in shops}) == 1
            assert await db.sellers.count_documents({"user_id": "buyer"}) == 1
            assert shops[0]["badge_verified"] is False
            back = await switch_role(WorkspaceRequest(role="buyer"), seller)
            restored = await get_current_user_dep(request(back["token"]))
            assert restored["role"] == "buyer" and restored["email_verified"]
            assert await db.orders.count_documents({"buyer_id": restored["id"]}) == 1
            stored = await db.users.find_one({"id": "buyer"})
            assert stored["role"] == "buyer" and stored["seller_enabled"] is True
            # Revocation applies to both spaces.
            await db.users.update_one({"id": "buyer"}, {"$inc": {"auth_version": 1}})
            with pytest.raises(HTTPException):
                await get_current_user_dep(request(sessions[0]["token"]))
    asyncio.run(isolated(run))


@pytest.mark.parametrize("changes", [{"role": "admin"}, {"phone_verified": False}, {"banned": True}, {"suspended": True}, {"is_active": False}])
def test_seller_activation_fails_closed(changes):
    async def run(db):
        import db as database
        from routers.auth_router import become_seller, switch_role, WorkspaceRequest
        user = {"id": "fixture", "role": "buyer", "phone_verified": True, **changes}
        await db.users.insert_one(user.copy())
        with patch.object(database, "_db", db):
            with pytest.raises(HTTPException):
                await become_seller(user)
            with pytest.raises(HTTPException):
                await switch_role(WorkspaceRequest(role="seller"), user)
        assert not (await db.users.find_one({"id": "fixture"})).get("seller_enabled")
    asyncio.run(isolated(run))


def test_verification_newest_link_only_and_account_conflict_rolls_back():
    async def run(db):
        import db as database
        from communications import router as routes, tokens
        user = {"id": "fixture", "name": "Fixture", "role": "buyer", "email": "old@resend.dev", "email_verified": True}
        await db.users.insert_one(user.copy())
        await db.email_accounts.insert_one({"_id": user["email"], "user_id": user["id"]})
        with patch.object(database, "_db", db):
            old = await tokens.issue(db, "verify_email", user["id"], 60, email="delivered@resend.dev")
            await routes.request_verification(routes.Address(email="delivered@resend.dev"), user)
            with pytest.raises(HTTPException):
                await routes.verify_email(routes.Token(token=old), current=user)
            stored = await db.users.find_one({"id": user["id"]})
            assert stored["email"] == "old@resend.dev" and stored["email_verified"]
            # Issue a controlled token after the request to exercise consumption and rollback.
            value = await tokens.issue(db, "verify_email", user["id"], 60, email="delivered@resend.dev")
            with pytest.raises(HTTPException) as conflict:
                await routes.verify_email(routes.Token(token=value), current={"id": "other"})
            assert conflict.value.status_code == 409
            assert not (await db.email_tokens.find_one({"_id": tokens.digest(value)}))["used"]
            await routes.verify_email(routes.Token(token=value), current=user)
            verified = await db.users.find_one({"id": user["id"]})
            assert verified["email"] == "delivered@resend.dev" and verified["email_verified"]
            assert await db.email_accounts.find_one({"_id": "old@resend.dev"}) is None
            count = await db.email_outbox.count_documents({})
            assert (await routes.request_verification(routes.Address(email=verified["email"]), verified))["verified"]
            assert await db.email_outbox.count_documents({}) == count
    asyncio.run(isolated(run))


def test_realtime_stream_is_private_committed_and_rechecks_session():
    async def run(db):
        import db as database
        from routers.notifications_router import notification_stream
        user = {"id": "fixture", "role": "buyer"}
        await db.users.insert_one(user.copy())
        # Ensure collection exists before opening its change stream.
        await db.notifications.insert_one({"user_id": "other", "read": False})
        with patch.object(database, "_db", db), patch.dict(os.environ, {"JWT_SECRET": "synthetic-session-key-for-isolated-tests"}):
            token = create_access_token(user["id"], "buyer")
            req = request(token)
            # Direct generator execution supplies a nonblocking disconnect probe.
            async def connected():
                return False
            req.is_disconnected = connected
            response = await notification_stream(req, user)
            stream = response.body_iterator
            assert response.headers["cache-control"] == "no-store"
            assert "changed" in await anext(stream)
            await db.notifications.insert_one({"user_id": "other", "body": "private other account"})
            await db.notifications.insert_one({"user_id": "fixture", "body": "private fixture"})
            event = await asyncio.wait_for(anext(stream), 5)
            assert event == "event: changed\ndata: {}\n\n" and "private" not in event
            await db.users.update_one({"id": "fixture"}, {"$set": {"banned": True}})
            with patch("routers.notifications_router.time.monotonic", return_value=10**12):
                event = await asyncio.wait_for(anext(stream), 5)
                if event.startswith(": heartbeat"):
                    event = await asyncio.wait_for(anext(stream), 5)
                assert "expired" in event
            await stream.aclose()
    asyncio.run(isolated(run))


def test_converted_seller_accepts_messages_and_direct_checkout():
    from test_launch_direct_mongo import isolated as commerce, checkout, BUYER, SELLER
    async def run(db):
        from routers.messages_router import _participants
        await db.users.update_one({"id": SELLER["id"]}, {"$set": {"role": "buyer", "seller_enabled": True}})
        with patch.dict(os.environ, {"COMMERCE_CHECKOUT_MODE": "direct", "EMAIL_MODE": "disabled"}):
            order = await checkout(key="onboarding-direct-fixture")
            assert order["buyer_id"] == BUYER["id"] and order["seller_id"] == "shop"
            assert (await _participants(db, "buyer__shop", BUYER, writing=True))[0] == BUYER["id"]
            assert (await _participants(db, "buyer__shop", SELLER, writing=True))[1] == "shop"
    asyncio.run(commerce(run))
