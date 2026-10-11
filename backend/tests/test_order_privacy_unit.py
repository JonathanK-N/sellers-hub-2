import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
import pytest
from fastapi import HTTPException
from routers import orders_router, delivery_router


def test_seller_qr_lookup_does_not_reveal_buyer_confirmation_code():
    db = Mock()
    db.orders.find_one = AsyncMock(return_value={"id": "order", "seller_id": "seller", "confirmation_code": "123456", "qr_code": "buyer-qr"})
    db.sellers.find_one = AsyncMock(return_value={"id": "seller"})
    with patch.object(orders_router, "get_db", return_value=db):
        result = asyncio.run(orders_router.get_order_by_qr("buyer-qr", {"id": "seller-user", "role": "seller"}))
    assert result["id"] == "order"
    assert "confirmation_code" not in result
    assert "qr_code" not in result


def test_unassigned_deliverer_cannot_read_another_order():
    db = Mock()
    db.orders.find_one = AsyncMock(return_value={"seller_id":"seller","buyer_id":"buyer","deliverer_id":"assigned","confirmation_code":"secret"})
    db.sellers.find_one = AsyncMock(return_value={"id":"seller"})
    db.users.find_one = AsyncMock(return_value={"name":"TEST","phone":"TEST"})
    with patch.object(orders_router,"get_db",return_value=db), pytest.raises(HTTPException) as error:
        asyncio.run(orders_router.get_order("order", {"id":"other","role":"deliverer"}))
    assert error.value.status_code == 403


def test_assigned_deliverer_cannot_read_buyer_handoff_secrets():
    db = Mock()
    db.orders.find_one = AsyncMock(return_value={"seller_id":"seller","buyer_id":"buyer","deliverer_id":"assigned","confirmation_code":"secret","qr_code":"secret-qr"})
    db.sellers.find_one = AsyncMock(return_value={"id":"seller"})
    db.users.find_one = AsyncMock(return_value={"name":"TEST"})
    with patch.object(orders_router,"get_db",return_value=db):
        result = asyncio.run(orders_router.get_order("order", {"id":"assigned","role":"deliverer"}))
    assert "confirmation_code" not in result
    assert "qr_code" not in result


@pytest.mark.parametrize("role", ["seller","deliverer"])
def test_cart_group_is_private_to_buyer_or_admin(role):
    db = Mock()
    db.order_groups.find_one = AsyncMock(return_value={"buyer_id":"buyer"})
    with patch.object(orders_router,"get_db",return_value=db), pytest.raises(HTTPException) as error:
        asyncio.run(orders_router.get_order_group("group", {"id":"other","role":role}))
    assert error.value.status_code == 403
    db.orders.find.assert_not_called()


def test_competing_delivery_confirmation_cannot_credit_wallet_twice():
    db = Mock()
    db.orders.find_one = AsyncMock(return_value={"delivery_mode":"delivery","status":"out_for_delivery","payment_method":"cash","escrow_status":"held","confirmation_code":"123456","delivery_fee":16000})
    db.orders.update_one = AsyncMock(return_value=SimpleNamespace(modified_count=0))
    with patch.object(delivery_router,"get_db",return_value=db), pytest.raises(HTTPException) as error:
        asyncio.run(delivery_router.deliverer_confirm("order", delivery_router.ConfirmCodeRequest(code="123456"), {"id":"courier","role":"deliverer"}))
    assert error.value.status_code == 409
    db.transactions.update_one.assert_not_called()
    db.deliverer_wallets.update_one.assert_not_called()
