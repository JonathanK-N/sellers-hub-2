"""Products: create, list (with geo filtering), get."""
import uuid
import math
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query, Response

from db import get_db
from models import ProductCreateRequest
from auth import require_role, get_current_user_dep
from storage import get_object

logger = logging.getLogger(__name__)
router = APIRouter(tags=["products"])


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


@router.get("/products")
async def list_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    country_code: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = Query(default=50, ge=1, le=500),
    verified_only: bool = False,
    sort: str = Query(default="nearest", pattern="^(nearest|rating|price|newest)$"),
    limit: int = Query(default=60, le=200),
):
    db = get_db()
    query: dict = {"is_active": True}
    if country_code:
        query["country_code"] = country_code
    if category and category not in ("all", "Tout"):
        query["category"] = category
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]

    products = await db.products.find(query, {"_id": 0}).to_list(500)

    # Join sellers
    seller_ids = list({p["seller_id"] for p in products})
    sellers = {}
    if seller_ids:
        async for s in db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0}):
            sellers[s["id"]] = s

    enriched = []
    for p in products:
        s = sellers.get(p["seller_id"])
        if not s:
            continue
        if verified_only and not s.get("badge_verified"):
            continue
        # Compute distance if buyer location provided
        distance = None
        loc = s.get("location") or {}
        coords = loc.get("coordinates") if isinstance(loc, dict) else None
        if lat is not None and lng is not None and coords and len(coords) == 2:
            slng, slat = coords[0], coords[1]
            if slat or slng:
                distance = _haversine_km(lat, lng, slat, slng)
                if distance > radius_km:
                    continue
        p["seller_name"] = s.get("shop_name")
        p["seller_verified"] = s.get("badge_verified", False)
        p["seller_rating"] = s.get("rating", 0.0)
        p["distance_km"] = round(distance, 1) if distance is not None else None
        enriched.append(p)

    # Sort
    if sort == "nearest":
        enriched.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0))
    elif sort == "rating":
        enriched.sort(key=lambda x: -(x.get("seller_rating") or 0))
    elif sort == "price":
        enriched.sort(key=lambda x: x["price"])
    elif sort == "newest":
        enriched.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return enriched[:limit]


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    db = get_db()
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    s = await db.sellers.find_one({"id": p["seller_id"]}, {"_id": 0})
    if s:
        p["seller_name"] = s.get("shop_name")
        p["seller_verified"] = s.get("badge_verified", False)
        p["seller_rating"] = s.get("rating", 0.0)
        p["seller_neighborhood"] = s.get("neighborhood")
        p["seller_address"] = s.get("address")
    return p


@router.post("/products", status_code=201)
async def create_product(req: ProductCreateRequest, user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=400, detail="Créez d'abord votre boutique")

    # KYC level 1 = max 10 products
    if user.get("kyc_level", 1) < 2:
        count = await db.products.count_documents({"seller_id": seller["id"]})
        if count >= 10:
            raise HTTPException(status_code=403, detail="Limite de 10 produits atteinte. Validez votre KYC pour en ajouter plus.")

    product = {
        "id": str(uuid.uuid4()),
        "seller_id": seller["id"],
        "name": req.name,
        "description": req.description,
        "price": req.price,
        "currency": user["currency"],
        "stock": req.stock,
        "category": req.category,
        "photos": req.photos[:5],
        "is_active": True,
        "country_code": user["country_code"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.products.insert_one(product)
    product.pop("_id", None)
    return product


@router.get("/seller/products")
async def my_products(user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        return []
    items = await db.products.find({"seller_id": seller["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=403, detail="Pas de boutique")
    res = await db.products.delete_one({"id": product_id, "seller_id": seller["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return {"ok": True}


@router.get("/files/{file_id}")
async def serve_file(file_id: str):
    """Serve a file from object storage. Public endpoint for product photos."""
    db = get_db()
    record = await db.files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    try:
        data, ct = get_object(record["storage_path"])
    except Exception as e:
        logger.error(f"File fetch error: {e}")
        raise HTTPException(status_code=500, detail="Erreur de récupération")
    return Response(content=data, media_type=record.get("content_type", ct))


@router.get("/categories")
async def categories():
    return [
        {"value": "all", "label": "Tout"},
        {"value": "Électronique", "label": "Électronique"},
        {"value": "Vêtements", "label": "Vêtements"},
        {"value": "Alimentation", "label": "Alimentation"},
        {"value": "Maison", "label": "Maison"},
        {"value": "Solaire", "label": "Solaire"},
        {"value": "Agriculture", "label": "Agriculture"},
        {"value": "Général", "label": "Général"},
    ]
