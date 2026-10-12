"""Synthetic loopback messaging regressions. Author: Jonathan Kakesa (JonathanK-N)."""
import asyncio
import os
import uuid
from urllib.parse import urlparse
from unittest.mock import patch
import pytest
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import ValidationError
from routers import messages_router as messages

BUYER = {"id": "buyer", "role": "buyer"}
SELLER = {"id": "seller-user", "role": "seller"}


async def isolated(callback):
    uri = os.environ.get("TEST_MONGO_URL")
    if not uri:
        pytest.skip("Explicit loopback TEST_MONGO_URL required")
    if urlparse(uri).hostname not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("Messaging tests require isolated loopback MongoDB")
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=2000)
    db = client["afrimarket_test_launch_" + uuid.uuid4().hex]
    try:
        await db.users.insert_many([BUYER, SELLER, {"id": "other", "role": "buyer"}])
        await db.sellers.insert_one({"id": "shop", "user_id": SELLER["id"], "shop_name": "TEST"})
        await db.products.insert_one({"id": "product", "seller_id": "shop", "is_active": True})
        await db.orders.insert_one({"id": "order", "buyer_id": "buyer", "seller_id": "shop"})
        with patch.object(messages, "get_db", return_value=db):
            await callback(db)
    finally:
        await client.drop_database(db.name)
        client.close()


def request(text="TEST message", key="synthetic-message-0001", **extra):
    return messages.SendMessageRequest(seller_id="shop", client_message_id=key, text=text, **extra)


def test_concurrent_replays_create_one_message_and_notification():
    async def run(db):
        rows = await asyncio.gather(*(messages.send_message(request(), BUYER) for _ in range(15)))
        assert len({r["id"] for r in rows}) == 1
        assert await db.messages.count_documents({}) == 1
        assert await db.notifications.count_documents({}) == 1
        assert (await messages.unread_count(SELLER))["count"] == 1
        with pytest.raises(HTTPException) as error:
            await messages.send_message(request("Changed payload"), BUYER)
        assert error.value.status_code == 409
    asyncio.run(isolated(run))


def test_participant_and_order_product_idor_checks_precede_mutation():
    async def run(db):
        await messages.send_message(request(order_id="order", product_id="product"), BUYER)
        for user in [{"id": "other", "role": "buyer"}, {"id": "other", "role": "seller"}, {"id": "admin", "role": "admin"}]:
            with pytest.raises(HTTPException):
                await messages.history("buyer__shop", user, 50, None, None)
        await db.orders.insert_one({"id": "foreign", "buyer_id": "other", "seller_id": "shop"})
        with pytest.raises(HTTPException) as error:
            await messages.send_message(request(key="synthetic-message-0002", order_id="foreign"), BUYER)
        assert error.value.status_code == 404
        with pytest.raises(HTTPException):
            await messages.send_message(request(key="synthetic-message-0003", product_id="foreign-product"), BUYER)
        assert await db.messages.count_documents({}) == 1
    asyncio.run(isolated(run))


def test_pagination_returns_complete_history_without_duplicates_and_incremental_tail():
    async def run(db):
        await db.messages.insert_many([{"id": "legacy-" + str(i).zfill(3), "conversation_id": "buyer__shop", "buyer_id": "buyer", "seller_id": "shop", "from_user_id": "buyer", "to_user_id": "seller-user", "text": "TEST", "read": False, "created_at": "2026-01-01T00:00:00+00:00"} for i in range(125)])
        first = await messages.history("buyer__shop", SELLER, 50, None, None)
        second = await messages.history("buyer__shop", SELLER, 50, first["next_before"], None)
        third = await messages.history("buyer__shop", SELLER, 50, second["next_before"], None)
        assert len(first["messages"]) == len(second["messages"]) == 50
        assert len(third["messages"]) == 25 and not third["has_more"]
        assert len({m["id"] for page in [first, second, third] for m in page["messages"]}) == 125
        await messages.mark_read("buyer__shop", messages.ReadRequest(through=first["latest_cursor"]), SELLER)
        assert (await messages.unread_count(SELLER))["count"] == 0
        sent = await messages.send_message(request(), BUYER)
        tail = await messages.history("buyer__shop", SELLER, 50, None, first["latest_cursor"])
        assert [m["id"] for m in tail["messages"]] == [sent["id"]]
        assert (await messages.unread_count(SELLER))["count"] == 1
    asyncio.run(isolated(run))


def test_disabled_counterparty_cannot_receive_new_messages_but_history_is_preserved():
    async def run(db):
        await messages.send_message(request(), BUYER)
        await db.users.update_one({"id": "seller-user"}, {"$set": {"suspended": True}})
        with pytest.raises(HTTPException) as error:
            await messages.send_message(request(key="synthetic-message-0002"), BUYER)
        assert error.value.status_code == 409
        assert len((await messages.history("buyer__shop", BUYER, 50, None, None))["messages"]) == 1
    asyncio.run(isolated(run))


def test_rate_limit_blocks_message_31_without_persisting_it():
    async def run(db):
        for i in range(30):
            await messages.send_message(request(key="synthetic-rate-" + str(i)), BUYER)
        with pytest.raises(HTTPException) as error:
            await messages.send_message(request(key="synthetic-rate-blocked"), BUYER)
        assert error.value.status_code == 429
        assert await db.messages.count_documents({}) == 30
        assert await db.notifications.count_documents({}) == 30
    asyncio.run(isolated(run))


def test_plain_text_xss_payload_is_preserved_as_text_not_interpreted_by_backend():
    async def run(db):
        text = '<script>window.privateLeak = true</script>'
        sent = await messages.send_message(request(text), BUYER)
        assert sent["text"] == text
        assert "request_hash" not in sent and "_id" not in sent
        assert (await db.notifications.find_one({}))["body"] == "Un participant vous a envoyé un message."
    asyncio.run(isolated(run))


@pytest.mark.parametrize("payload", [{"text": "x" * 2001}, {"text": "TEST", "seller_id": {"$ne": None}}])
def test_model_rejects_oversize_and_operator_injection(payload):
    with pytest.raises(ValidationError):
        messages.SendMessageRequest(**payload)


def test_malformed_cursor_is_rejected():
    with pytest.raises(HTTPException) as error:
        messages._decode_cursor("not-a-valid-cursor")
    assert error.value.status_code == 422
