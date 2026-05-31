"""Admin panel endpoints."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends

from db import get_db
from auth import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview")
async def overview(_: dict = Depends(require_role("admin"))):
    db = get_db()
    users_count = await db.users.count_documents({})
    buyers = await db.users.count_documents({"role": "buyer"})
    sellers = await db.users.count_documents({"role": "seller"})
    products = await db.products.count_documents({})
    orders = await db.orders.count_documents({})
    open_kyc = await db.sellers.count_documents({"kyc_status": {"$in": ["level1", "pending"]}})

    # Sum commissions released
    pipeline = [
        {"$match": {"escrow_status": "released"}},
        {"$group": {"_id": "$country_code", "commission": {"$sum": "$commission_amount"}, "count": {"$sum": 1}}},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(50)
    by_country = {r["_id"]: {"commission": r["commission"], "orders": r["count"]} for r in rows}
    total_commission = sum(r["commission"] for r in rows)

    return {
        "users_count": users_count,
        "buyers_count": buyers,
        "sellers_count": sellers,
        "products_count": products,
        "orders_count": orders,
        "open_kyc": open_kyc,
        "total_commission": total_commission,
        "by_country": by_country,
    }


@router.get("/users")
async def list_users(_: dict = Depends(require_role("admin"))):
    db = get_db()
    users = await db.users.find({}, {"_id": 0, "otp_code": 0, "otp_expires_at": 0}).sort("created_at", -1).to_list(500)
    return users


@router.get("/sellers")
async def list_sellers(_: dict = Depends(require_role("admin"))):
    db = get_db()
    sellers = await db.sellers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    user_ids = list({s["user_id"] for s in sellers})
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0})}
    for s in sellers:
        u = users.get(s["user_id"])
        if u:
            s["owner_name"] = u.get("name")
            s["owner_phone"] = u.get("phone")
            s["owner_kyc_level"] = u.get("kyc_level", 1)
    return sellers


@router.get("/orders")
async def list_orders(_: dict = Depends(require_role("admin"))):
    db = get_db()
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@router.get("/kyc/pending")
async def kyc_pending(_: dict = Depends(require_role("admin"))):
    db = get_db()
    sellers = await db.sellers.find({"kyc_status": {"$in": ["level1", "pending"]}}, {"_id": 0}).to_list(200)
    user_ids = list({s["user_id"] for s in sellers})
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0})}
    for s in sellers:
        u = users.get(s["user_id"])
        if u:
            s["owner_name"] = u.get("name")
            s["owner_phone"] = u.get("phone")
    return sellers


@router.post("/kyc/{seller_id}/approve")
async def kyc_approve(seller_id: str, _: dict = Depends(require_role("admin"))):
    db = get_db()
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur introuvable")
    await db.sellers.update_one(
        {"id": seller_id},
        {"$set": {"kyc_status": "level3", "badge_verified": True}},
    )
    await db.users.update_one(
        {"id": seller["user_id"]}, {"$set": {"kyc_level": 3}}
    )
    return {"ok": True}


@router.post("/kyc/{seller_id}/reject")
async def kyc_reject(seller_id: str, _: dict = Depends(require_role("admin"))):
    db = get_db()
    res = await db.sellers.update_one(
        {"id": seller_id},
        {"$set": {"kyc_status": "rejected", "badge_verified": False}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendeur introuvable")
    return {"ok": True}
