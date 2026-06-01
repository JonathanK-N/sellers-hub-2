"""Demo seed: realistic Congolese marketplace data for showcasing AfriMarket.

Activated by setting SEED_DEMO=1. Idempotent: skips if demo data already present.
Run standalone:  SEED_DEMO=1 python seed_demo.py
Or it runs on startup when SEED_DEMO=1 (wired in server.py).
"""
import os
import uuid
import random
import logging
from datetime import datetime, timezone, timedelta

from db import get_db
from auth import normalize_phone

logger = logging.getLogger(__name__)


def _now_iso(days_ago=0):
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


def _uid():
    return str(uuid.uuid4())


# Kinshasa neighborhoods with rough coordinates
KIN = [
    ("Gombe", -4.3017, 15.3136),
    ("Lingwala", -4.3300, 15.3050),
    ("Barumbu", -4.3150, 15.3300),
    ("Kalamu", -4.3500, 15.3000),
    ("Limete", -4.3600, 15.3600),
    ("Ngaliema", -4.3700, 15.2500),
]

SELLERS = [
    {
        "shop": "ÉlectroKin", "cat": "Électronique", "desc": "Téléphones, accessoires et électronique à Kinshasa.",
        "premium": True, "verified": True, "rating": 4.8,
        "products": [
            ("Smartphone Android 128 Go", 285000, 14, "Téléphone double SIM, écran 6.5\", batterie 5000mAh."),
            ("Écouteurs Bluetooth", 35000, 40, "Sans fil, autonomie 20h, étui de charge."),
            ("Chargeur rapide USB-C 25W", 18000, 60, "Charge rapide compatible Android."),
            ("Power bank 20000mAh", 42000, 25, "Deux ports USB, charge plusieurs fois."),
            ("Montre connectée", 95000, 12, "Suivi d'activité, notifications, étanche."),
        ],
    },
    {
        "shop": "ModeAfrique", "cat": "Vêtements", "desc": "Tissus wax, prêt-à-porter et accessoires de mode.",
        "premium": False, "verified": True, "rating": 4.6,
        "products": [
            ("Pagne wax 6 yards", 22000, 30, "Tissu wax authentique, motifs colorés."),
            ("Chemise homme en wax", 38000, 18, "Coupe moderne, fabriquée localement."),
            ("Robe femme wax", 45000, 15, "Élégante, toutes tailles disponibles."),
            ("Sac à main artisanal", 28000, 20, "Fait main, cuir et tissu wax."),
        ],
    },
    {
        "shop": "AgriMarché", "cat": "Alimentaire", "desc": "Produits agricoles locaux et denrées de base.",
        "premium": False, "verified": False, "rating": 4.3,
        "products": [
            ("Riz local 25 kg", 48000, 50, "Riz de qualité, sac de 25 kg."),
            ("Huile de palme 5 L", 15000, 40, "Huile de palme rouge naturelle."),
            ("Farine de manioc 10 kg", 12000, 35, "Fufu de manioc, finement moulue."),
            ("Haricots secs 5 kg", 14000, 28, "Haricots rouges sélectionnés."),
        ],
    },
    {
        "shop": "SolarDRC", "cat": "Énergie", "desc": "Solutions solaires pour foyers et commerces.",
        "premium": True, "verified": True, "rating": 4.9,
        "products": [
            ("Kit solaire 100W", 320000, 8, "Panneau, batterie, régulateur, 3 ampoules LED."),
            ("Lampe solaire portable", 25000, 45, "Rechargeable au soleil, autonomie 12h."),
            ("Panneau solaire 200W", 380000, 6, "Haute efficacité, garantie 2 ans."),
        ],
    },
    {
        "shop": "MaisonDéco", "cat": "Maison", "desc": "Décoration, ustensiles et articles ménagers.",
        "premium": False, "verified": True, "rating": 4.4,
        "products": [
            ("Set de casseroles inox", 65000, 14, "5 pièces, qualité professionnelle."),
            ("Ventilateur sur pied", 55000, 20, "3 vitesses, oscillation, silencieux."),
            ("Lot de 6 verres", 12000, 50, "Verres résistants pour usage quotidien."),
        ],
    },
]

BUYERS = [
    ("Jean-Pierre Mwamba", "+243810111201"),
    ("Marie Kalala", "+243810111202"),
    ("Samuel Bondo", "+243810111203"),
    ("Awa Diallo", "+243810111204"),
    ("Patrick Lukusa", "+243810111205"),
]

REVIEWS = [
    (5, "Très bon produit, livraison rapide !"),
    (4, "Conforme à la description, satisfait."),
    (5, "Vendeur sérieux, je recommande."),
    (4, "Bonne qualité pour le prix."),
    (3, "Correct mais livraison un peu lente."),
]


