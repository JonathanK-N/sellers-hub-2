"""AfriMarket FastAPI app entrypoint."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from db import init_db, close_db, get_db
from rate_limit import limiter, rate_limit_handler
from slowapi.errors import RateLimitExceeded
from seed_data import seed_all
from storage import init_storage
from routers.auth_router import router as auth_router
from routers.countries_router import router as countries_router
from routers.sellers_router import router as sellers_router
from routers.products_router import router as products_router
from routers.orders_router import router as orders_router
from routers.admin_router import router as admin_router
from routers.messages_router import router as messages_router
from routers.reviews_router import router as reviews_router
from routers.disputes_router import router as disputes_router
from routers.wallet_router import router as wallet_router
from routers.delivery_router import router as delivery_router
from routers.notifications_router import router as notifications_router
from routers.payments_router import router as payments_router
from routers.premium_router import router as premium_router
from routers.buyer_kyc_router import router as buyer_kyc_router
from routers.deliverer_applications_router import router as deliverer_applications_router
from routers.direct_payments_router import router as direct_payments_router
from routers.whatsapp_router import router as whatsapp_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="AfriMarket API")
APP_VERSION = "1.1.0-direct-rc.2"

# Rate limiting — protège contre le spam et le brute-force
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "AfriMarket API", "version": APP_VERSION}


@api_router.get("/health")
async def health():
    """Health check enrichi — utilisé par UptimeRobot / monitoring externe.
    Vérifie MongoDB et retourne les métriques essentielles.
    Répondre dans les 5s sinon Railway/UptimeRobot considère le service down.
    """
    import time
    start = time.monotonic()
    checks = {}
    overall = "ok"

    # Check MongoDB
    try:
        db = get_db()
        await db.command("ping")
        checks["mongodb"] = "ok"
    except Exception:
        checks["mongodb"] = "error: unavailable"
        overall = "degraded"

    # Check FX rate fraîcheur (si plus vieux que 7h → warning)
    try:
        from fx_service import get_usd_to_fc
        db = get_db()
        fx_doc = await db.fx_rates.find_one({"pair": "USD_CDF"}, {"_id": 0, "updated_at": 1})
        if fx_doc and fx_doc.get("updated_at"):
            from datetime import datetime, timezone
            updated = datetime.fromisoformat(fx_doc["updated_at"])
            age_hours = (datetime.now(timezone.utc) - updated).total_seconds() / 3600
            checks["fx_rate"] = "ok" if age_hours < 7 else f"stale ({age_hours:.1f}h)"
        else:
            checks["fx_rate"] = "no_data"
    except Exception:
        checks["fx_rate"] = "unknown"

    elapsed_ms = int((time.monotonic() - start) * 1000)
    return {
        "status": overall,
        "checks": checks,
        "response_ms": elapsed_ms,
        "version": APP_VERSION,
        "source_sha": os.environ.get("RAILWAY_GIT_COMMIT_SHA", "") if len(os.environ.get("RAILWAY_GIT_COMMIT_SHA", "")) == 40 else None,
    }


@api_router.get("/fx/rate")
async def fx_rate():
    """Taux USD/CDF depuis le cache (mis à jour toutes les 6h par le scheduler)."""
    from fx_service import get_usd_to_fc
    from db import get_db
    db = get_db()
    rate = await get_usd_to_fc()
    doc = await db.fx_rates.find_one({"pair": "USD_CDF"}, {"_id": 0})
    return {
        "pair": "USD_CDF",
        "rate": rate,
        "updated_at": doc.get("updated_at") if doc else None,
    }


api_router.include_router(auth_router)
api_router.include_router(countries_router)
api_router.include_router(sellers_router)
api_router.include_router(products_router)
api_router.include_router(orders_router)
api_router.include_router(admin_router)
api_router.include_router(messages_router)
api_router.include_router(reviews_router)
api_router.include_router(disputes_router)
api_router.include_router(wallet_router)
api_router.include_router(delivery_router)
api_router.include_router(notifications_router)
api_router.include_router(payments_router)
api_router.include_router(premium_router)
api_router.include_router(buyer_kyc_router)
api_router.include_router(deliverer_applications_router)
api_router.include_router(direct_payments_router)
api_router.include_router(whatsapp_router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    init_db()
    # Production startup never creates accounts or overwrites existing business/reference data.
    # Schema migrations run separately after backup and compatibility checks.
    if os.environ.get("AUTH_MODE", "production").lower() == "sandbox":
        try:
            await seed_all()
        except Exception:
            logger.error("Synthetic bootstrap failed", exc_info=True)

    try:
        init_storage()
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    try:
        from scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        logger.error(f"Scheduler start failed: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    try:
        from scheduler import stop_scheduler
        stop_scheduler()
    except Exception as e:
        logger.error(f"Scheduler stop failed: {e}")
    close_db()
