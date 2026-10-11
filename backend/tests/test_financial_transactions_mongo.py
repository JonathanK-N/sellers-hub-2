"""Real replica-set crash boundaries and invariants, synthetic loopback only."""
import asyncio
import os
import uuid
import sys
from pathlib import Path
from urllib.parse import urlparse
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
import db as database_module
import financial_transactions as financial
from models import OrderCreateRequest, ConfirmDeliveryRequest
from routers import orders_router, delivery_router, disputes_router, wallet_router


async def isolated(operation, standalone=False):
    uri = os.environ.get("TEST_MONGO_URL" if standalone else "TEST_MONGO_TRANSACTION_URL")
    if not uri:
        pytest.skip("Explicit loopback MongoDB test URI required")
    if urlparse(uri).hostname not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("Synthetic financial tests require loopback MongoDB")
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=2000)
    db = client["afrimarket_finance_test_" + uuid.uuid4().hex]
    try:
        for collection in ["products", "sellers", "orders", "transactions", "order_groups", "checkout_requests", "withdrawal_requests", "withdrawals", "notifications", "notification_outbox", "fraud_outbox", "financial_ledger", "disputes", "deliverer_wallets", "deliverer_wallet_transactions"]:
            await db.create_collection(collection)
        await db.products.insert_one({"id":"p", "seller_id":"s", "name":"TEST", "price":100, "stock":3, "currency":"FC", "photos":[], "delivery_modes":["collect"], "is_active":True})
        await db.sellers.insert_one({"id":"s", "user_id":"seller", "shop_name":"TEST", "commission_rate":0.07})
        with patch.object(database_module, "_db", db):
            await operation(db)
    finally:
        await client.drop_database(db.name)
        client.close()


BUYER = {"id":"buyer", "role":"buyer", "currency":"FC", "country_code":"CD"}


async def checkout(key="TEST-key-0001"):
    req = OrderCreateRequest(items=[{"product_id":"p", "quantity":1}], delivery_mode="collect", payment_method="cash")
    return await orders_router.create_order(req, BUYER, key)


@pytest.mark.parametrize("boundary", ["products", "orders", "transactions", "order_groups", "fraud_outbox", "checkout_requests"])
def test_interruption_at_each_checkout_write_rolls_back_every_collection(boundary):
    async def scenario(db):
        async def fault(collection, operation):
            if collection == boundary:
                raise asyncio.CancelledError("Injected interrupted request")
        with patch.object(financial, "after_write", fault), pytest.raises(asyncio.CancelledError):
            await checkout()
        assert (await db.products.find_one({"id":"p"}))["stock"] == 3
        for name in ["orders", "transactions", "order_groups", "checkout_requests", "financial_ledger", "notifications", "notification_outbox", "fraud_outbox"]:
            assert await db[name].count_documents({}) == 0, name
        # New backend context after interruption can retry with the same key.
        result = await checkout()
        assert result["grand_total"] == 100
        assert (await db.products.find_one({"id":"p"}))["stock"] == 2
        assert financial.active_database.get() is None
    asyncio.run(isolated(scenario))


def test_checkout_replay_after_lost_response_does_not_reserve_twice():
    async def scenario(db):
        first = await checkout()
        replay = await checkout()
        assert first == replay
        assert await db.orders.count_documents({}) == 1
        assert (await db.products.find_one({"id":"p"}))["stock"] == 2
        req = OrderCreateRequest(items=[{"product_id":"p", "quantity":2}], delivery_mode="collect", payment_method="cash")
        with pytest.raises(HTTPException) as error:
            await orders_router.create_order(req, BUYER, "TEST-key-0001")
        assert error.value.status_code == 409
    asyncio.run(isolated(scenario))


def test_concurrent_checkouts_cannot_oversell():
    async def scenario(db):
        async def place(i):
            try:
                return await checkout("TEST-concurrent-" + str(i))
            except HTTPException as error:
                assert error.status_code in {400,409}
                return None
        results = await asyncio.gather(*(place(i) for i in range(12)))
        assert sum(r is not None for r in results) == 3
        assert await db.orders.count_documents({}) == 3
        assert await db.transactions.count_documents({}) == 3
        assert (await db.products.find_one({"id":"p"}))["stock"] == 0
    asyncio.run(isolated(scenario))


async def seed_delivery(db):
    order = {"id":"o", "buyer_id":"buyer", "seller_id":"s", "deliverer_id":"courier", "country_code":"CD", "delivery_mode":"delivery", "status":"out_for_delivery", "escrow_status":"held", "payment_method":"cash", "confirmation_code":"123456", "total_amount":100, "commission_amount":7, "delivery_fee":16000, "amount_due":16100, "currency":"FC", "timeline":[]}
    await db.orders.insert_one(order)
    await db.transactions.insert_one({"order_id":"o", "payment_status":"cash_pending"})


