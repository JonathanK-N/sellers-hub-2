"""Abrupt backend-process termination fixture; synthetic loopback DB only."""
import asyncio
import os
import sys
from urllib.parse import urlparse
from motor.motor_asyncio import AsyncIOMotorClient
import db as database_module
import financial_transactions
from models import OrderCreateRequest
from routers.orders_router import create_order


async def main():
    uri, name, boundary = sys.argv[1:]
    if urlparse(uri).hostname not in {"127.0.0.1", "localhost"} or not name.startswith("afrimarket_finance_test_"):
        raise RuntimeError("Crash fixture requires synthetic loopback DB")
    database_module._db = AsyncIOMotorClient(uri)[name]
    async def terminate(collection, operation):
        if collection == boundary:
            os._exit(73)
    financial_transactions.after_write = terminate
    req = OrderCreateRequest(items=[{"product_id":"p","quantity":1}],delivery_mode="collect",payment_method="cash")
    await create_order(req,{"id":"buyer","role":"buyer","currency":"FC","country_code":"CD"},"TEST-crash-key")


asyncio.run(main())
