"""Withdrawal concurrency on an isolated replica set, no external transfers."""
import asyncio
import os
import uuid
from urllib.parse import urlparse
from unittest.mock import patch
import pytest
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from routers import wallet_router


async def scenario():
    uri = os.environ.get("TEST_MONGO_TRANSACTION_URL")
    if not uri:
        pytest.skip("BLOCKED: isolated replica-set test URL required")
    if urlparse(uri).hostname not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("Test writes require loopback MongoDB")
    client = AsyncIOMotorClient(uri)
    name = "afrimarket_wallet_test_" + uuid.uuid4().hex
    db = client[name]
    try:
        await db.sellers.insert_one({"id":"seller","user_id":"seller-user"})
        await db.orders.insert_one({"seller_id":"seller","total_amount":100,"commission_amount":0,"escrow_status":"released"})
        await db.withdrawals.create_index("id", unique=True)
        request = wallet_router.WithdrawRequest(amount=10, mobile_money_number="TEST", operator="sandbox")
        with patch.object(wallet_router,"get_db",return_value=db):
            async def withdraw():
                try:
                    await wallet_router.withdraw(request, {"id":"seller-user","role":"seller","currency":"CDF"})
                    return "reserved"
                except HTTPException as error:
                    assert error.status_code in {400,409}
                    return "rejected"
            results = await asyncio.gather(*(withdraw() for _ in range(20)))
        assert results.count("reserved") == 10
        assert results.count("rejected") == 10
        assert await db.withdrawals.count_documents({}) == 10
        assert (await wallet_router._compute_balance(db,"seller"))["available"] == 0
    finally:
        await client.drop_database(name)
        client.close()


def test_competing_withdrawals_cannot_overdraw_balance():
    asyncio.run(scenario())
