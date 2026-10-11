"""Real Mongo regressions. Only an explicit loopback test database is allowed."""
import asyncio
import os
import uuid
from types import SimpleNamespace
from urllib.parse import urlparse
from unittest.mock import AsyncMock, patch
import pytest
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from models import OrderCreateRequest
from routers import orders_router, products_router


def test_product_search_treats_regex_characters_as_literal_text():
    async def run():
        uri = os.environ.get("TEST_MONGO_URL")
        if not uri:
            pytest.skip("TEST_MONGO_URL required")
        if urlparse(uri).hostname not in {"localhost", "127.0.0.1"}:
            raise RuntimeError("Test writes require loopback MongoDB")
        client = AsyncIOMotorClient(uri)
        db = client["afrimarket_test_" + uuid.uuid4().hex]
        try:
            await db.products.insert_one({"id": "literal", "seller_id": "s", "name": "TEST [ bracket", "description": "TEST", "is_active": True, "country_code": "CD", "price": 1, "currency": "FC"})
            with patch.object(products_router, "get_db", return_value=db):
                async def search(q):
                    return await products_router.list_products(q=q, category=None, country_code="CD", lat=None, lng=None, radius_km=50, verified_only=False, sort="newest", limit=60)
                assert [p["id"] for p in await search("[")] == ["literal"]
                assert await search(".*") == []
        finally:
            await client.drop_database(db.name)
            client.close()
    asyncio.run(run())

async def scenario(fail_persistence=False):
    uri = os.environ.get("TEST_MONGO_URL")
    if not uri:
        pytest.skip("BLOCKED: explicit isolated TEST_MONGO_URL required")
    if urlparse(uri).hostname not in {"localhost","127.0.0.1"}:
        raise RuntimeError("Test writes require loopback MongoDB")
    client = AsyncIOMotorClient(uri)
    name = "afrimarket_test_" + uuid.uuid4().hex
    db = client[name]
    try:
        await db.products.create_index("id",unique=True)
        await db.products.insert_one({"id":"p","seller_id":"s","name":"TEST product","price":100,"stock":3,"currency":"FC","photos":[],"delivery_modes":["collect"],"is_active":True})
        await db.sellers.insert_one({"id":"s","user_id":"seller","shop_name":"TEST shop","commission_rate":0.07})
        proxy = SimpleNamespace(**{key:db[key] for key in ["products","sellers","orders","transactions","order_groups"]})
        req = OrderCreateRequest(items=[{"product_id":"p","quantity":1}],delivery_mode="collect",payment_method="cash")
        buyer = {"id":"buyer","role":"buyer","currency":"FC","country_code":"CD"}
        with patch.object(orders_router,"get_db",return_value=proxy),patch.object(orders_router,"create_notification",new=AsyncMock()),patch("fraud.evaluate_and_log",new=AsyncMock()):
            if fail_persistence:
                with patch.object(proxy.transactions,"insert_one",new=AsyncMock(side_effect=RuntimeError("test write failure"))):
                    with pytest.raises(RuntimeError):
                        await orders_router.create_order(req,buyer)
                assert (await db.products.find_one({"id":"p"}))["stock"] == 3
                assert await db.orders.count_documents({}) == 0
                assert await db.order_groups.count_documents({}) == 0
            else:
                async def place():
                    try:
                        await orders_router.create_order(req,buyer)
                        return "created"
                    except HTTPException as error:
                        assert error.status_code in {400,409}
                        return "rejected"
                results = await asyncio.gather(*(place() for _ in range(20)))
                assert results.count("created") == 3
                assert results.count("rejected") == 17
                assert (await db.products.find_one({"id":"p"}))["stock"] == 0
                assert await db.orders.count_documents({}) == 3
                assert await db.transactions.count_documents({}) == 3
                assert await db.order_groups.count_documents({}) == 3
    finally:
        await client.drop_database(name)
        client.close()

def test_twenty_competing_orders_cannot_oversell_three_units():
    asyncio.run(scenario())

def test_failed_transaction_document_restores_stock_and_cleans_order():
    asyncio.run(scenario(fail_persistence=True))