async def seed_demo():
    db = get_db()
    if await db.sellers.count_documents({"demo": True}) > 0:
        logger.info("Demo data already present, skipping.")
        return {"skipped": True}

    created = {"sellers": 0, "products": 0, "buyers": 0, "orders": 0, "reviews": 0, "deliverers": 0}
    all_products = []

    # --- Sellers + products ---
    for i, s in enumerate(SELLERS):
        nbhd, lat, lng = KIN[i % len(KIN)]
        user_id = _uid()
        seller_id = _uid()
        phone = normalize_phone(f"+24381020{i:04d}")
        await db.users.insert_one({
            "id": user_id, "name": f"Gérant {s['shop']}", "phone": phone, "role": "seller",
            "country_code": "CD", "currency": "FC", "kyc_level": 2 if s["verified"] else 1,
            "created_at": _now_iso(60 - i), "demo": True,
        })
        premium_exp = _now_iso(-25) if s["premium"] else None  # expires in 25 days
        await db.sellers.insert_one({
            "id": seller_id, "user_id": user_id, "shop_name": s["shop"], "description": s["desc"],
            "category": s["cat"], "address": f"Av. du Commerce, {nbhd}", "neighborhood": nbhd,
            "opening_hours": "08:00-18:00", "shop_logo_url": None, "country_code": "CD",
            "location": {"type": "Point", "coordinates": [lng, lat]},
            "kyc_status": "level3" if s["verified"] else "level1",
            "badge_verified": s["verified"], "rating": s["rating"], "commission_rate": 0.07,
            "premium": s["premium"], "premium_expires_at": premium_exp,
            "premium_since": _now_iso(5) if s["premium"] else None,
            "created_at": _now_iso(60 - i), "demo": True,
        })
        created["sellers"] += 1
        if s["premium"]:
            await db.premium_subscriptions.insert_one({
                "id": _uid(), "seller_id": seller_id, "user_id": user_id,
                "amount": 15000, "currency": "FC", "status": "active",
                "activated_at": _now_iso(5), "expires_at": premium_exp, "created_at": _now_iso(5), "demo": True,
            })
        for name, price, stock, desc in s["products"]:
            pid = _uid()
            await db.products.insert_one({
                "id": pid, "seller_id": seller_id, "name": name, "description": desc,
                "price": price, "currency": "FC", "stock": stock, "category": s["cat"],
                "photos": [], "is_active": True, "country_code": "CD",
                "created_at": _now_iso(random.randint(1, 40)), "demo": True,
            })
            created["products"] += 1
            all_products.append({"id": pid, "seller_id": seller_id, "name": name, "price": price})

    # --- Buyers ---
    buyer_ids = []
    for name, phone in BUYERS:
        bid = _uid()
        await db.users.insert_one({
            "id": bid, "name": name, "phone": normalize_phone(phone), "role": "buyer",
            "country_code": "CD", "currency": "FC", "kyc_level": 1,
            "created_at": _now_iso(random.randint(5, 50)), "demo": True,
        })
        buyer_ids.append(bid)
        created["buyers"] += 1

    # --- Deliverers ---
    for i in range(2):
        did = _uid()
        await db.users.insert_one({
            "id": did, "name": f"Livreur {['Moïse','Chris'][i]}", "phone": normalize_phone(f"+24381030{i:04d}"),
            "role": "deliverer", "country_code": "CD", "currency": "FC", "created_at": _now_iso(30), "demo": True,
        })
        await db.deliverers.insert_one({
            "id": _uid(), "user_id": did, "vehicle": "moto", "is_active": True,
            "country_code": "CD", "created_at": _now_iso(30), "demo": True,
        })
        created["deliverers"] += 1

    # --- Orders at various stages + reviews ---
    statuses = ["delivered", "delivered", "out_for_delivery", "preparing", "confirmed"]
    for n in range(12):
        buyer = random.choice(buyer_ids)
        prod = random.choice(all_products)
        qty = random.randint(1, 3)
        total = prod["price"] * qty
        status = statuses[n % len(statuses)]
        escrow = "released" if status == "delivered" else "held"
        oid = _uid()
        gid = _uid()
        days = random.randint(0, 20)
        order = {
            "id": oid, "order_group_id": gid, "buyer_id": buyer, "seller_id": prod["seller_id"],
            "items": [{"product_id": prod["id"], "name": prod["name"], "price": prod["price"], "quantity": qty, "subtotal": total}],
            "total_amount": total, "commission_amount": round(total * 0.07, 2), "currency": "FC",
            "delivery_mode": "delivery", "delivery_neighborhood": random.choice(KIN)[0],
            "status": status, "escrow_status": escrow,
            "confirmation_code": f"{random.randint(0,999999):06d}",
            "country_code": "CD", "created_at": _now_iso(days),
            "timeline": [{"status": "confirmed", "label": "Commande confirmée", "timestamp": _now_iso(days)}],
            "demo": True,
        }
        if status == "delivered":
            order["delivered_at"] = _now_iso(max(0, days - 1))
        await db.orders.insert_one(order)
        await db.order_groups.insert_one({
            "id": gid, "buyer_id": buyer, "order_ids": [oid], "seller_count": 1,
            "grand_total": total, "currency": "FC", "country_code": "CD", "created_at": _now_iso(days), "demo": True,
        })
        await db.transactions.insert_one({
            "id": _uid(), "order_id": oid, "order_group_id": gid, "amount": total, "currency": "FC",
            "payment_method": "mtn", "payment_status": "released" if escrow == "released" else "captured_in_escrow",
            "escrow_released_at": _now_iso(max(0, days-1)) if escrow == "released" else None,
            "created_at": _now_iso(days), "demo": True,
        })
        created["orders"] += 1
        if status == "delivered" and random.random() > 0.3:
            rating, comment = random.choice(REVIEWS)
            await db.reviews.insert_one({
                "id": _uid(), "order_id": oid, "buyer_id": buyer, "seller_id": prod["seller_id"],
                "rating": rating, "comment": comment, "created_at": _now_iso(max(0, days-1)), "demo": True,
            })
            created["reviews"] += 1

    logger.info(f"Demo seed done: {created}")
    return created


if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_demo())
