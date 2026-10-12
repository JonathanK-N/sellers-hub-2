"""Direct commerce invariants. Author: Jonathan Kakesa (JonathanK-N)."""
import asyncio
import os
import uuid
from urllib.parse import urlparse
from unittest.mock import patch
import pytest
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
import db as database_module
import financial_transactions as financial
from models import OrderCreateRequest, ConfirmDeliveryRequest
from routers import orders_router as orders, direct_payments_router as direct, disputes_router as disputes

BUYER = {"id": "buyer", "role": "buyer", "country_code": "CD", "currency": "FC"}
SELLER = {"id": "seller", "role": "seller", "country_code": "CD", "currency": "FC"}


async def isolated(callback):
    uri = os.environ.get("TEST_MONGO_TRANSACTION_URL")
    if not uri:
        pytest.skip("Explicit loopback replica-set URI required")
    if urlparse(uri).hostname not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("Direct tests require isolated loopback MongoDB")
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=3000)
    db = client["afrimarket_test_launch_direct_" + uuid.uuid4().hex]
    try:
        for name in ["orders", "transactions", "order_groups", "checkout_requests", "financial_ledger", "notifications", "notification_outbox", "fraud_outbox", "disputes", "deliverer_wallets", "deliverer_wallet_transactions", "withdrawals"]:
            await db.create_collection(name)
        await db.users.insert_many([BUYER, SELLER])
        await db.sellers.insert_one({"id": "shop", "user_id": "seller", "shop_name": "TEST", "delivery_service": "self", "commission_rate": .07})
        await db.products.insert_one({"id": "product", "seller_id": "shop", "name": "TEST", "stock": 3, "price": 100, "currency": "FC", "photos": [], "is_active": True, "delivery_modes": ["delivery", "collect"]})
        with patch.object(database_module, "_db", db):
            await callback(db)
    finally:
        await client.drop_database(db.name)
        client.close()


async def checkout(mode="collect", key="TEST000000001"):
    req = OrderCreateRequest(items=[{"product_id": "product", "quantity": 1}], delivery_mode=mode, payment_method="direct")
    return (await orders.create_order(req, BUYER, key))["orders"][0]


async def no_funds(db):
    for name in ["transactions", "financial_ledger", "withdrawals", "deliverer_wallets", "deliverer_wallet_transactions"]:
        assert await db[name].count_documents({}) == 0, name
    async for order in db.orders.find({}):
        assert order["escrow_status"] == "not_applicable"
        assert order["payment_confirmed"] is False
        assert order["commission_amount"] == 0


def test_direct_checkout_replay_and_full_pickup_never_create_funds():
    async def run(db):
        order = await checkout()
        assert (await checkout())["id"] == order["id"]
        assert (await db.products.find_one({"id": "product"}))["stock"] == 2
        with pytest.raises(HTTPException):
            await orders.advance_order(order["id"], SELLER)
        await direct.declare_payment(order["id"], direct.DeclarationRequest(action="buyer_declared"), BUYER)
        await direct.declare_payment(order["id"], direct.DeclarationRequest(action="seller_received"), SELLER)
        await direct.declare_payment(order["id"], direct.DeclarationRequest(action="seller_received"), SELLER)
        assert len((await db.orders.find_one({"id": order["id"]}))["payment_history"]) == 2
        await orders.advance_order(order["id"], SELLER)
        await orders.advance_order(order["id"], SELLER)
        result = await orders.confirm_collect(order["id"], SELLER)
        assert result["status"] == "collected"
        await no_funds(db)
    asyncio.run(isolated(run))


def test_direct_delivery_code_finalizes_logistics_only():
    async def run(db):
        order = await checkout("delivery")
        await direct.declare_payment(order["id"], direct.DeclarationRequest(action="seller_received"), SELLER)
        await orders.advance_order(order["id"], SELLER)
        await orders.advance_order(order["id"], SELLER)
        with pytest.raises(HTTPException):
            await orders.confirm_delivery(order["id"], ConfirmDeliveryRequest(code="incorrect"), BUYER)
        result = await orders.confirm_delivery(order["id"], ConfirmDeliveryRequest(code=order["confirmation_code"]), BUYER)
        assert result["status"] == "delivered"
        assert result["payment_verified_by_platform"] is False
        await no_funds(db)
    asyncio.run(isolated(run))


