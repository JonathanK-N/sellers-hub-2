"""Deterministic provider contract tests; no supplier certification claimed."""
import asyncio
import hashlib
import hmac
from unittest.mock import AsyncMock, patch
import pytest
from fastapi import HTTPException
from payments.webhook_security import FIELDS, authenticate
from payments.service import CinetPayProvider, PaymentResult
from routers import payments_router
from financial_transactions import run_transaction
from test_financial_transactions_mongo import isolated


def test_hmac_uses_documented_order_and_rejects_changed_amount(monkeypatch):
    monkeypatch.setenv("CINETPAY_SECRET_KEY", "TEST-local-secret")
    monkeypatch.setenv("CINETPAY_SITE_ID", "TEST-site")
    form = {key:"" for key in FIELDS}
    form.update(cpm_site_id="TEST-site", cpm_amount="100", cpm_trans_id="TEST-order")
    token = hmac.new(b"TEST-local-secret", "".join(form[key] for key in FIELDS).encode(), hashlib.sha256).hexdigest()
    authenticate(form, token)
    form["cpm_amount"] = "200"
    with pytest.raises(HTTPException) as error:
        authenticate(form, token)
    assert error.value.status_code == 401


def test_legacy_checkout_sandbox_cannot_call_live_endpoint(monkeypatch):
    monkeypatch.setenv("PAYMENT_MODE", "sandbox")
    monkeypatch.setenv("CINETPAY_API_KEY", "TEST-ambiguous-key")
    monkeypatch.setenv("CINETPAY_SITE_ID", "TEST-site")
    with patch("payments.service.httpx.AsyncClient") as client:
        result = asyncio.run(CinetPayProvider().collect("TEST",100,"CDF","TEST-order"))
    assert not result.ok
    client.assert_not_called()


@pytest.mark.parametrize("amount,currency,reference", [(101,"CDF","g"),(100,"USD","g"),(100,"CDF","other")])
def test_verified_payment_must_match_server_amount_currency_reference(amount,currency,reference):
    async def scenario(db):
        await db.order_groups.insert_one({"id":"g","payment_method":"mtn","payment_status":"pending","grand_total":100,"currency":"FC"})
        proof=PaymentResult(True, reference, "SUCCESS", raw={"data":{"amount":amount,"currency":currency}})
        with pytest.raises(HTTPException) as error:
            await run_transaction(db, lambda tx:payments_router.apply_verified_payment(tx,"g",proof))
        assert error.value.status_code==409
        assert (await db.order_groups.find_one({"id":"g"}))["payment_status"]=="pending"
        assert await db.financial_ledger.count_documents({})==0
    asyncio.run(isolated(scenario))


def test_duplicate_and_out_of_order_notifications_cannot_capture_twice():
    async def scenario(db):
        await db.create_collection("payment_events")
        await db.order_groups.insert_one({"id":"g","payment_method":"mtn","payment_status":"pending","grand_total":100,"currency":"FC"})
        await db.orders.insert_one({"id":"o","order_group_id":"g","escrow_status":"awaiting_payment"})
        await db.transactions.insert_one({"order_group_id":"g","payment_status":"pending"})
        proof=PaymentResult(True,"g","SUCCESS",raw={"data":{"amount":100,"currency":"CDF"}})
        for _ in range(2):
            await run_transaction(db, lambda tx:payments_router.apply_verified_payment(tx,"g",proof))
        refused=PaymentResult(False,"g","FAILED",raw={"data":{"amount":100,"currency":"CDF"}})
        await run_transaction(db, lambda tx:payments_router.apply_verified_payment(tx,"g",refused))
        assert (await db.orders.find_one({"id":"o"}))["escrow_status"]=="held"
        assert await db.financial_ledger.count_documents({})==1
        assert await db.payment_events.count_documents({})==1
    asyncio.run(isolated(scenario))


def test_provider_timeout_is_pending_not_payment_rejection(monkeypatch):
    monkeypatch.setenv("CINETPAY_API_KEY", "TEST-key")
    monkeypatch.setenv("CINETPAY_SITE_ID", "TEST-site")
    client=AsyncMock()
    client.post.side_effect=TimeoutError("TEST timeout")
    context=AsyncMock()
    context.__aenter__.return_value=client
    with patch("payments.service.httpx.AsyncClient",return_value=context):
        result=asyncio.run(CinetPayProvider().check("TEST-order"))
    assert not result.ok and result.status=="PENDING"
