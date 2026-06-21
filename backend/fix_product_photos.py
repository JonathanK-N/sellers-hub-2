# -*- coding: utf-8 -*-
"""One-off fix: correct product-image mismatches directly in MongoDB,
using the actual product names found in the database (which differ
slightly from the names currently in seed_demo.py)."""
import asyncio
from db import init_db, get_db

BUCKET = "afrimarket"
REGION = "us-east-1"

def s3(filename):
    return f"https://{BUCKET}.s3.{REGION}.amazonaws.com/afrimarket/demo-products/{filename}.jpg"

FIXES = {
    "Montre connectée": [s3("montre_intelligente")],
    "Chemise homme en wax": [s3("tshirt_carhartt")],
    "Huile de palme 5 L": [s3("huile_palme")],
    "Kit solaire 100W": [s3("kit_solaire"), s3("panneau")],
    "Panneau solaire 200W": [s3("panneau"), s3("panneau_solaire_usb")],
    "Set de casseroles inox": [s3("casseroles")],
    "Ventilateur sur pied": [s3("ventilateur")],
    "Lot de 6 verres": [s3("assiettes")],
}


async def fix():
    init_db()
    db = get_db()
    total = 0
    for name, photos in FIXES.items():
        result = await db.products.update_one(
            {"name": name, "demo": True},
            {"$set": {"photos": photos}},
        )
        status = "OK" if result.matched_count else "INTROUVABLE"
        print(f"{status} - {name} -> {photos}")
        total += result.modified_count

    print(f"\n{total} produits corriges.")


asyncio.run(fix())