@pytest.mark.parametrize("boundary", ["orders", "transactions", "deliverer_wallets", "deliverer_wallet_transactions", "financial_ledger"])
def test_interruption_during_release_never_leaves_credit_or_released_escrow(boundary):
    async def scenario(db):
        await seed_delivery(db)
        async def fault(collection, operation):
            if collection == boundary:
                raise asyncio.CancelledError("Injected restart boundary")
        request = delivery_router.ConfirmCodeRequest(code="123456")
        user = {"id":"courier", "role":"deliverer"}
        with patch.object(financial, "after_write", fault), pytest.raises(asyncio.CancelledError):
            await delivery_router.deliverer_confirm("o", request, user)
        assert (await db.orders.find_one({"id":"o"}))["escrow_status"] == "held"
        assert (await db.transactions.find_one({"order_id":"o"}))["payment_status"] == "cash_pending"
        assert await db.deliverer_wallets.count_documents({}) == 0
        assert await db.financial_ledger.count_documents({}) == 0
        await delivery_router.deliverer_confirm("o", request, user)
        with pytest.raises(HTTPException):
            await delivery_router.deliverer_confirm("o", request, user)
        assert (await db.deliverer_wallets.find_one({"user_id":"courier"}))["balance"] == 11500
        journal = await db.financial_ledger.find_one({"_id":"release:o"})
        assert sum(line["minor"] for line in journal["lines"]) == 0
        assert await db.deliverer_wallet_transactions.count_documents({}) == 1
    asyncio.run(isolated(scenario))


def test_standalone_rejects_checkout_before_stock_mutation():
    async def scenario(db):
        with pytest.raises(HTTPException) as error:
            await checkout()
        assert error.value.status_code == 503
        assert (await db.products.find_one({"id":"p"}))["stock"] == 3
        assert await db.orders.count_documents({}) == 0
    asyncio.run(isolated(scenario, standalone=True))


def test_abrupt_backend_process_exit_rolls_back_and_restart_recovers():
    async def scenario(db):
        worker = Path(__file__).with_name("financial_crash_worker.py")
        child = await asyncio.create_subprocess_exec(sys.executable, str(worker), os.environ["TEST_MONGO_TRANSACTION_URL"], db.name, "transactions", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        try:
            stdout, stderr = await asyncio.wait_for(child.communicate(), timeout=45)
        except TimeoutError:
            child.kill()
            await child.wait()
            raise
        assert child.returncode == 73, stderr.decode(errors="replace")
        assert await db.orders.count_documents({}) == 0
        assert await db.transactions.count_documents({}) == 0
        assert (await db.products.find_one({"id":"p"}))["stock"] == 3
        # Driver waits for any server-side abandoned transaction to expire.
        result = await asyncio.wait_for(checkout("TEST-crash-key"), timeout=110)
        assert result["grand_total"] == 100
        assert await db.orders.count_documents({}) == 1
        assert (await db.products.find_one({"id":"p"}))["stock"] == 2
    asyncio.run(isolated(scenario))


@pytest.mark.parametrize("boundary", ["disputes", "orders", "transactions", "financial_ledger"])
def test_dispute_release_and_balanced_journal_commit_together(boundary):
    async def scenario(db):
        await db.orders.insert_one({"id":"disputed", "seller_id":"s", "order_group_id":"g", "escrow_status":"frozen", "payment_confirmed":True, "payment_method":"mobile_money", "total_amount":100, "commission_amount":7, "delivery_fee":0, "amount_due":100, "currency":"FC", "timeline":[]})
        await db.transactions.insert_one({"order_id":"disputed", "payment_status":"held"})
        await db.disputes.insert_one({"id":"d", "order_id":"disputed", "status":"open"})
        async def fault(collection, operation):
            if collection == boundary:
                raise asyncio.CancelledError("Interrupted dispute resolution")
        req = disputes_router.ResolveRequest(decision="release_seller")
        with patch.object(financial, "after_write", fault), pytest.raises(asyncio.CancelledError):
            await disputes_router.admin_resolve("d", req, {"role":"admin"})
        assert (await db.disputes.find_one({"id":"d"}))["status"] == "open"
        assert (await db.orders.find_one({"id":"disputed"}))["escrow_status"] == "frozen"
        assert (await db.transactions.find_one({"order_id":"disputed"}))["payment_status"] == "held"
        assert await db.financial_ledger.count_documents({}) == 0
        await disputes_router.admin_resolve("d", req, {"role":"admin"})
        journal = await db.financial_ledger.find_one({"_id":"release:disputed"})
        assert sum(line["minor"] for line in journal["lines"]) == 0
        with pytest.raises(HTTPException):
            await disputes_router.admin_resolve("d", req, {"role":"admin"})
        assert await db.financial_ledger.count_documents({}) == 1
    asyncio.run(isolated(scenario))


@pytest.mark.parametrize("boundary", ["sellers", "withdrawals", "financial_ledger", "withdrawal_requests"])
def test_withdrawal_interruption_and_replay_cannot_debit_twice(boundary):
    async def scenario(db):
        await db.orders.insert_one({"seller_id":"s", "total_amount":100, "commission_amount":7, "escrow_status":"released", "currency":"CDF"})
        user = {"id":"seller", "role":"seller", "currency":"CDF"}
        req = wallet_router.WithdrawRequest(amount=93, mobile_money_number="TEST", operator="TEST")
        async def fault(collection, operation):
            if collection == boundary:
                raise asyncio.CancelledError("Interrupted withdrawal")
        with patch.object(financial, "after_write", fault), pytest.raises(asyncio.CancelledError):
            await wallet_router.withdraw(req, user, "TEST-withdrawal-key")
        for name in ["withdrawals", "financial_ledger", "withdrawal_requests"]:
            assert await db[name].count_documents({}) == 0
        assert (await wallet_router._compute_balance(db, "s"))["available"] == 93
        first = await wallet_router.withdraw(req, user, "TEST-withdrawal-key")
        assert first == await wallet_router.withdraw(req, user, "TEST-withdrawal-key")
        assert await db.withdrawals.count_documents({}) == 1
        assert await db.financial_ledger.count_documents({}) == 1
        assert (await wallet_router._compute_balance(db, "s"))["available"] == 0
    asyncio.run(isolated(scenario))
