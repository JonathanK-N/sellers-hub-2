"""Admin panel endpoints."""
import io
import csv
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db import get_db
from auth import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


class KycRejectRequest(BaseModel):
    reason: str = ""


class CountryToggleRequest(BaseModel):
    is_active: bool


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
    sellers = await db.sellers.find({"kyc_status": {"$in": ["level1", "pending", "pending_review"]}}, {"_id": 0}).to_list(200)
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
    requested = seller.get("kyc_requested_level", 2)
    badge = requested >= 3
    new_status = "level3" if badge else "level2"
    await db.sellers.update_one(
        {"id": seller_id},
        {"$set": {"kyc_status": new_status, "badge_verified": badge, "kyc_reject_reason": None}},
    )
    await db.users.update_one(
        {"id": seller["user_id"]}, {"$set": {"kyc_level": requested}}
    )
    return {"ok": True, "level": requested, "badge": badge}


@router.get("/kyc/{seller_id}/docs")
async def kyc_docs(seller_id: str, _: dict = Depends(require_role("admin"))):
    """List KYC document file IDs for a given seller."""
    db = get_db()
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur introuvable")
    docs = seller.get("kyc_docs") or {}
    return {
        "seller_id": seller_id,
        "docs": {k: {"file_id": v.get("file_id"), "url": f"/api/files/{v.get('file_id')}", "uploaded_at": v.get("uploaded_at")} for k, v in docs.items()},
    }


