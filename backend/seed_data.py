"""Seed countries and admin user on startup."""
import os
import logging
from datetime import datetime, timezone

from db import get_db
from auth import normalize_phone

logger = logging.getLogger(__name__)


COUNTRIES = [
    {
        "code": "CD",
        "name": "RD Congo",
        "currency": "FC",
        "currency_symbol": "FC",
        "dial_code": "+243",
        "flag": "🇨🇩",
        "mobile_money_operators": ["MTN MoMo", "Airtel Money", "Orange Money"],
        "commission_rate": 0.07,
        "is_active": True,
    },
    {
        "code": "CM",
        "name": "Cameroun",
        "currency": "XAF",
        "currency_symbol": "FCFA",
        "dial_code": "+237",
        "flag": "🇨🇲",
        "mobile_money_operators": ["MTN MoMo", "Orange Money"],
        "commission_rate": 0.07,
        "is_active": True,
    },
    {
        "code": "CI",
        "name": "Côte d'Ivoire",
        "currency": "XOF",
        "currency_symbol": "FCFA",
        "dial_code": "+225",
        "flag": "🇨🇮",
        "mobile_money_operators": ["MTN MoMo", "Orange Money", "Wave"],
        "commission_rate": 0.07,
        "is_active": True,
    },
    {
        "code": "SN",
        "name": "Sénégal",
        "currency": "XOF",
        "currency_symbol": "FCFA",
        "dial_code": "+221",
        "flag": "🇸🇳",
        "mobile_money_operators": ["Wave", "Orange Money", "Free Money"],
        "commission_rate": 0.07,
        "is_active": True,
    },
    {
        "code": "BJ",
        "name": "Bénin",
        "currency": "XOF",
        "currency_symbol": "FCFA",
        "dial_code": "+229",
        "flag": "🇧🇯",
        "mobile_money_operators": ["MTN MoMo", "Moov Money"],
        "commission_rate": 0.07,
        "is_active": True,
    },
]


async def seed_countries():
    db = get_db()
    for c in COUNTRIES:
        await db.countries.update_one(
            {"code": c["code"]}, {"$set": c}, upsert=True
        )
    logger.info(f"Seeded {len(COUNTRIES)} countries")


async def seed_admin():
    import uuid
    db = get_db()
    admin_phone = normalize_phone(os.environ.get("ADMIN_PHONE", "+243000000001"))
    admin_name = os.environ.get("ADMIN_NAME", "Admin AfriMarket")
    existing = await db.users.find_one({"phone": admin_phone})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": admin_name,
            "phone": admin_phone,
            "role": "admin",
            "country_code": "CD",
            "currency": "FC",
            "kyc_level": 3,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {admin_phone}")
    else:
        logger.info(f"Admin already exists: {admin_phone}")


async def create_indexes():
    db = get_db()
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("id", unique=True)
    await db.sellers.create_index("user_id", unique=True)
    await db.sellers.create_index("id", unique=True)
    await db.products.create_index("seller_id")
    await db.products.create_index("id", unique=True)
    await db.products.create_index("country_code")
    await db.orders.create_index("buyer_id")
    await db.orders.create_index("seller_id")
    await db.orders.create_index("id", unique=True)
    await db.countries.create_index("code", unique=True)
    await db.otp_codes.create_index("expires_at", expireAfterSeconds=0)
    # 2dsphere for geo
    try:
        await db.sellers.create_index([("location", "2dsphere")])
    except Exception as e:
        logger.warning(f"2dsphere index issue: {e}")
    logger.info("Indexes created")


async def seed_all():
    await create_indexes()
    await seed_countries()
    await seed_admin()
