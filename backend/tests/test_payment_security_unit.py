"""Payment configuration and callback security regressions, no external calls."""
import asyncio
from unittest.mock import AsyncMock, Mock, patch
import pytest
from fastapi import HTTPException
from routers import payments_router
from payments.service import is_sandbox, CinetPayProvider, get_provider

def test_sandbox_requires_explicit_configuration(monkeypatch):
    monkeypatch.delenv("PAYMENT_MODE", raising=False)
    assert not is_sandbox()
    monkeypatch.setenv("PAYMENT_MODE", "sandbox")
    assert is_sandbox()

def test_unconfigured_external_callback_fails_closed():
    with patch.object(payments_router, "cinetpay_configured", return_value=False), patch.object(payments_router, "get_db") as get_db:
        with pytest.raises(HTTPException) as error:
            asyncio.run(payments_router.cinetpay_webhook(Mock()))
        assert error.value.status_code == 503
        get_db.assert_not_called()

def test_missing_provider_cannot_simulate_live_payment():
    db = Mock()
    db.order_groups.find_one = AsyncMock(return_value={"id":"g", "buyer_id":"buyer", "payment_method":"mtn"})
    with patch.object(payments_router, "get_db", return_value=db), patch.object(payments_router,"cinetpay_configured",return_value=False), patch.object(payments_router,"is_sandbox",return_value=False):
        with pytest.raises(HTTPException) as error:
            asyncio.run(payments_router.init_payment(payments_router.InitRequest(order_group_id="g"), {"id":"buyer"}))
        assert error.value.status_code == 503

def test_payment_group_cannot_be_used_by_another_buyer():
    db = Mock()
    db.order_groups.find_one = AsyncMock(return_value={"id":"g", "buyer_id":"owner"})
    with patch.object(payments_router, "get_db", return_value=db):
        with pytest.raises(HTTPException) as error:
            asyncio.run(payments_router.init_payment(payments_router.InitRequest(order_group_id="g"), {"id":"other"}))
        assert error.value.status_code == 403


def test_provider_cannot_confirm_missing_external_configuration(monkeypatch):
    monkeypatch.delenv("CINETPAY_API_KEY", raising=False)
    monkeypatch.delenv("CINETPAY_SITE_ID", raising=False)
    provider = CinetPayProvider()
    checked = asyncio.run(provider.check("untrusted"))
    assert not checked.ok
    assert checked.status != "SUCCESS"
    paid = asyncio.run(provider.disburse("synthetic", 100, "CDF", "test"))
    assert not paid.ok


def test_unknown_live_operator_cannot_fall_back_to_sandbox(monkeypatch):
    monkeypatch.setenv("PAYMENT_MODE", "live")
    monkeypatch.delenv("CINETPAY_API_KEY", raising=False)
    result = asyncio.run(get_provider("unknown").collect("synthetic",100,"CDF","test"))
    assert not result.ok


def test_repeated_cash_payment_does_not_reopen_released_escrow():
    db = Mock()
    db.order_groups.find_one = AsyncMock(return_value={"id":"g","buyer_id":"buyer","payment_method":"cash","payment_status":"cash_on_delivery"})
    with patch.object(payments_router,"get_db",return_value=db):
        result = asyncio.run(payments_router.init_payment(payments_router.InitRequest(order_group_id="g"), {"id":"buyer"}))
    assert result["status"] == "cash_on_delivery"
    db.orders.update_many.assert_not_called()
    db.transactions.update_many.assert_not_called()
