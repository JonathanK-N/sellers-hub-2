"""Exact minor-unit accounting. Author: Jonathan Kakesa (JonathanK-N)."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import datetime, timezone
from fastapi import HTTPException


def minor_units(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount < 0 or amount != amount.quantize(Decimal("0.01")):
            raise ValueError
        return int(amount * 100)
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(422, "Montant monétaire invalide ou précision supérieure à deux décimales")


def money_product(price, quantity):
    return minor_units(price) * quantity / 100


def commission(total, rate):
    percentage = Decimal(str(rate))
    if not percentage.is_finite() or not 0 <= percentage <= 1:
        raise HTTPException(422, "Commission invalide")
    return int((Decimal(minor_units(total)) * percentage).quantize(Decimal("1"), rounding=ROUND_HALF_UP)) / 100


async def record_release(db, order, courier_id=None):
    """Balanced journal, written in the same transaction as the escrow CAS."""
    total = minor_units(order["total_amount"])
    fee = minor_units(order.get("delivery_fee", 0))
    cut = minor_units(order["commission_amount"])
    amount = minor_units(order.get("amount_due", order["total_amount"]))
    if amount != total + fee or cut > total:
        raise HTTPException(409, "Incohérence des montants de commande")
    courier_id = order.get("deliverer_id") or courier_id
    settlement = "cash_settlement:" + order["id"] if order.get("payment_method") == "cash" else "escrow:" + order["order_group_id"]
    lines = [
        {"account": settlement, "minor": -amount},
        {"account": "seller:" + order["seller_id"], "minor": total - cut},
        {"account": "platform:commission", "minor": cut},
    ]
    if courier_id and fee == 1600000:
        await db.deliverer_wallets.update_one(
            {"user_id": courier_id}, {"$inc": {"balance": 11500}, "$set": {"currency": order["currency"], "user_id": courier_id}}, upsert=True,
        )
        await db.deliverer_wallet_transactions.insert_one({
            "_id": "delivery:" + order["id"], "id": "delivery:" + order["id"], "user_id": courier_id,
            "order_id": order["id"], "type": "delivery_fee", "amount": 11500,
            "platform_fee": 4500, "currency": order["currency"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        lines.extend([{"account": "courier:" + courier_id, "minor": 1150000},
                      {"account": "platform:delivery", "minor": 450000}])
    else:
        lines.append({"account": "delivery:unallocated", "minor": fee})
    if sum(line["minor"] for line in lines) != 0:
        raise HTTPException(409, "Écriture comptable non équilibrée")
    await db.financial_ledger.insert_one({
        "_id": "release:" + order["id"], "order_id": order["id"],
        "kind": "cash_handoff" if order.get("payment_method") == "cash" else "escrow_release",
        "currency": order["currency"], "lines": lines,
    })
    if order.get("payment_method") == "cash":
        await db.orders.update_one({"id": order["id"]}, {"$set": {"payment_confirmed": True, "cash_received": True}})
