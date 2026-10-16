import pytest
from pydantic import ValidationError
from models import OrderItemRequest, ProductCreateRequest, ProductUpdateRequest


@pytest.mark.parametrize('quantity', [0, -1, -100])
def test_invalid_order_quantity_rejected(quantity):
    with pytest.raises(ValidationError):
        OrderItemRequest(product_id='synthetic', quantity=quantity)


def test_valid_order_quantity_allowed():
    assert OrderItemRequest(product_id='synthetic', quantity=1).quantity == 1


@pytest.mark.parametrize('payload', [{'price': -1}, {'stock': -1}])
def test_invalid_product_update_rejected(payload):
    with pytest.raises(ValidationError):
        ProductUpdateRequest(**payload)


def test_invalid_product_price_rejected():
    with pytest.raises(ValidationError):
        ProductCreateRequest(name='Synthetic', price=-1)
