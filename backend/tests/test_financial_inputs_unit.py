import asyncio
from unittest.mock import AsyncMock, Mock, patch
import pytest
from pydantic import ValidationError
from fastapi import HTTPException
from routers.wallet_router import WithdrawRequest
from routers.disputes_router import ResolveRequest
from routers import disputes_router


@pytest.mark.parametrize("amount", [0, -1, float("inf"), float("nan")])
def test_withdrawal_requires_positive_finite_amount(amount):
    with pytest.raises(ValidationError):
        WithdrawRequest(amount=amount, mobile_money_number="synthetic", operator="sandbox")


@pytest.mark.parametrize("amount", [None, 100, 101])
def test_partial_refund_is_suspended_without_financial_mutations(amount):
    db = Mock()
    db.disputes.find_one = AsyncMock(return_value={"status":"open","order_id":"order"})
    db.orders.find_one = AsyncMock(return_value={"id":"order","total_amount":100,"amount_due":100})
    with patch.object(disputes_router,"get_db",return_value=db), pytest.raises(HTTPException) as error:
        asyncio.run(disputes_router.admin_resolve("d", ResolveRequest(decision="partial_refund",partial_buyer_amount=amount), {"role":"admin"}))
    assert error.value.status_code == 503
    db.disputes.update_one.assert_not_called()
