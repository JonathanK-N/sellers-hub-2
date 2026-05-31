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
        retry_count = w.get("retry_count", 0)
        provider = get_provider(w.get("operator", "MTN MoMo"))
        await db.withdrawals.update_one({"id": w["id"]}, {"$set": {"status": "processing"}})
        try:
            res = await provider.disburse(
                phone=w["mobile_money_number"],
                amount=w["amount"],
                currency=w["currency"],
                external_ref=w["id"],
                description="Retrait AfriMarket",
            )
            if res.ok:
                await db.withdrawals.update_one(
                    {"id": w["id"]},
                    {"$set": {
                        "status": "completed",
                        "provider_ref": res.reference,
                        "completed_at": _now_iso(),
                    }},
                )
                await create_notification(
                    w["user_id"],
                    "withdrawal_completed",
                    "Retrait effectué",
                    f"Votre retrait de {w['amount']:.0f} {w['currency']} a été envoyé sur {w['mobile_money_number']}.",
                    {"withdrawal_id": w["id"]},
                )
                logger.info(f"[CRON] Withdrawal {w['id']} completed via {provider.name}")
            else:
                raise RuntimeError(res.error or "disburse_failed")
        except Exception as e:
            new_count = retry_count + 1
            if new_count >= 3:
                await db.withdrawals.update_one(
                    {"id": w["id"]},
                    {"$set": {"status": "manual_review", "retry_count": new_count, "last_error": str(e)}},
                )
                logger.warning(f"[CRON] Withdrawal {w['id']} -> manual_review after {new_count} tries")
            else:
                await db.withdrawals.update_one(
                    {"id": w["id"]},
                    {"$set": {"status": "in_progress", "retry_count": new_count, "last_error": str(e)}},
                )
                logger.warning(f"[CRON] Withdrawal {w['id']} retry {new_count}: {e}")


def start_scheduler():
    global _scheduler
    if _scheduler:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(process_pending_withdrawals, "interval", minutes=1, id="withdrawals")
    _scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
