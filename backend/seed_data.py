"""Seed essential data on startup: indexes, countries, admin, app config."""
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
    admin_phone = normalize_phone(os.environ.get("ADMIN_PHONE", ""))
    admin_name  = os.environ.get("ADMIN_NAME", "Admin AfriMarket")
    admin_password = os.environ.get("ADMIN_PASSWORD", "")

    if not admin_phone:
        logger.warning("ADMIN_PHONE non défini — compte admin non créé")
        return

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
        logger.info(f"Admin créé : {admin_phone}")
    else:
        updates = {"role": "admin", "name": admin_name}
        if pwd_hash:
            updates["password_hash"] = pwd_hash
        await db.users.update_one({"phone": admin_phone}, {"$set": updates})
        logger.info(f"Admin mis à jour : {admin_phone}")


async def create_indexes():
    db = get_db()
    # Avoid concurrent implicit namespace creation during the first checkout.
    from pymongo.errors import CollectionInvalid
    for name in ("orders", "transactions", "order_groups", "checkout_requests", "withdrawal_requests", "financial_ledger", "payment_intents", "payment_events", "notification_outbox", "fraud_outbox", "deliverer_wallets", "deliverer_wallet_transactions", "disputes", "withdrawals"):
        try:
            await db.create_collection(name)
        except CollectionInvalid:
            pass
    await db.order_groups.create_index("id", unique=True)
    await db.transactions.create_index("order_id", unique=True, partialFilterExpression={"order_id": {"$type": "string"}})
    await db.disputes.create_index("order_id", unique=True, partialFilterExpression={"status": "open"})
    await db.deliverer_wallets.create_index("user_id", unique=True)
    await db.withdrawals.create_index("id", unique=True)
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
    # Index manquants identifiés lors de l'audit (requêtes fréquentes non indexées)
    await db.orders.create_index("status")
    await db.orders.create_index("created_at")
    await db.products.create_index("category")
    await db.products.create_index("is_active")
    await db.products.create_index([("is_active", 1), ("country_code", 1), ("created_at", -1)])
    await db.products.create_index([("seller_id", 1), ("is_active", 1)])
    await db.banners.create_index([("is_active", 1), ("position", 1)])
    await db.banners.create_index("target_role")
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.notifications.create_index("created_at")
    await db.messages.create_index([("thread_id", 1), ("created_at", -1)])
    await db.app_config.create_index("key", unique=True)
    await db.fx_rates.create_index("pair", unique=True)
    try:
        await db.sellers.create_index([("location", "2dsphere")])
    except Exception as e:
        logger.warning(f"2dsphere index: {e}")
    logger.info("Indexes created")


async def init_app_config():
    """Initialise les configs app par défaut si elles n'existent pas."""
    db = get_db()
    existing = await db.app_config.find_one({"key": "promo_banner"})
    if not existing:
        await db.app_config.insert_one({
            "key": "promo_banner",
            "visible": False,
            "title": "Livraison gratuite dès 50 000 FC",
            "subtitle": "Sur tous les produits dans votre quartier",
        })
        logger.info("Config promo_banner initialisée (visible=False)")


async def seed_all():
    await create_indexes()
    await seed_countries()
    await seed_admin()
    await init_app_config()