def test_cancel_replays_restore_stock_once_and_do_not_refund():
    async def run(db):
        order = await checkout()
        for _ in range(2):
            assert (await direct.cancel_direct(order["id"], BUYER))["automatic_refund"] is False
        assert (await db.products.find_one({"id": "product"}))["stock"] == 3
        await no_funds(db)
    asyncio.run(isolated(run))


def test_declarations_are_role_bound_and_dispute_never_freezes_or_credits_funds():
    async def run(db):
        order = await checkout()
        for actor in [BUYER, {"id": "foreign", "role": "seller"}]:
            with pytest.raises(HTTPException):
                await direct.declare_payment(order["id"], direct.DeclarationRequest(action="seller_received"), actor)
        await direct.declare_payment(order["id"], direct.DeclarationRequest(action="seller_received"), SELLER)
        await direct.declare_payment(order["id"], direct.DeclarationRequest(action="buyer_disagrees"), BUYER)
        dispute = await direct.dispute_direct(order["id"], direct.DirectDisputeRequest(reason="TEST disagreement"), SELLER)
        with pytest.raises(HTTPException):
            await orders.advance_order(order["id"], SELLER)
        with pytest.raises(HTTPException):
            await disputes.admin_resolve(dispute["id"], disputes.ResolveRequest(decision="refund_buyer"), {"id": "admin", "role": "admin"})
        result = await disputes.admin_resolve(dispute["id"], disputes.ResolveRequest(decision="close_direct", note="TEST mediation; no platform transfer"), {"id": "admin", "role": "admin"})
        assert result["automatic_refund"] is False
        await no_funds(db)
    asyncio.run(isolated(run))


@pytest.mark.parametrize("boundary", ["products", "orders", "order_groups", "checkout_requests"])
def test_interrupted_direct_checkout_rolls_back_stock_and_all_orders(boundary):
    async def run(db):
        async def fault(collection, operation):
            if collection == boundary:
                raise asyncio.CancelledError("Synthetic interruption")
        with patch.object(financial, "after_write", fault), pytest.raises(asyncio.CancelledError):
            await checkout()
        assert (await db.products.find_one({"id": "product"}))["stock"] == 3
        assert await db.orders.count_documents({}) == 0
        await checkout()
        await no_funds(db)
    asyncio.run(isolated(run))


def test_direct_orders_concurrent_stock_limit_is_respected():
    async def run(db):
        async def place():
            try:
                await checkout(key="TEST-direct-" + uuid.uuid4().hex)
                return True
            except HTTPException as error:
                assert error.status_code in {400, 409}
                return False
        result = await asyncio.gather(*(place() for _ in range(10)))
        assert sum(result) == 3
        assert await db.orders.count_documents({}) == 3
        await no_funds(db)
    asyncio.run(isolated(run))


def test_default_checkout_rejects_legacy_cash_and_unknown_methods(monkeypatch):
    monkeypatch.delenv("COMMERCE_CHECKOUT_MODE", raising=False)
    async def run(db):
        req = OrderCreateRequest(items=[{"product_id": "product", "quantity": 1}], delivery_mode="collect", payment_method="cash")
        with pytest.raises(HTTPException) as error:
            await orders.create_order(req, BUYER, "TEST-default-cash-key")
        assert error.value.status_code == 409
        assert (await db.products.find_one({"id": "product"}))["stock"] == 3
    asyncio.run(isolated(run))


def test_disabled_provider_never_emits_even_with_credentials(monkeypatch):
    from payments.service import CinetPayProvider
    monkeypatch.delenv("CINETPAY_ENABLED", raising=False)
    monkeypatch.setenv("CINETPAY_API_KEY", "TEST-disabled-key")
    monkeypatch.setenv("CINETPAY_SITE_ID", "TEST-disabled-site")
    with patch("payments.service.httpx.AsyncClient") as client:
        result = asyncio.run(CinetPayProvider().collect("TEST", 100, "CDF", "TEST-disabled"))
        assert not result.ok
        asyncio.run(CinetPayProvider().check("TEST-disabled"))
        client.assert_not_called()


