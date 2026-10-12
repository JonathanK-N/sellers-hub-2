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


async def checkout(mode="collect", key="TEST-direct-key-0001"):
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
