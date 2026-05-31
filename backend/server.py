"""AfriMarket FastAPI app entrypoint."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from db import init_db, close_db
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="AfriMarket API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "AfriMarket API", "version": "0.1.0"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


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
    try:
        await seed_all()
    except Exception as e:
        logger.error(f"Seed failed: {e}")
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