def test_usd_delivery_never_adds_cdf_tier_as_usd():
    async def run(db):
        await db.products.update_one({"id": "product"}, {"$set": {"currency": "USD", "price": 10}})
        order = await checkout("delivery")
        assert order["total_amount"] == 10
        assert order["delivery_fee"] == 0
        assert order["amount_due"] == 10
        assert order["delivery_fee_status"] == "to_arrange_with_seller"
        await no_funds(db)
    asyncio.run(isolated(run))


def test_multiple_sellers_cannot_declare_or_message_another_sellers_order():
    from routers import messages_router as messages
    async def run(db):
        await db.users.insert_one({"id": "seller-two", "role": "seller"})
        await db.sellers.insert_one({"id": "shop-two", "user_id": "seller-two", "shop_name": "TEST 2"})
        await db.products.insert_one({"id": "product-two", "seller_id": "shop-two", "name": "TEST 2", "price": 200, "stock": 1, "currency": "FC", "photos": [], "delivery_modes": ["collect"], "is_active": True})
        req = OrderCreateRequest(items=[{"product_id": "product", "quantity": 1}, {"product_id": "product-two", "quantity": 1}], delivery_mode="collect", payment_method="direct")
        result = await orders.create_order(req, BUYER, "TEST-multiseller-0001")
        assert len(result["orders"]) == 2 and result["grand_total"] == 300
        other_order = next(o for o in result["orders"] if o["seller_id"] == "shop-two")
        with pytest.raises(HTTPException):
            await direct.declare_payment(other_order["id"], direct.DeclarationRequest(action="seller_received"), SELLER)
        with pytest.raises(HTTPException):
            await messages.send_message(messages.SendMessageRequest(seller_id="shop", order_id=other_order["id"], text="TEST wrong context", client_message_id="TEST-message-0001"), BUYER)
        assert await db.messages.count_documents({}) == 0
        own = await orders.my_orders(SELLER)
        assert len(own) == 1 and own[0]["seller_id"] == "shop"
        assert "confirmation_code" not in own[0] and "qr_code" not in own[0]
        await no_funds(db)
    asyncio.run(isolated(run))


def test_suspended_seller_cannot_receive_checkout_stock_is_untouched():
    async def run(db):
        await db.users.update_one({"id": "seller"}, {"$set": {"suspended": True}})
        with pytest.raises(HTTPException) as error:
            await checkout()
        assert error.value.status_code == 409
        assert (await db.products.find_one({"id": "product"}))["stock"] == 3
        assert await db.orders.count_documents({}) == 0
    asyncio.run(isolated(run))


def test_direct_courier_delivery_and_dispute_gates_never_credit_a_wallet():
    from routers import delivery_router as delivery
    async def run(db):
        courier = {"id": "courier", "role": "deliverer", "country_code": "CD", "currency": "FC", "name": "TEST courier"}
        await db.users.insert_one(courier)
        order = await checkout("delivery")
        await direct.declare_payment(order["id"], direct.DeclarationRequest(action="seller_received"), SELLER)
        await delivery.assign_deliverer(order["id"], delivery.AssignRequest(deliverer_id="courier"), SELLER)
        await delivery.mark_picked_up(order["id"], courier)
        dispute = await direct.dispute_direct(order["id"], direct.DirectDisputeRequest(reason="TEST held shipment"), BUYER)
        with pytest.raises(HTTPException):
            await delivery.mark_en_route(order["id"], courier)
        await disputes.admin_resolve(dispute["id"], disputes.ResolveRequest(decision="close_direct", note="TEST solved"), {"id": "admin", "role": "admin"})
        await delivery.mark_en_route(order["id"], courier)
        await delivery.deliverer_confirm(order["id"], delivery.ConfirmCodeRequest(code=order["confirmation_code"]), courier)
        earnings = await delivery.deliverer_earnings(courier)
        assert earnings["completed_all"] == 1
        assert earnings["earnings_today"] == 0
        await no_funds(db)
    asyncio.run(isolated(run))


