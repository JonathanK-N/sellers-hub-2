"""Reviews & ratings (post-delivery only, verified by order_id)."""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from db import get_db
from auth import require_role

logger = logging.getLogger(__name__)
router = APIRouter(tags=["reviews"])


class ReviewRequest(BaseModel):
    order_id: str
    rating: int = Field(ge=1, le=5)
    comment: str = ""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _update_seller_rating(db, seller_id: str):
    pipeline = [
        {"$match": {"seller_id": seller_id}},
        {"$group": {"_id": "$seller_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    rows = await db.reviews.aggregate(pipeline).to_list(1)
    if rows:
        await db.sellers.update_one(
            {"id": seller_id},
            {"$set": {"rating": round(rows[0]["avg"], 2), "reviews_count": rows[0]["count"]}},
        )


@router.post("/reviews", status_code=201)
async def create_review(req: ReviewRequest, user: dict = Depends(require_role("buyer"))):
    db = get_db()
    order = await db.orders.find_one({"id": req.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order["buyer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if order["status"] not in ("delivered", "collected"):
        raise HTTPException(status_code=400, detail="Vous ne pouvez noter qu'après réception")

    existing = await db.reviews.find_one({"order_id": req.order_id, "buyer_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà noté cette commande")

    review = {
        "id": str(uuid.uuid4()),
        "order_id": req.order_id,
        "buyer_id": user["id"],
        "buyer_name": user["name"],
        "seller_id": order["seller_id"],
        "rating": req.rating,
        "comment": req.comment.strip(),
        "created_at": _now(),
    }
    await db.reviews.insert_one(review)
    await _update_seller_rating(db, order["seller_id"])
    review.pop("_id", None)
    return review


@router.get("/sellers/{seller_id}/reviews")
async def list_seller_reviews(seller_id: str):
    db = get_db()
    reviews = await db.reviews.find({"seller_id": seller_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return reviews


@router.get("/products/{product_id}/reviews")
async def list_product_reviews(product_id: str):
    db = get_db()
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        return []
    reviews = await db.reviews.find({"seller_id": p["seller_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return reviews


@router.get("/reviews/can-review/{order_id}")
async def can_review(order_id: str, user: dict = Depends(require_role("buyer"))):
    db = get_db()
    order = await db.orders.find_one({"id": order_id, "buyer_id": user["id"]}, {"_id": 0})
    if not order:
        return {"can_review": False, "reason": "not_owner"}
    if order["status"] not in ("delivered", "collected"):
        return {"can_review": False, "reason": "not_delivered"}
    existing = await db.reviews.find_one({"order_id": order_id, "buyer_id": user["id"]})
    if existing:
        return {"can_review": False, "reason": "already_reviewed", "review": {**existing, "_id": None}}
    return {"can_review": True}

# ============================================================
# Buyer reviews (seller rates the buyer) — stars only, no comment.
# Visible publicly so other sellers can see a buyer's reliability.
# ============================================================

class BuyerReviewRequest(BaseModel):
    order_id: str
    rating: int = Field(ge=1, le=5)


async def _update_buyer_rating(db, buyer_id: str):
    pipeline = [
        {"$match": {"buyer_id": buyer_id}},
        {"$group": {"_id": "$buyer_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    rows = await db.buyer_reviews.aggregate(pipeline).to_list(1)
    if rows:
        await db.users.update_one(
            {"id": buyer_id},
            {"$set": {"buyer_rating": round(rows[0]["avg"], 2), "buyer_reviews_count": rows[0]["count"]}},
        )


@router.post("/buyer-reviews", status_code=201)
async def create_buyer_review(req: BuyerReviewRequest, user: dict = Depends(require_role("seller"))):
    db = get_db()
    order = await db.orders.find_one({"id": req.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not my_seller or my_seller["id"] != order["seller_id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if order["status"] not in ("delivered", "collected"):
        raise HTTPException(status_code=400, detail="Vous ne pouvez noter qu'après livraison")

    existing = await db.buyer_reviews.find_one({"order_id": req.order_id, "rater_user_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà noté ce client")

    review = {
        "id": str(uuid.uuid4()),
        "order_id": req.order_id,
        "rater_user_id": user["id"],
        "seller_id": order["seller_id"],
        "seller_name": my_seller.get("shop_name"),
        "buyer_id": order["buyer_id"],
        "rating": req.rating,
        "created_at": _now(),
    }
    await db.buyer_reviews.insert_one(review)
    await _update_buyer_rating(db, order["buyer_id"])
    review.pop("_id", None)
    return review


@router.get("/buyers/{buyer_id}/rating")
async def get_buyer_rating(buyer_id: str):
    """Public: any seller can check a buyer's reliability rating."""
    db = get_db()
    u = await db.users.find_one({"id": buyer_id}, {"_id": 0, "buyer_rating": 1, "buyer_reviews_count": 1})
    if not u:
        raise HTTPException(status_code=404, detail="Acheteur introuvable")
    return {
        "buyer_rating": u.get("buyer_rating", 0.0),
        "buyer_reviews_count": u.get("buyer_reviews_count", 0),
    }
