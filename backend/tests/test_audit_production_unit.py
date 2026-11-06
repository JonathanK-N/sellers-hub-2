"""Régressions de l'audit de production : surface exposée et durcissements."""
import importlib

import pytest
from fastapi.testclient import TestClient


def reload_server(monkeypatch, **env):
    for key in ("ENABLE_API_DOCS", "CORS_ORIGINS", "MAINTENANCE_MODE"):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    import server
    return importlib.reload(server)


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_api_docs_are_hidden_by_default(monkeypatch, path):
    server = reload_server(monkeypatch)
    response = TestClient(server.app).get(path)
    assert response.status_code == 404


@pytest.mark.parametrize("path", ["/docs", "/openapi.json"])
def test_api_docs_can_be_enabled_for_development(monkeypatch, path):
    server = reload_server(monkeypatch, ENABLE_API_DOCS="true")
    response = TestClient(server.app).get(path)
    assert response.status_code == 200


def test_wildcard_cors_never_reflects_origin_with_credentials(monkeypatch):
    server = reload_server(monkeypatch, CORS_ORIGINS="*")
    client = TestClient(server.app)
    response = client.get("/api/", headers={"Origin": "https://evil.example", "Cookie": "access_token=x"})
    assert response.headers.get("access-control-allow-origin") == "*"
    assert "access-control-allow-credentials" not in response.headers
    preflight = client.options("/api/orders", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
    assert preflight.status_code == 200
    assert "authorization" in preflight.headers.get("access-control-allow-headers", "").lower()
    assert "access-control-allow-credentials" not in preflight.headers


def test_explicit_cors_origins_keep_credentials_for_listed_origins_only(monkeypatch):
    server = reload_server(monkeypatch, CORS_ORIGINS=" https://app.example ,https://admin.example")
    client = TestClient(server.app)
    allowed = client.get("/api/", headers={"Origin": "https://app.example"})
    assert allowed.headers.get("access-control-allow-origin") == "https://app.example"
    assert allowed.headers.get("access-control-allow-credentials") == "true"
    denied = client.get("/api/", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in denied.headers


# ---------------------------------------------------------------------------
# Base Mongo minimale en mémoire pour les compteurs anti-abus
# ---------------------------------------------------------------------------
import asyncio
import copy
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException


def _matches(doc, query):
    return all(doc.get(k) == v for k, v in query.items())


class FakeCollection:
    def __init__(self, docs=None):
        self.docs = [dict(d) for d in (docs or [])]

    async def find_one(self, query, projection=None, **_):
        for doc in self.docs:
            if _matches(doc, query):
                return copy.deepcopy(doc)
        return None

    async def find_one_and_update(self, query, update, upsert=False, return_document=None, projection=None, **_):
        target = next((d for d in self.docs if _matches(d, query)), None)
        if target is None:
            if not upsert:
                return None
            target = dict(query)
            target.update(update.get("$setOnInsert", {}))
            self.docs.append(target)
        for key, value in update.get("$inc", {}).items():
            target[key] = target.get(key, 0) + value
        target.update(update.get("$set", {}))
        return copy.deepcopy(target)

    async def update_one(self, query, update, upsert=False, **_):
        target = next((d for d in self.docs if _matches(d, query)), None)
        if target is None and upsert:
            target = dict(query)
            self.docs.append(target)
        if target is not None:
            for key, value in update.get("$inc", {}).items():
                target[key] = target.get(key, 0) + value
            target.update(update.get("$set", {}))
        return SimpleNamespace(matched_count=int(target is not None), modified_count=int(target is not None))

    async def delete_one(self, query):
        for doc in self.docs:
            if _matches(doc, query):
                self.docs.remove(doc)
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)


class FakeDb:
    def __init__(self, **collections):
        self._collections = {name: FakeCollection(docs) for name, docs in collections.items()}

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return self._collections.setdefault(name, FakeCollection())


PHONE = "+243810000000"


def otp_db(code="123456"):
    future = datetime.now(timezone.utc) + timedelta(minutes=5)
    return FakeDb(
        users=[{"id": "u1", "phone": PHONE, "role": "buyer", "name": "Test", "auth_version": 0}],
        otp_codes=[{"phone": PHONE, "code": code, "expires_at": future}],
    )


def test_phone_otp_is_invalidated_after_five_wrong_attempts(monkeypatch):
    from routers import auth_router
    from models import VerifyOtpRequest
    monkeypatch.setenv("JWT_SECRET", "synthetic-unit-test-secret-with-sufficient-length")
    db = otp_db()
    verify = auth_router.verify_otp.__wrapped__
    with patch.object(auth_router, "get_db", return_value=db):
        statuses = []
        for _ in range(5):
            with pytest.raises(HTTPException) as error:
                asyncio.run(verify(None, VerifyOtpRequest(phone=PHONE, code="000000")))
            statuses.append(error.value.status_code)
        assert statuses == [400, 400, 400, 400, 429]
        assert db.otp_codes.docs == []
        with pytest.raises(HTTPException) as error:
            asyncio.run(verify(None, VerifyOtpRequest(phone=PHONE, code="123456")))
        assert error.value.status_code == 400


def test_phone_otp_still_accepts_the_right_code(monkeypatch):
    from routers import auth_router
    from models import VerifyOtpRequest
    monkeypatch.setenv("JWT_SECRET", "synthetic-unit-test-secret-with-sufficient-length")
    db = otp_db()
    with patch.object(auth_router, "get_db", return_value=db):
        with pytest.raises(HTTPException):
            asyncio.run(auth_router.verify_otp.__wrapped__(None, VerifyOtpRequest(phone=PHONE, code="999999")))
        result = asyncio.run(auth_router.verify_otp.__wrapped__(None, VerifyOtpRequest(phone=PHONE, code=" 123456 ")))
    assert result["access_token"]
    assert "password_hash" not in result["user"]


def test_password_reset_otp_cannot_be_brute_forced():
    from routers import auth_router
    from models import SetPasswordRequest
    db = otp_db()
    with patch.object(auth_router, "get_db", return_value=db):
        last = None
        for _ in range(5):
            with pytest.raises(HTTPException) as error:
                asyncio.run(auth_router.reset_password(SetPasswordRequest(phone=PHONE, code="000000", new_password="nouveau-secret")))
            last = error.value.status_code
        assert last == 429
        assert db.otp_codes.docs == []
        assert "password_hash" not in db.users.docs[0]


def test_send_otp_is_capped_per_phone_number():
    from routers import auth_router
    from models import SendOtpRequest
    db = otp_db()
    with patch.object(auth_router, "get_db", return_value=db), \
            patch.object(auth_router, "require_otp_delivery"), \
            patch.object(auth_router, "send_otp_sms", AsyncMock(return_value=True)) as sms:
        for _ in range(5):
            asyncio.run(auth_router.send_otp.__wrapped__(None, SendOtpRequest(phone=PHONE)))
        with pytest.raises(HTTPException) as error:
            asyncio.run(auth_router.send_otp.__wrapped__(None, SendOtpRequest(phone=PHONE)))
    assert error.value.status_code == 429
    assert sms.await_count == 5
    assert db.otp_codes.docs[0]["attempts"] == 0


def test_application_otp_send_is_capped_against_sms_bombing():
    from routers import deliverer_applications_router as routes
    db = FakeDb()
    user = {"id": "candidate", "role": "buyer"}
    with patch.object(routes, "get_db", return_value=db), \
            patch.object(routes, "send_otp_sms", AsyncMock(return_value=True)) as sms:
        for _ in range(5):
            asyncio.run(routes.send_application_otp(routes.ApplicationOtpSendRequest(phone="+243990000000"), user))
        with pytest.raises(HTTPException) as error:
            asyncio.run(routes.send_application_otp(routes.ApplicationOtpSendRequest(phone="+243990000000"), user))
    assert error.value.status_code == 429
    assert sms.await_count == 5


def test_application_otp_is_invalidated_after_five_wrong_attempts():
    from routers import deliverer_applications_router as routes
    future = datetime.now(timezone.utc) + timedelta(minutes=5)
    db = FakeDb(application_otp_codes=[{"phone": PHONE, "user_id": "candidate", "code": "123456", "expires_at": future}])
    user = {"id": "candidate", "role": "buyer"}
    with patch.object(routes, "get_db", return_value=db):
        for _ in range(5):
            with pytest.raises(HTTPException):
                asyncio.run(routes.verify_application_otp(routes.ApplicationOtpVerifyRequest(phone=PHONE, code="000000"), user))
    assert db.application_otp_codes.docs == []


def handoff_db(**changes):
    order = {"id": "order", "buyer_id": "buyer", "seller_id": "seller", "deliverer_id": "courier",
             "delivery_mode": "delivery", "status": "out_for_delivery", "escrow_status": "held",
             "payment_method": "cash", "confirmation_code": "123456", **changes}
    return FakeDb(orders=[order])


def test_delivery_code_is_locked_after_repeated_wrong_guesses():
    from routers import delivery_router
    db = handoff_db()
    confirm = delivery_router.deliverer_confirm.__wrapped__
    courier = {"id": "courier", "role": "deliverer"}
    with patch.object(delivery_router, "get_db", return_value=db):
        for _ in range(10):
            with pytest.raises(HTTPException) as error:
                asyncio.run(confirm("order", delivery_router.ConfirmCodeRequest(code="000000"), courier))
            assert error.value.status_code == 400
        assert db.orders.docs[0]["handoff_locked_until"]
        # Même le bon code est refusé pendant le blocage : la force brute ne peut plus aboutir.
        with pytest.raises(HTTPException) as error:
            asyncio.run(confirm("order", delivery_router.ConfirmCodeRequest(code="123456"), courier))
        assert error.value.status_code == 429
    assert db.orders.docs[0]["escrow_status"] == "held"


def test_buyer_delivery_confirmation_counts_wrong_codes():
    from routers import orders_router
    db = handoff_db(payment_method="direct", payment_status="seller_declared_received")
    with patch.object(orders_router, "get_db", return_value=db), pytest.raises(HTTPException) as error:
        asyncio.run(orders_router.confirm_delivery.__wrapped__("order", orders_router.ConfirmDeliveryRequest(code="000000"), {"id": "buyer", "role": "buyer"}))
    assert error.value.status_code == 400
    assert db.orders.docs[0]["handoff_code_failures"] == 1


def test_expired_handoff_lock_lets_the_right_code_through():
    from abuse_limits import verify_handoff_code
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    db = handoff_db(handoff_locked_until=past)
    order = db.orders.docs[0]
    asyncio.run(verify_handoff_code(db, order, "order", "123456"))


def test_handoff_failures_survive_financial_transaction_rollback():
    from abuse_limits import _unbound
    from financial_transactions import SessionDatabase
    raw = FakeDb()
    assert _unbound(SessionDatabase(raw, session=object())) is raw
    assert _unbound(raw) is raw


def test_admin_buyer_kyc_queue_never_returns_password_hash():
    from unittest.mock import MagicMock
    from routers import admin_router
    db = MagicMock()
    db.users.find.return_value.sort.return_value.to_list = AsyncMock(return_value=[])
    with patch.object(admin_router, "get_db", return_value=db):
        asyncio.run(admin_router.buyer_kyc_pending({"id": "admin", "role": "admin"}))
    projection = db.users.find.call_args.args[1]
    assert projection["password_hash"] == 0 and projection["otp_code"] == 0


def test_admin_deliverer_list_never_returns_password_hash():
    from unittest.mock import MagicMock
    from routers import delivery_router

    class Cursor:
        def __aiter__(self):
            async def gen():
                for doc in []:
                    yield doc
            return gen()

    db = MagicMock()
    db.users.find.return_value = Cursor()
    with patch.object(delivery_router, "get_db", return_value=db):
        asyncio.run(delivery_router.admin_list_deliverers({"id": "admin", "role": "admin"}))
    projection = db.users.find.call_args.args[1]
    assert projection["password_hash"] == 0


def test_private_kyc_key_ignores_client_filename_extension():
    import io as _io
    from PIL import Image
    from fastapi import UploadFile
    from starlette.datastructures import Headers
    from routers import buyer_kyc_router
    from uploads import extension_for
    buf = _io.BytesIO()
    Image.new("RGB", (4, 4)).save(buf, "PNG")
    upload = UploadFile(_io.BytesIO(buf.getvalue()), filename="id./../../evil.html", headers=Headers({"content-type": "image/png"}))
    db = MagicMock_db()
    with patch.object(buyer_kyc_router, "get_db", return_value=db), \
            patch.object(buyer_kyc_router, "upload_private", return_value={"path": "p", "size": 1}) as upload_private:
        asyncio.run(buyer_kyc_router.upload_buyer_kyc_doc(upload, "id", {"id": "u1", "role": "buyer"}))
    key = upload_private.call_args.args[0]
    assert key.startswith("afrimarket/buyer_kyc/u1/id_") and key.endswith(".png")
    assert ".." not in key and "html" not in key
    assert extension_for("application/pdf") == "pdf"
    assert extension_for("text/html") == "bin"


def MagicMock_db():
    from unittest.mock import MagicMock
    db = MagicMock()
    db.files.insert_one = AsyncMock()
    db.users.update_one = AsyncMock()
    return db


def test_demo_cleanup_is_disabled_unless_explicitly_enabled(monkeypatch):
    from unittest.mock import MagicMock
    from routers import admin_router
    monkeypatch.delenv("ENABLE_DEMO_CLEANUP", raising=False)
    db = MagicMock()
    with patch.object(admin_router, "get_db", return_value=db), pytest.raises(HTTPException) as error:
        asyncio.run(admin_router.cleanup_demo_data({"id": "admin", "role": "admin"}))
    assert error.value.status_code == 404
    db.__getitem__.assert_not_called()
