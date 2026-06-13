"""Seed countries, admin, and test accounts on startup."""
import os
import uuid
import logging
from datetime import datetime, timezone

from db import get_db
from auth import normalize_phone

logger = logging.getLogger(__name__)


COUNTRIES = [
    {"code": "CD", "name": "RD Congo",       "currency": "FC",  "currency_symbol": "FC",   "dial_code": "+243", "flag": "🇨🇩", "mobile_money_operators": ["MTN MoMo", "Airtel Money", "Orange Money", "M-Pesa"], "commission_rate": 0.07, "is_active": True},
    {"code": "CM", "name": "Cameroun",        "currency": "XAF", "currency_symbol": "FCFA", "dial_code": "+237", "flag": "🇨🇲", "mobile_money_operators": ["MTN MoMo", "Orange Money"], "commission_rate": 0.07, "is_active": True},
    {"code": "CI", "name": "Côte d'Ivoire",   "currency": "XOF", "currency_symbol": "FCFA", "dial_code": "+225", "flag": "🇨🇮", "mobile_money_operators": ["MTN MoMo", "Orange Money", "Wave"], "commission_rate": 0.07, "is_active": True},
    {"code": "SN", "name": "Sénégal",         "currency": "XOF", "currency_symbol": "FCFA", "dial_code": "+221", "flag": "🇸🇳", "mobile_money_operators": ["Wave", "Orange Money", "Free Money"], "commission_rate": 0.07, "is_active": True},
    {"code": "BJ", "name": "Bénin",           "currency": "XOF", "currency_symbol": "FCFA", "dial_code": "+229", "flag": "🇧🇯", "mobile_money_operators": ["MTN MoMo", "Moov Money"], "commission_rate": 0.07, "is_active": True},
]


async def seed_countries():
    db = get_db()
    for c in COUNTRIES:
        await db.countries.update_one({"code": c["code"]}, {"$set": c}, upsert=True)
    logger.info(f"Seeded {len(COUNTRIES)} countries")


async def seed_admin():
    """Create or update the admin account from environment variables."""
    from auth import hash_password
    db = get_db()
    admin_phone = normalize_phone(os.environ.get("ADMIN_PHONE", "+243000000001"))
    admin_name = os.environ.get("ADMIN_NAME", "Admin AfriMarket")
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    pwd_hash = hash_password(admin_password) if admin_password else None

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
            "password_hash": pwd_hash,
            "phone_verified": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {admin_phone}")
    else:
        updates = {"role": "admin"}
        if pwd_hash:
            updates["password_hash"] = pwd_hash
        await db.users.update_one({"phone": admin_phone}, {"$set": updates})
        logger.info(f"Admin updated: {admin_phone}")


async def seed_test_accounts():
    """Create 3 fixed test accounts (buyer, seller, deliverer). Idempotent."""
    from auth import hash_password
    db = get_db()
    PWD_HASH = hash_password("Afrimarket2026!")

    TEST_ACCOUNTS = [
        {
            "id": str(uuid.uuid4()),
            "name": "Beatrice Mutombo",
            "phone": normalize_phone("+243890000001"),
            "role": "buyer",
            "country_code": "CD", "currency": "FC", "kyc_level": 1,
            "password_hash": PWD_HASH, "phone_verified": True, "test_account": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Patrick Luzolo",
            "phone": normalize_phone("+243890000002"),
            "role": "seller",
            "country_code": "CD", "currency": "FC", "kyc_level": 1,
            "password_hash": PWD_HASH, "phone_verified": True, "test_account": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Moise Kabongo",
            "phone": normalize_phone("+243890000003"),
            "role": "deliverer",
            "country_code": "CD", "currency": "FC", "kyc_level": 1,
            "password_hash": PWD_HASH, "phone_verified": True, "test_account": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    for acc in TEST_ACCOUNTS:
        existing = await db.users.find_one({"phone": acc["phone"]})
        if not existing:
            await db.users.insert_one(acc)
            if acc["role"] == "deliverer":
                await db.deliverers.insert_one({
                    "id": str(uuid.uuid4()), "user_id": acc["id"],
                    "vehicle": "moto", "is_active": True,
                    "country_code": "CD", "created_at": acc["created_at"],
                    "test_account": True,
                })
            logger.info(f"Compte test cree: {acc['role']} {acc['phone']}")
        else:
            # Always keep password up to date
            await db.users.update_one(
                {"phone": acc["phone"]},
                {"$set": {"password_hash": PWD_HASH, "phone_verified": True}},
            )
            logger.info(f"Compte test mis a jour: {acc['role']} {acc['phone']}")


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
    try:
        await db.sellers.create_index([("location", "2dsphere")])
    except Exception as e:
        logger.warning(f"2dsphere index issue: {e}")
    logger.info("Indexes created")


async def seed_all():
    await create_indexes()
    await seed_countries()
    await seed_admin()
    await seed_test_accounts()
