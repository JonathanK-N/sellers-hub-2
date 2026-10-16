"""Business rule unit tests; real transaction boundaries tested separately on MongoDB."""
"""Authorization, payment and concurrent handoff regressions."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import pytest
from fastapi import HTTPException
from routers import orders_router as routes


def database(order, modified=1):
    return SimpleNamespace(
        orders=SimpleNamespace(find_one=AsyncMock(return_value=order), update_one=AsyncMock(return_value=SimpleNamespace(modified_count=modified))),
        sellers=SimpleNamespace(find_one=AsyncMock(return_value={"id":"seller"})),
        transactions=SimpleNamespace(update_one=AsyncMock(), update_many=AsyncMock()),
    )


@pytest.mark.parametrize("user,changes,expected", [
    ({"id":"stranger","role":"buyer"}, {}, 403),
    ({"id":"stranger","role":"deliverer"}, {}, 403),
    ({"id":"buyer","role":"buyer"}, {"status":"confirmed"}, 409),
    ({"id":"buyer","role":"buyer"}, {"payment_method":"mtn","payment_confirmed":False}, 409),
])
def test_delivery_rejects_unauthorized_or_unpaid_order(user, changes, expected):
    order = {"id":"order","buyer_id":"buyer","deliverer_id":"courier","delivery_mode":"delivery","status":"out_for_delivery","escrow_status":"held","payment_method":"cash","confirmation_code":"123456", **changes}
    db = database(order)
    with patch.object(routes,"get_db",return_value=db), pytest.raises(HTTPException) as error:
        asyncio.run(routes.confirm_delivery.__wrapped__("order", routes.ConfirmDeliveryRequest(code="123456"), user))
    assert error.value.status_code == expected
    db.orders.update_one.assert_not_awaited()
    db.transactions.update_one.assert_not_awaited()


def test_concurrent_delivery_loser_cannot_release_transaction():
    db = database({"buyer_id":"buyer","delivery_mode":"delivery","status":"out_for_delivery","escrow_status":"held","payment_method":"cash","confirmation_code":"123456"}, modified=0)
    with patch.object(routes,"get_db",return_value=db), pytest.raises(HTTPException) as error:
        asyncio.run(routes.confirm_delivery.__wrapped__("order", routes.ConfirmDeliveryRequest(code="123456"), {"id":"buyer","role":"buyer"}))
    assert error.value.status_code == 409
    assert db.orders.update_one.await_args.args[0] == {"id":"order","status":"out_for_delivery","escrow_status":"held"}
    db.transactions.update_one.assert_not_awaited()


def test_cash_handoff_cannot_release_unpaid_mobile_money():
    db = database({"seller_id":"seller","delivery_mode":"collect","payment_method":"mtn","status":"ready_for_pickup","escrow_status":"held"})
    with patch.object(routes,"get_db",return_value=db), pytest.raises(HTTPException) as error:
        asyncio.run(routes.confirm_collect.__wrapped__("order", {"id":"seller-user","role":"seller"}))
    assert error.value.status_code == 409
    db.orders.update_one.assert_not_awaited()


def test_valid_qr_does_not_replace_payment_confirmation():
    db = database({"seller_id":"seller","delivery_mode":"collect","payment_method":"mtn","payment_confirmed":False,"status":"ready_for_pickup","escrow_status":"held","qr_code":"valid"})
    with patch.object(routes,"get_db",return_value=db), pytest.raises(HTTPException) as error:
        asyncio.run(routes.scan_qr.__wrapped__("order", routes.ScanQrRequest(qr_token="valid"), {"id":"seller-user","role":"seller"}))
    assert error.value.status_code == 409
    db.orders.update_one.assert_not_awaited()