@router.post("/kyc/{seller_id}/reject")
async def kyc_reject(seller_id: str, req: KycRejectRequest, _: dict = Depends(require_role("admin"))):
    db = get_db()
    res = await db.sellers.update_one(
        {"id": seller_id},
        {"$set": {"kyc_status": "rejected", "badge_verified": False, "kyc_reject_reason": req.reason}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendeur introuvable")
    return {"ok": True}


@router.get("/geo/overview")
async def geo_overview(_: dict = Depends(require_role("admin"))):
    db = get_db()
    countries = await db.countries.find({}, {"_id": 0}).to_list(50)
    total_users = max(1, await db.users.count_documents({"role": {"$ne": "admin"}}))

    out = []
    for c in countries:
        code = c["code"]
        users_count = await db.users.count_documents({"country_code": code, "role": {"$ne": "admin"}})
        sellers_count = await db.users.count_documents({"country_code": code, "role": "seller"})
        # Revenue & commission (released)
        pipeline = [
            {"$match": {"country_code": code, "escrow_status": "released"}},
            {"$group": {"_id": None, "revenue": {"$sum": "$total_amount"}, "commission": {"$sum": "$commission_amount"}, "orders": {"$sum": 1}}},
        ]
        rows = await db.orders.aggregate(pipeline).to_list(1)
        rev = rows[0] if rows else {"revenue": 0, "commission": 0, "orders": 0}
        out.append({
            "code": code,
            "name": c["name"],
            "flag": c["flag"],
            "currency": c["currency"],
            "is_active": c.get("is_active", True),
            "users": users_count,
            "sellers": sellers_count,
            "users_pct": round((users_count / total_users) * 100, 1),
            "revenue": rev["revenue"],
            "commission": rev["commission"],
            "orders": rev["orders"],
        })
    return out


@router.get("/geo/growth")
async def geo_growth(_: dict = Depends(require_role("admin"))):
    """6-month registration growth per country."""
    db = get_db()
    now = datetime.now(timezone.utc)
    buckets = []
    # Walk back 5 months, then current
    year, month = now.year, now.month
    months_back = []
    for i in range(6):
        m = month - i
        y = year
        while m <= 0:
            m += 12
            y -= 1
        months_back.append((y, m))
    months_back.reverse()
    month_names_fr = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
    for y, m in months_back:
        buckets.append({"label": f"{month_names_fr[m-1]} {y}", "year": y, "month": m})

    countries = await db.countries.find({}, {"_id": 0, "code": 1}).to_list(50)
    series = {b["label"]: {c["code"]: 0 for c in countries} for b in buckets}

    async for u in db.users.find({"role": {"$ne": "admin"}}, {"_id": 0, "country_code": 1, "created_at": 1}):
        try:
            ts = datetime.fromisoformat(u["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        for b in buckets:
            if ts.year == b["year"] and ts.month == b["month"]:
                series[b["label"]][u["country_code"]] = series[b["label"]].get(u["country_code"], 0) + 1
                break

    out = []
    for b in buckets:
        row = {"label": b["label"], **series[b["label"]]}
        out.append(row)
    return out


@router.get("/geo/alerts")
async def geo_alerts(_: dict = Depends(require_role("admin"))):
    """Compute alerts about countries: not opened with demand, sellers shortage, etc."""
    db = get_db()
    alerts = []

    # Pending KYC > 5
    pending_kyc = await db.sellers.count_documents({"kyc_status": "pending_review"})
    if pending_kyc >= 1:
        alerts.append({
            "level": "warning",
            "title": f"{pending_kyc} KYC en attente de vérification",
            "action": "Traiter la file KYC",
        })

    # Open disputes urgent
    now = datetime.now(timezone.utc)
    urgent_count = 0
    async for d in db.disputes.find({"status": "open"}, {"_id": 0}):
        try:
            t = datetime.fromisoformat(d["created_at"].replace("Z", "+00:00"))
            if (now - t).days > 5:
                urgent_count += 1
        except Exception:
            pass
    if urgent_count > 0:
        alerts.append({
            "level": "danger",
            "title": f"{urgent_count} litige(s) urgent(s) (escrow bloqué > 5 jours)",
            "action": "Résoudre les litiges",
        })

    # Country with users but few sellers
    countries = await db.countries.find({"is_active": True}, {"_id": 0}).to_list(50)
    for c in countries:
        buyers = await db.users.count_documents({"country_code": c["code"], "role": "buyer"})
        sellers = await db.users.count_documents({"country_code": c["code"], "role": "seller"})
        if buyers > 5 and sellers < buyers / 5:
            alerts.append({
                "level": "info",
                "title": f"{c['name']} : forte demande mais peu de vendeurs",
                "action": "Recruter vendeurs",
            })

    # Inactive countries with many users
    inactive = await db.countries.find({"is_active": False}, {"_id": 0}).to_list(50)
    for c in inactive:
        users = await db.users.count_documents({"country_code": c["code"]})
        if users >= 20:
            alerts.append({
                "level": "info",
                "title": f"{c['name']} : {users} inscrits, envisager l'ouverture",
                "action": "Activer le pays",
            })

    return alerts


@router.patch("/countries/{code}")
async def toggle_country(code: str, req: CountryToggleRequest, _: dict = Depends(require_role("admin"))):
    db = get_db()
    res = await db.countries.update_one({"code": code}, {"$set": {"is_active": req.is_active}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pays introuvable")
    return {"ok": True, "code": code, "is_active": req.is_active}


@router.get("/export/users")
async def export_users_csv(_: dict = Depends(require_role("admin"))):
    db = get_db()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "name", "phone", "role", "country_code", "currency", "kyc_level", "created_at"])
    async for u in db.users.find({}, {"_id": 0, "otp_code": 0, "otp_expires_at": 0}):
        writer.writerow([u.get("id"), u.get("name"), u.get("phone"), u.get("role"), u.get("country_code"), u.get("currency"), u.get("kyc_level"), u.get("created_at")])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=users.csv"})


@router.get("/export/orders")
async def export_orders_csv(_: dict = Depends(require_role("admin"))):
    db = get_db()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "buyer_id", "seller_id", "country_code", "total_amount", "commission_amount", "currency", "status", "escrow_status", "delivery_mode", "payment_method", "created_at"])
    async for o in db.orders.find({}, {"_id": 0}):
        writer.writerow([o.get("id"), o.get("buyer_id"), o.get("seller_id"), o.get("country_code"), o.get("total_amount"), o.get("commission_amount"), o.get("currency"), o.get("status"), o.get("escrow_status"), o.get("delivery_mode"), o.get("payment_method"), o.get("created_at")])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=orders.csv"})
