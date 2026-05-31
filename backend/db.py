"""MongoDB client singleton."""
import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def init_db() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is None:
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]
        _client = AsyncIOMotorClient(mongo_url)
        _db = _client[db_name]
    return _db


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        return init_db()
    return _db


def close_db():
    global _client, _db
    if _client:
        _client.close()
    _client = None
    _db = None
