"""Map persisted business states to email events without inferring financial success."""
from .events import emit
from .config import configuration


async def order_snapshot(db, order_id):
    if configuration()["mode"] == "disabled":
        return
    order = await db.orders.find_one({"id": order_id})
    if not order:
        return
    seller = await db.sellers.find_one({"id": order["seller_id"]}) or {}
    buyer = await db.users.find_one({"id": order["buyer_id"]}) or {}
    context = {"commande": order["id"], "boutique": seller.get("shop_name", ""),
        "montant": str(order.get("amount_due", order.get("total_amount", ""))) + " " + order.get("currency", ""),
        "livreur": order.get("deliverer_name", ""), "date_livraison": order.get("delivered_at", ""),
        "motif": order.get("cancel_reason", "Consultez les détails de la commande"),
        "statut_remboursement": "Aucun remboursement automatique" if order.get("payment_method") == "direct" else "Consultez les détails de la commande"}
    status = order.get("status")
    if status == "confirmed":
        if context["montant"].strip():
            await emit(db, "order_confirmed", order_id, buyer, context)
        owner = await db.users.find_one({"id": seller.get("user_id")}) or {}
        await emit(db, "seller_new_order", order_id, owner, context, "/seller/orders")
    event = {"preparing": "order_preparing", "assigned": "delivery_assigned", "picked_up": "delivery_collected",
             "out_for_delivery": "delivery_in_transit", "delivered": "delivery_completed", "cancelled": "order_cancelled"}.get(status)
    if event:
        if event == "delivery_assigned":
            deliverer = await db.users.find_one({"id": order.get("deliverer_id")}) or {}
            context["telephone_livreur"] = deliverer.get("phone", "")
        await emit(db, event, order_id, buyer, context)


async def from_notification(db, user_id, kind, title, data):
    if configuration()["mode"] == "disabled":
        return
    if kind in ("order_received", "order_shipped", "order_ready", "order_delivered"):
        # order_received is also reused for direct-payment declarations; never reinterpret it.
        if "paiement" not in title.lower() and data.get("order_id"):
            await order_snapshot(db, data["order_id"])
    if kind in ("dispute_opened", "dispute_resolved") and data.get("dispute_id"):
        dispute = await db.disputes.find_one({"id": data["dispute_id"]})
        if dispute:
            user = await db.users.find_one({"id": user_id}) or {}
            await emit(db, kind, dispute["id"], user, path="/buyer/orders")


async def best_effort_order(db, order_id):
    from financial_transactions import active_database
    if active_database.get() is not None:
        return await order_snapshot(db, order_id)
    try:
        return await order_snapshot(db, order_id)
    except Exception:
        import logging
        logging.getLogger(__name__).warning("Order email queue unavailable")


async def verified_payment(db, group, status, reference):
    if configuration()["mode"] == "disabled" or group.get("payment_method") in ("direct", "cash"):
        return
    buyer = await db.users.find_one({"id": group["buyer_id"]}) or {}
    if status == "SUCCESS":
        await emit(db, "payment_confirmed", reference, buyer, {
            "commande": group["id"], "montant": str(group["grand_total"]) + " " + group["currency"],
            "methode": group.get("payment_method", ""), "reference": reference})
    elif status == "FAILED":
        await emit(db, "payment_failed", reference, buyer)


async def dispute_event(db, dispute_id, event):
    if configuration()["mode"] == "disabled":
        return
    dispute = await db.disputes.find_one({"id": dispute_id})
    if not dispute:
        return
    seller = await db.sellers.find_one({"id": dispute["seller_id"]}) or {}
    for user_id, path in ((dispute["buyer_id"], "/buyer/orders"), (seller.get("user_id"), "/seller/orders")):
        user = await db.users.find_one({"id": user_id}) or {}
        await emit(db, event, dispute_id, user, path=path)
