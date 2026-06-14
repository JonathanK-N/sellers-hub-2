"""Seller Premium subscription (monthly recurring revenue)."""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db import get_db
from auth import require_role
from payments.service import get_provider, cinetpay_configured
from notifications import create_notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/premium", tags=["premium"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Monthly plans, priced per currency zone. Prices are illustrative starting points.
PLANS = {
    "FC": {"price": 15000, "label": "Premium mensuel"},
    "XAF": {"price": 5000, "label": "Premium mensuel"},
    "XOF": {"price": 5000, "label": "Premium mensuel"},
}

PREMIUM_BENEFITS = [
    "Badge Boutique Premium visible partout",
    "Visibilité prioritaire dans les recherches",
    "Produits illimités",
    "Statistiques avancées",
    "Accès au réseau de livreurs AfriMarket",
]


def _is_active(seller: dict) -> bool:
    if not seller.get("premium"):
        return False
    exp = seller.get("premium_expires_at")
    if not exp:
        return False
    try:
        return datetime.fromisoformat(exp.replace("Z", "+00:00")) > datetime.now(timezone.utc)
    except Exception:
        return False


@router.get("/plan")
async def get_plan(user: dict = Depends(require_role("seller"))):
    """Return the Premium plan for the seller's currency + current status."""
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=400, detail="Boutique manquante")
    currency = user["currency"]
    plan = PLANS.get(currency, {"price": 5000, "label": "Premium mensuel"})
    active = _is_active(seller)
    return {
        "currency": currency,
        "price": plan["price"],
        "label": plan["label"],
        "benefits": PREMIUM_BENEFITS,
        "active": active,
        "expires_at": seller.get("premium_expires_at") if active else None,
        "auto_renew": seller.get("premium_auto_renew", False),
    }


class SubscribeRequest(BaseModel):
    payment_method: str = ""


@router.post("/subscribe")
async def subscribe(req: SubscribeRequest, user: dict = Depends(require_role("seller"))):
    """Start a Premium subscription. With CinetPay configured, returns a payment_url;
    in sandbox, activates immediately for one month.
    """
    db = get_db()
    seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=400, detail="Boutique manquante")
    currency = user["currency"]
    plan = PLANS.get(currency, {"price": 5000, "label": "Premium mensuel"})
    sub_id = str(uuid.uuid4())

    sub = {
        "id": sub_id,
        "seller_id": seller["id"],
        "user_id": user["id"],
        "amount": plan["price"],
        "currency": currency,
        "status": "pending",
        "created_at": _now(),
    }
    await db.premium_subscriptions.insert_one(sub)

    if cinetpay_configured():
        provider = get_provider(req.payment_method or "")
        result = await provider.collect(
            phone=user.get("phone", ""),
            amount=plan["price"],
            currency=currency,
            external_ref=f"premium_{sub_id}",
            description="Abonnement AfriMarket Premium",
        )
        if not result.ok:
            raise HTTPException(status_code=502, detail=f"Échec paiement: {result.error}")
        await db.premium_subscriptions.update_one({"id": sub_id}, {"$set": {"payment_ref": result.reference}})
        return {"simulated": False, "payment_url": result.payment_url, "subscription_id": sub_id}

    # Sandbox: activate immediately
    await _activate_premium(db, seller["id"], user["id"], sub_id)
    return {"simulated": True, "active": True, "subscription_id": sub_id}


async def _activate_premium(db, seller_id: str, user_id: str, sub_id: str):
    """Activate or extend Premium by one month from the later of now / current expiry."""
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    base = datetime.now(timezone.utc)
    cur_exp = seller.get("premium_expires_at") if seller else None
    if cur_exp:
        try:
            existing = datetime.fromisoformat(cur_exp.replace("Z", "+00:00"))
            if existing > base:
                base = existing
        except Exception:
            pass
    new_exp = (base + timedelta(days=30)).isoformat()
    await db.sellers.update_one(
        {"id": seller_id},
        {"$set": {"premium": True, "premium_expires_at": new_exp, "premium_since": seller.get("premium_since") or _now(), "delivery_service": "afrimarket"}},
    )
    await db.premium_subscriptions.update_one(
        {"id": sub_id},
        {"$set": {"status": "active", "activated_at": _now(), "expires_at": new_exp}},
    )
    try:
        await create_notification(
            user_id, "kyc_approved", "Premium activé",
            "Votre boutique est maintenant Premium pour 30 jours.", {"subscription_id": sub_id},
        )
    except Exception:
        pass


@router.post("/cancel")
async def cancel_auto_renew(user: dict = Depends(require_role("seller"))):
    """Disable auto-renew. Premium stays active until expiry."""
    db = get_db()
    await db.sellers.update_one({"user_id": user["id"]}, {"$set": {"premium_auto_renew": False}})
    return {"ok": True}
