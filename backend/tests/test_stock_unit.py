import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from fastapi import HTTPException
from models import OrderItemRequest
from stock import aggregate_items, reserve_stock

def test_duplicate_lines_are_combined_before_reservation():
    items = aggregate_items([OrderItemRequest(product_id="p",quantity=2), OrderItemRequest(product_id="p",quantity=3)])
    assert len(items) == 1
    assert items[0].quantity == 5

def test_partial_reservation_is_compensated_on_insufficient_stock():
    products = SimpleNamespace(update_one=AsyncMock(side_effect=[SimpleNamespace(matched_count=1),SimpleNamespace(matched_count=0),SimpleNamespace(matched_count=1)]))
    with pytest.raises(HTTPException) as error:
        asyncio.run(reserve_stock(SimpleNamespace(products=products),[OrderItemRequest(product_id="a",quantity=1),OrderItemRequest(product_id="b",quantity=2)]))
    assert error.value.status_code == 409
    calls = products.update_one.await_args_list
    assert calls[0].args[0]["stock"] == {"$gte":1}
    assert calls[2].args == ({"id":"a"},{"$inc":{"stock":1}})
