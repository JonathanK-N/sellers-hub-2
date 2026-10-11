"""Conditional stock reservation with compensation on ordinary request failures.

Cross-collection crash recovery still requires durable transactions/reconciliation.
"""
from collections import Counter
from fastapi import HTTPException

def aggregate_items(items):
    quantities = Counter()
    first = {}
    for item in items:
        quantities[item.product_id] += item.quantity
        first.setdefault(item.product_id, item)
    return [first[pid].model_copy(update={"quantity": quantity}) for pid, quantity in quantities.items()]

async def release_stock(db, reservations):
    for product_id, quantity in reservations:
        await db.products.update_one({"id": product_id}, {"$inc": {"stock": quantity}})

async def reserve_stock(db, items):
    reserved = []
    try:
        for item in sorted(items, key=lambda value: value.product_id):
            result = await db.products.update_one(
                {"id": item.product_id, "stock": {"$gte": item.quantity}, "is_active": {"$ne": False}},
                {"$inc": {"stock": -item.quantity}},
            )
            if result.matched_count != 1:
                raise HTTPException(status_code=409, detail="Stock modifié ou produit indisponible. Actualisez le panier.")
            reserved.append((item.product_id, item.quantity))
    except Exception:
        await release_stock(db, reserved)
        raise
    return reserved
