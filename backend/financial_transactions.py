"""Atomic MongoDB financial operations. Author: Jonathan Kakesa (JonathanK-N)."""
from contextvars import ContextVar
from functools import wraps

from fastapi import HTTPException
from pymongo.errors import PyMongoError
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern
from pymongo.read_preferences import ReadPreference

active_database = ContextVar("financial_database", default=None)


async def after_write(collection, operation):
    """Deterministic fault-injection seam; never controlled by request or env."""
    return None


class SessionCollection:
    """Bind every read and write to the same transaction, including cursors."""
    def __init__(self, collection, session):
        self.collection = collection
        self.session = session

    def __getattr__(self, name):
        method = getattr(self.collection, name)
        if not callable(method):
            return method

        def arguments(kwargs):
            supplied = kwargs.get("session")
            if supplied is not None and supplied is not self.session:
                raise RuntimeError("Foreign MongoDB session in financial operation")
            kwargs["session"] = self.session
            return kwargs

        if name in {"insert_one", "insert_many", "update_one", "update_many", "delete_one", "delete_many", "replace_one", "find_one_and_update"}:
            async def write(*args, **kwargs):
                result = await method(*args, **arguments(kwargs))
                await after_write(self.collection.name, name)
                return result
            return write

        def call(*args, **kwargs):
            arguments(kwargs)
            return method(*args, **kwargs)
        return call


class SessionDatabase:
    def __init__(self, database, session):
        self.database = database
        self.session = session

    def __getitem__(self, name):
        return SessionCollection(self.database[name], self.session)

    def __getattr__(self, name):
        if name in {"client", "name"}:
            return getattr(self.database, name)
        return self[name]


async def run_transaction(database, operation):
    """Driver retries transient aborts and unknown commit outcomes safely.

    Callbacks must contain MongoDB work only: no payment/SMS/push network calls.
    An unavailable topology never falls back to non-transactional writes.
    """
    try:
        topology = await database.client.admin.command("hello")
        if not (topology.get("setName") or topology.get("msg") == "isdbgrid"):
            raise HTTPException(503, "Opération financière indisponible : MongoDB transactionnel requis")
        async with await database.client.start_session() as session:
            async def callback(current_session):
                bound = SessionDatabase(database, current_session)
                token = active_database.set(bound)
                try:
                    return await operation(bound)
                finally:
                    active_database.reset(token)
            return await session.with_transaction(
                callback, read_concern=ReadConcern("snapshot"),
                write_concern=WriteConcern("majority"),
                read_preference=ReadPreference.PRIMARY, max_commit_time_ms=10000,
            )
    except PyMongoError as error:
        # Do not expose connection strings or claim that an ambiguous commit failed.
        raise HTTPException(503, "Résultat financier indisponible ; vérifiez son état avant toute nouvelle tentative") from error


def atomic_operation(function):
    """Financial route boundary with isolated context for concurrent requests."""
    @wraps(function)
    async def wrapped(*args, **kwargs):
        from db import get_db
        database = get_db()
        async def operation(bound):
            return await function(*args, **kwargs)
        return await run_transaction(database, operation)
    return wrapped