def test_assignment_racing_payment_disagreement_never_assigns_unreceived_order():
    from routers import delivery_router as delivery
    async def run(db):
        courier = {"id": "courier", "role": "deliverer", "country_code": "CD", "name": "TEST courier"}
        await db.users.insert_one(courier)
        await db.products.update_one({"id": "product"}, {"$set": {"stock": 20}})
        async def allowed(operation):
            try:
                await operation
            except HTTPException as error:
                assert error.status_code == 409
        for index in range(10):
            order = await checkout("delivery", "TEST-assignment-race-" + str(index))
            await direct.declare_payment(order["id"], direct.DeclarationRequest(action="seller_received"), SELLER)
            await asyncio.gather(
                allowed(delivery.assign_deliverer(order["id"], delivery.AssignRequest(deliverer_id="courier"), SELLER)),
                allowed(direct.declare_payment(order["id"], direct.DeclarationRequest(action="buyer_disagrees"), BUYER)),
            )
            saved = await db.orders.find_one({"id": order["id"]})
            assert saved["status"] != "assigned" or saved["payment_status"] == "seller_declared_received"
        await no_funds(db)
    asyncio.run(isolated(run))


def test_real_http_registration_login_messages_and_expired_session(monkeypatch):
    import secrets
    import httpx
    import jwt
    import server
    from auth import JWT_ALGORITHM
    from seed_data import COUNTRIES
    monkeypatch.setenv("AUTH_MODE", "sandbox")
    monkeypatch.setenv("AT_USERNAME", "")
    monkeypatch.setenv("AT_API_KEY", "")
    monkeypatch.setenv("CINETPAY_ENABLED", "false")
    monkeypatch.setenv("COMMERCE_CHECKOUT_MODE", "direct")
    secret = secrets.token_hex(32)
    monkeypatch.setenv("JWT_SECRET", secret)
    async def run(db):
        await db.countries.insert_one(dict(COUNTRIES[0]))
        transport = httpx.ASGITransport(app=server.app, client=("127.0.0.2", 12345))
        async with httpx.AsyncClient(transport=transport, base_url="http://localhost") as client:
            identities = {}
            password = secrets.token_urlsafe(20)
            for index, role in enumerate(["buyer", "seller", "deliverer"]):
                phone = "+24300000001" + str(index)
                registration = await client.post("/api/auth/register", json={"name": "TEST " + role, "phone": phone, "role": role, "country_code": "CD", "password": password})
                assert registration.status_code == 200, registration.text
                verification = await client.post("/api/auth/verify-otp", json={"phone": phone, "code": registration.json()["otp_dev"]})
                assert verification.status_code == 200
                login = await client.post("/api/auth/login", json={"phone": phone, "password": password})
                assert login.status_code == 200
                identities[role] = login.json()
            buyer = identities["buyer"]
            seller = identities["seller"]
            headers = lambda who: {"Authorization": "Bearer " + identities[who]["access_token"]}
            setup = await client.post("/api/seller/setup", headers=headers("seller"), json={"shop_name": "TEST HTTP shop"})
            assert setup.status_code == 200, setup.text
            shop = setup.json()["id"]
            contact = await client.put("/api/seller/whatsapp", headers=headers("seller"), json={"phone": seller["user"]["phone"], "visible": True})
            assert contact.status_code == 200
            payload = {"seller_id": shop, "text": "<img src=x onerror=alert(1)>", "client_message_id": "TEST-http-message-0001"}
            sent = await client.post("/api/messages", headers=headers("buyer"), json=payload)
            assert sent.status_code == 201, sent.text
            replay = await client.post("/api/messages", headers=headers("buyer"), json=payload)
            assert replay.status_code == 201 and replay.json()["id"] == sent.json()["id"]
            conversation = buyer["user"]["id"] + "__" + shop
            endpoint = "/api/messages/conversations/" + conversation + "/history"
            history = await client.get(endpoint, headers=headers("seller"))
            assert history.status_code == 200 and len(history.json()["messages"]) == 1
            assert (await client.get(endpoint, headers=headers("deliverer"))).status_code == 403
            assert (await client.get(endpoint)).status_code in {401, 403}
            expired = jwt.encode({"sub": buyer["user"]["id"], "role": "buyer", "type": "access", "exp": 1}, secret, algorithm=JWT_ALGORITHM)
            assert (await client.get(endpoint, headers={"Authorization": "Bearer " + expired})).status_code == 401
            await db.users.update_one({"id": buyer["user"]["id"]}, {"$set": {"suspended": True}})
            assert (await client.get(endpoint, headers=headers("buyer"))).status_code == 403
            assert await db.messages.count_documents({"conversation_id": conversation}) == 1
            await no_funds(db)
    asyncio.run(isolated(run))
