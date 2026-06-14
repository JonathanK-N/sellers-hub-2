"""Seller boutique + profile management."""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from db import get_db
from models import SellerSetupRequest
from auth import require_role
from storage import put_object

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/seller", tags=["seller"])
APP_NAME = "afrimarket"


@router.get("/me")
async def get_my_boutique(user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    return seller  # may be None -> setup needed


@router.post("/setup")
async def setup_boutique(req: SellerSetupRequest, user: dict = Depends(require_role("seller"))):
    db = get_db()
    existing = await db.sellers.find_one({"user_id": user["id"]})
    payload = {
        "shop_name": req.shop_name,
        "description": req.description,
        "long_description": req.long_description,
        "product_specialties": req.product_specialties,
        "category": req.category,
        "address": req.address,
        "neighborhood": req.neighborhood,
        "opening_hours": req.opening_hours,
        "shop_logo_url": req.shop_logo_url,
        "shop_banner_url": req.shop_banner_url,
        "social_links": req.social_links.model_dump() if req.social_links else {},
        "delivery_service": req.delivery_service,
        "country_code": user["country_code"],
        "location": {
            "type": "Point",
            "coordinates": [req.longitude, req.latitude],
        },
    }
    if existing:
        await db.sellers.update_one({"user_id": user["id"]}, {"$set": payload})
        seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
        return seller

    seller = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "kyc_status": "level1",
        "badge_verified": False,
        "rating": 0.0,
        "commission_rate": 0.07,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    await db.sellers.insert_one(seller)
    seller.pop("_id", None)
    return seller


@router.post("/upload-photo")
async def upload_photo(file: UploadFile = File(...), user: dict = Depends(require_role("seller"))):
    """Upload a single product/shop photo to object storage. Returns public URL via our backend."""
    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"
    path = f"{APP_NAME}/photos/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    try:
        result = put_object(path, data, file.content_type or "image/jpeg")
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Échec du téléversement")

    db = get_db()
    file_id = str(uuid.uuid4())
    await db.files.insert_one({
        "id": file_id,
        "storage_path": result["path"],
        "owner_id": user["id"],
        "content_type": file.content_type or f"image/{ext}",
        "size": result.get("size", 0),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"id": file_id, "url": f"/api/files/{file_id}", "path": result["path"]}


@router.post("/kyc/upload")
async def upload_kyc_doc(
    file: UploadFile = File(...),
    doc_type: str = "id",  # id | selfie | address
    user: dict = Depends(require_role("seller")),
):
    """Upload a KYC document to private folder."""
    if doc_type not in {"id", "selfie", "address"}:
        raise HTTPException(status_code=400, detail="Type de document invalide")
    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
    path = f"{APP_NAME}/kyc/{user['id']}/{doc_type}_{uuid.uuid4()}.{ext}"
    data = await file.read()
    try:
        result = put_object(path, data, file.content_type or "image/jpeg")
    except Exception as e:
        logger.error(f"KYC upload failed: {e}")
        raise HTTPException(status_code=500, detail="Échec du téléversement")
    db = get_db()
    file_id = str(uuid.uuid4())
    await db.files.insert_one({
        "id": file_id,
        "storage_path": result["path"],
        "owner_id": user["id"],
        "doc_type": doc_type,
        "is_private": True,
        "content_type": file.content_type or f"image/{ext}",
        "size": result.get("size", 0),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if seller:
        kyc_docs = seller.get("kyc_docs") or {}
        kyc_docs[doc_type] = {"file_id": file_id, "uploaded_at": datetime.now(timezone.utc).isoformat()}
        await db.sellers.update_one({"id": seller["id"]}, {"$set": {"kyc_docs": kyc_docs}})

    return {"id": file_id, "doc_type": doc_type}


@router.post("/kyc/submit")
async def submit_kyc(user: dict = Depends(require_role("seller"))):
    """Submit KYC for admin review. Requires at least 'id' doc; selfie+address for level3."""
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=400, detail="Boutique introuvable")
    docs = seller.get("kyc_docs") or {}
    if "id" not in docs:
        raise HTTPException(status_code=400, detail="Pièce d'identité requise (Niveau 2)")
    requested_level = 2
    if "selfie" in docs and "address" in docs:
        requested_level = 3
    await db.sellers.update_one(
        {"id": seller["id"]},
        {"$set": {"kyc_status": "pending_review", "kyc_requested_level": requested_level, "kyc_submitted_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "kyc_status": "pending_review", "kyc_requested_level": requested_level}


@router.get("/kyc/status")
async def kyc_status(user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        return {"kyc_status": "none", "kyc_level": 1, "docs": {}}
    return {
        "kyc_status": seller.get("kyc_status", "level1"),
        "kyc_level": user.get("kyc_level", 1),
        "badge_verified": seller.get("badge_verified", False),
        "kyc_requested_level": seller.get("kyc_requested_level"),
        "docs": {k: {"uploaded_at": v.get("uploaded_at")} for k, v in (seller.get("kyc_docs") or {}).items()},
        "kyc_reject_reason": seller.get("kyc_reject_reason"),
    }


@router.get("/dashboard")
async def dashboard(user: dict = Depends(require_role("seller"))):
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        return {
            "shop": None,
            "revenue": 0,
            "orders_total": 0,
            "orders_pending": 0,
            "orders_completed": 0,
            "products_active": 0,
            "products_oos": 0,
            "rating": 0.0,
            "recent_orders": [],
        }

    products = await db.products.find({"seller_id": seller["id"]}, {"_id": 0}).to_list(1000)
    products_active = sum(1 for p in products if p.get("is_active") and p.get("stock", 0) > 0)
    products_oos = sum(1 for p in products if p.get("stock", 0) <= 0)

    orders = await db.orders.find({"seller_id": seller["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    revenue = sum(o["total_amount"] - o["commission_amount"] for o in orders if o.get("escrow_status") == "released")
    orders_pending = sum(1 for o in orders if o["status"] in ("confirmed", "preparing", "out_for_delivery"))
    orders_completed = sum(1 for o in orders if o["status"] in ("delivered", "collected"))

    return {
        "shop": seller,
        "revenue": revenue,
        "orders_total": len(orders),
        "orders_pending": orders_pending,
        "orders_completed": orders_completed,
        "products_active": products_active,
        "products_oos": products_oos,
        "rating": seller.get("rating", 0.0),
        "recent_orders": orders[:10],
    }



@router.patch("/delivery-service")
async def update_delivery_service(user: dict = Depends(require_role("seller"))):
    """Bascule entre livraison propre et reseau AfriMarket (Premium requis)."""
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=400, detail="Boutique manquante")
    from routers.premium_router import _is_active
    if not _is_active(seller):
        raise HTTPException(
            status_code=403,
            detail="Abonnement Premium requis pour utiliser les livreurs AfriMarket"
        )
    current = seller.get("delivery_service", "self")
    new_mode = "afrimarket" if current == "self" else "self"
    await db.sellers.update_one({"user_id": user["id"]}, {"$set": {"delivery_service": new_mode}})
    return {"delivery_service": new_mode}


@router.post("/upload-logo")
async def upload_logo(file: UploadFile = File(...), user: dict = Depends(require_role("seller"))):
    """Upload the shop profile picture and save the URL on the seller document."""
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=400, detail="Boutique manquante")
    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"
    path = f"{APP_NAME}/shop-logos/{seller['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    try:
        result = put_object(path, data, file.content_type or "image/jpeg")
    except Exception as e:
        logger.error(f"Logo upload failed: {e}")
        raise HTTPException(status_code=500, detail="Échec du téléversement")

    file_id = str(uuid.uuid4())
    await db.files.insert_one({
        "id": file_id,
        "storage_path": result["path"],
        "owner_id": user["id"],
        "content_type": file.content_type or f"image/{ext}",
        "size": result.get("size", 0),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    url = f"/api/files/{file_id}"
    await db.sellers.update_one({"user_id": user["id"]}, {"$set": {"shop_logo_url": url}})
    return {"url": url, "id": file_id}


@router.post("/upload-banner")
async def upload_banner(file: UploadFile = File(...), user: dict = Depends(require_role("seller"))):
    """Upload the shop banner/cover image."""
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]})
    if not seller:
        raise HTTPException(status_code=400, detail="Boutique manquante")
    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"
    path = f"{APP_NAME}/shop-banners/{seller['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    try:
        result = put_object(path, data, file.content_type or "image/jpeg")
    except Exception as e:
        logger.error(f"Banner upload failed: {e}")
        raise HTTPException(status_code=500, detail="Échec du téléversement")

    file_id = str(uuid.uuid4())
    await db.files.insert_one({
        "id": file_id,
        "storage_path": result["path"],
        "owner_id": user["id"],
        "content_type": file.content_type or f"image/{ext}",
        "size": result.get("size", 0),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    url = f"/api/files/{file_id}"
    await db.sellers.update_one({"user_id": user["id"]}, {"$set": {"shop_banner_url": url}})
    return {"url": url, "id": file_id}


@router.get("/public/{seller_id}")
async def get_public_profile(seller_id: str):
    """Public shop profile visible to buyers."""
    db = get_db()
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0, "commission_rate": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    products = await db.products.find(
        {"seller_id": seller_id, "is_active": True, "stock": {"$gt": 0}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    reviews = await db.reviews.find({"seller_id": seller_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"seller": seller, "products": products, "reviews": reviews}


@router.get("/buyer-profile/{buyer_id}")
async def get_buyer_profile(buyer_id: str, user: dict = Depends(require_role("seller"))):
    """Seller sees a buyer's profile: shared orders + name."""
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=400, detail="Boutique manquante")
    buyer = await db.users.find_one({"id": buyer_id}, {"_id": 0, "password_hash": 0, "otp_code": 0})
    if not buyer:
        raise HTTPException(status_code=404, detail="Acheteur introuvable")
    orders = await db.orders.find(
        {"buyer_id": buyer_id, "seller_id": seller["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    total_spent = sum(o["total_amount"] for o in orders if o.get("escrow_status") == "released")
    return {
        "buyer": {"name": buyer.get("name"), "created_at": buyer.get("created_at"), "id": buyer_id},
        "orders": orders,
        "total_orders": len(orders),
        "total_spent": total_spent,
    }
