"""Background scheduler for withdrawals + housekeeping."""
import logging
import os
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from db import get_db
from payments.service import get_provider
from notifications import create_notification

logger = logging.getLogger(__name__)
_scheduler: AsyncIOScheduler | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def process_pending_withdrawals():
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    async for w in db.withdrawals.find({"status": "in_progress", "created_at": {"$lt": cutoff}}, {"_id": 0}):
        claimed = await db.withdrawals.update_one({"id": w["id"], "status": "in_progress"}, {"$set": {"status": "processing", "processing_at": _now_iso()}})
        if claimed.modified_count != 1:
            continue
        try:
            result = await get_provider(w.get("operator", "")).disburse(phone=w["mobile_money_number"], amount=w["amount"], currency=w["currency"], external_ref=w["id"], description="Retrait AfriMarket")
            # Acceptance is not settlement. Keep the debit reserved until a
            # certified provider status or an explicit reconciliation proves it.
            state = "provider_pending" if result.ok else "manual_review"
            await db.withdrawals.update_one({"id": w["id"], "status": "processing"}, {"$set": {"status": state, "provider_ref": result.reference}})
        except Exception:
            await db.withdrawals.update_one({"id": w["id"], "status": "processing"}, {"$set": {"status": "reconciliation_required"}})
    # A crash after transmission must never trigger an automatic re-emission.
    await db.withdrawals.update_many({"status": "processing", "processing_at": {"$lt": cutoff}}, {"$set": {"status": "reconciliation_required"}})


async def expire_premium_subscriptions():
    """Deactivate Premium for sellers whose subscription has expired."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    async for s in db.sellers.find({"premium": True, "premium_expires_at": {"$lt": now}}, {"_id": 0, "id": 1, "user_id": 1}):
        await db.sellers.update_one({"id": s["id"]}, {"$set": {"premium": False}})
        try:
            await create_notification(
                s["user_id"], "kyc_rejected", "Premium expiré",
                "Votre abonnement Premium a expiré. Renouvelez pour garder vos avantages.",
                {"seller_id": s["id"]},
            )
        except Exception:
            logger.warning("Best-effort operation failed", exc_info=True)
        logger.info(f"[CRON] Premium expired for seller {s['id']}")


async def process_financial_outbox():
    """Non-financial effects after commit; duplicate push remains possible."""
    from pymongo import ReturnDocument
    from notifications import _send_fcm
    db = get_db()
    lease = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
    for name in ("notification_outbox", "fraud_outbox"):
        await db[name].update_many({"status":"processing", "claimed_at":{"$lt":lease}}, {"$set":{"status":"pending"}})
        for _ in range(20):
            item = await db[name].find_one_and_update({"status":"pending"}, {"$set":{"status":"processing", "claimed_at":_now_iso()}}, return_document=ReturnDocument.AFTER)
            if not item:
                break
            try:
                if name == "fraud_outbox":
                    from fraud import evaluate_and_log
                    await evaluate_and_log(item["user_id"])
                else:
                    note = item["notification"]
                    prefs = await db.notification_prefs.find_one({"user_id":note["user_id"]}) or {}
                    if prefs.get(note["type"]) is not False:
                        devices = await db.device_tokens.find({"user_id":note["user_id"], "is_active":True}).to_list(100)
                        if devices:
                            await _send_fcm([d["token"] for d in devices], note["title"], note["body"], note["data"])
                await db[name].update_one({"_id":item["_id"]}, {"$set":{"status":"completed"}})
            except Exception:
                await db[name].update_one({"_id":item["_id"]}, {"$set":{"status":"pending"}})
                break


async def refresh_fx_rate():
    """Rafraîchit le taux USD/CDF depuis ForexRateAPI et le cache en base."""
    try:
        from fx_service import refresh_rate
        rate = await refresh_rate()
        logger.info(f"[CRON] Taux USD/CDF rafraîchi : {rate}")
    except Exception as e:
        logger.warning(f"[CRON] Échec refresh taux FX : {e}")


def start_scheduler():
    global _scheduler
    if _scheduler:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(process_pending_withdrawals, "interval", minutes=1, id="withdrawals")
    _scheduler.add_job(process_financial_outbox, "interval", seconds=30, id="financial_outbox")
    _scheduler.add_job(expire_premium_subscriptions, "interval", hours=6, id="premium_expiry")
    _scheduler.add_job(refresh_fx_rate, "interval", hours=6, id="fx_rate_refresh")
    _scheduler.start()
    # Premier fetch immédiat au démarrage (non bloquant)
    import asyncio
    asyncio.ensure_future(refresh_fx_rate())
    logger.info("Scheduler started")


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
