"""Products: create, list (with geo filtering), get."""
import uuid
import math
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query, Response
from fastapi.responses import RedirectResponse

from db import get_db
from models import ProductCreateRequest, ProductUpdateRequest
from auth import require_role, get_current_user_dep, get_current_user_optional
from s3_service import generate_presigned_url, BUCKET_PUBLIC, AWS_REGION

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


def _is_premium_active(seller: dict) -> bool:
    """A seller is Premium if flagged and the subscription hasn't expired."""
    if not seller.get("premium"):
        return False
    expires = seller.get("premium_expires_at")
    if not expires:
        return False
    try:
        exp = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        return exp > datetime.now(timezone.utc)
    except Exception:
        return False


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
        # Compute distance if buyer location provided. The radius filter only
        # applies for geo-browsing (no text query): a text search for a known
        # product name must find it regardless of the buyer's GPS position —
        # otherwise a buyer far from a seller's coordinates gets zero results
        # even when the product genuinely exists in the catalog.
        distance = None
        loc = s.get("location") or {}
        coords = loc.get("coordinates") if isinstance(loc, dict) else None
        if lat is not None and lng is not None and coords and len(coords) == 2:
            slng, slat = coords[0], coords[1]
            if slat or slng:
                distance = _haversine_km(lat, lng, slat, slng)
                if not q and distance > radius_km:
                    continue
        p["seller_name"] = s.get("shop_name")
        p["seller_verified"] = s.get("badge_verified", False)
        p["seller_rating"] = s.get("rating", 0.0)
        p["seller_premium"] = _is_premium_active(s)
        p["distance_km"] = round(distance, 1) if distance is not None else None
        enriched.append(p)

    # Sort — Premium sellers get a visibility boost on discovery sorts
    # (nearest / rating / newest), but never override an explicit price sort.
    if sort == "nearest":
        enriched.sort(key=lambda x: (not x.get("seller_premium"), x["distance_km"] is None, x["distance_km"] or 0))
    elif sort == "rating":
        enriched.sort(key=lambda x: (not x.get("seller_premium"), -(x.get("seller_rating") or 0)))
    elif sort == "price":
        enriched.sort(key=lambda x: x["price"])
    elif sort == "newest":
        enriched.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        enriched.sort(key=lambda x: not x.get("seller_premium"))

    return enriched[:limit]


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    db = get_db()
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    # Vérifier que le vendeur n'est pas banni ou suspendu
    _seller_check = await db.sellers.find_one({"id": p.get("seller_id")}, {"_id": 0, "user_id": 1})
    if _seller_check:
        _user_check = await db.users.find_one(
            {"id": _seller_check.get("user_id")}, {"_id": 0, "banned": 1, "suspended": 1}
        )
        if _user_check and (_user_check.get("banned") or _user_check.get("suspended")):
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

    # Product limit: KYC level 1 caps at 10 products, UNLESS the seller is Premium.
    if user.get("kyc_level", 1) < 2 and not _is_premium_active(seller):
        count = await db.products.count_documents({"seller_id": seller["id"]})
        if count >= 10:
            raise HTTPException(status_code=403, detail="Limite de 10 produits atteinte. Validez votre KYC ou passez Premium pour en ajouter plus.")

    valid_modes = {"delivery", "collect"}
    delivery_modes = [m for m in req.delivery_modes if m in valid_modes] or ["delivery", "collect"]

    product = {
        "id": str(uuid.uuid4()),
        "seller_id": seller["id"],
        "name": req.name,
        "description": req.description,
        "long_description": req.long_description,
        "specs": [s.model_dump() for s in req.specs],
        "price": req.price,
        "currency": getattr(req, "currency", None) or user["currency"],
        "price_fc": None,   # sera rempli ci-dessous si USD
        "fx_rate": None,
        "stock": req.stock,
        "category": req.category,
        "photos": req.photos[:5],
        "delivery_modes": delivery_modes,
        "is_active": True,
        "country_code": user["country_code"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Conversion USD → FC si nécessaire
    chosen_currency = getattr(req, "currency", None) or user["currency"]
    if chosen_currency == "USD":
        try:
            from fx_service import convert_usd_to_fc
            price_fc, fx_rate = await convert_usd_to_fc(req.price)
            product["price_fc"] = price_fc
            product["fx_rate"] = fx_rate
        except Exception as e:
            logger.warning(f"FX conversion failed at product create: {e}")

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


@router.patch("/products/{product_id}")
async def update_product(product_id: str, req: ProductUpdateRequest, user: dict = Depends(require_role("seller", "admin"))):
    """Partial update of a product. Owning seller OR admin can edit."""
    db = get_db()
    # Admin peut modifier n'importe quel produit sans vérification boutique
    if user["role"] == "admin":
        existing = await db.products.find_one({"id": product_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Produit introuvable")
        update_data = req.model_dump(exclude_unset=True)
        if update_data:
            await db.products.update_one({"id": product_id}, {"$set": update_data})
        return {**existing, **update_data}
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=403, detail="Pas de boutique")

    existing = await db.products.find_one({"id": product_id, "seller_id": seller["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    update_data = req.model_dump(exclude_unset=True)
    if not update_data:
        return existing
    # currency est autorisé dans le PATCH
    ALLOWED_CURRENCY = {"FC", "USD"}
    if "currency" in update_data and update_data["currency"] not in ALLOWED_CURRENCY:
        update_data.pop("currency")

    # Recalculer price_fc si le prix ou la devise a changé vers USD
    final_currency = update_data.get("currency") or existing.get("currency", "FC")
    final_price = update_data.get("price") or existing.get("price", 0)
    if final_currency == "USD":
        try:
            from fx_service import convert_usd_to_fc
            price_fc, fx_rate = await convert_usd_to_fc(final_price)
            update_data["price_fc"] = price_fc
            update_data["fx_rate"] = fx_rate
        except Exception as e:
            logger.warning(f"FX conversion failed at product update: {e}")
    else:
        # FC ou autre: pas de conversion, effacer les champs
        update_data["price_fc"] = None
        update_data["fx_rate"] = None

    if "specs" in update_data and update_data["specs"] is not None:
        update_data["specs"] = [s if isinstance(s, dict) else s.model_dump() for s in update_data["specs"]]

    if "delivery_modes" in update_data and update_data["delivery_modes"] is not None:
        valid_modes = {"delivery", "collect"}
        modes = [m for m in update_data["delivery_modes"] if m in valid_modes]
        update_data["delivery_modes"] = modes or ["delivery", "collect"]

    if "photos" in update_data and update_data["photos"] is not None:
        update_data["photos"] = update_data["photos"][:5]

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.products.update_one({"id": product_id, "seller_id": seller["id"]}, {"$set": update_data})
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated


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
async def serve_file(file_id: str, user: Optional[dict] = Depends(get_current_user_optional)):
    """Resolve a file_id to its S3 location and redirect there. Public files
    (product photos, shop logos/banners, avatars) redirect straight to the
    permanent public S3 URL. Private files (KYC documents: ID cards, selfies)
    require the requester to be the file owner or an admin, then redirect to
    a short-lived presigned URL (5 min) rather than ever exposing a stable
    public link to sensitive documents."""
    db = get_db()
    record = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Fichier introuvable")

    if record.get("is_private"):
        if not user:
            raise HTTPException(status_code=401, detail="Authentification requise")
        is_owner = user["id"] == record.get("owner_id")
        is_admin = user.get("role") == "admin"
        if not (is_owner or is_admin):
            raise HTTPException(status_code=403, detail="Accès refusé à ce document")
        try:
            signed_url = generate_presigned_url(record["storage_path"], expires_in=300)
        except Exception as e:
            logger.error(f"Presign error: {e}")
            raise HTTPException(status_code=500, detail="Erreur de récupération")
        return RedirectResponse(url=signed_url, status_code=302)

    public_url = f"https://{BUCKET_PUBLIC}.s3.{AWS_REGION}.amazonaws.com/{record['storage_path']}"
    return RedirectResponse(url=public_url, status_code=302)


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
