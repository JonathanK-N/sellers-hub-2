"""In-app messaging between buyer and seller."""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db import get_db
from auth import get_current_user_dep

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/messages", tags=["messages"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _conv_id(buyer_id: str, seller_id: str) -> str:
    return f"{buyer_id}__{seller_id}"


class SendMessageRequest(BaseModel):
    seller_id: Optional[str] = None  # required if buyer initiates
    buyer_id: Optional[str] = None   # required if seller initiates
    order_id: Optional[str] = None
    product_id: Optional[str] = None
    text: str


@router.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user_dep)):
    """List user's conversations grouped by other party with last message preview."""
    db = get_db()
    if user["role"] == "buyer":
        q = {"buyer_id": user["id"]}
    else:
        seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
        if not seller:
            return []
        q = {"seller_id": seller["id"]}

    pipeline = [
        {"$match": q},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$conversation_id",
            "last_message": {"$first": "$$ROOT"},
            "unread_count": {
                "$sum": {
                    "$cond": [
                        {"$and": [
                            {"$eq": ["$read", False]},
                            {"$ne": ["$from_user_id", user["id"]]},
                        ]},
                        1, 0,
                    ]
                }
            },
        }},
        {"$sort": {"last_message.created_at": -1}},
    ]
    rows = await db.messages.aggregate(pipeline).to_list(200)
    # Enrich
    out = []
    for r in rows:
        lm = r["last_message"]
        if user["role"] == "buyer":
            other = await db.sellers.find_one({"id": lm["seller_id"]}, {"_id": 0})
            other_name = other.get("shop_name") if other else "Vendeur"
        else:
            other = await db.users.find_one({"id": lm["buyer_id"]}, {"_id": 0, "otp_code": 0, "otp_expires_at": 0})
            other_name = other.get("name") if other else "Acheteur"
        out.append({
            "conversation_id": r["_id"],
            "other_name": other_name,
            "last_text": lm["text"],
            "last_at": lm["created_at"],
            "unread_count": r["unread_count"],
            "buyer_id": lm["buyer_id"],
            "seller_id": lm["seller_id"],
        })
    return out


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    msgs = await db.messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # Auth check: user must be either buyer or seller in this convo
    if not msgs:
        return []
    sample = msgs[0]
    is_authorized = False
    if user["role"] == "buyer" and sample["buyer_id"] == user["id"]:
        is_authorized = True
    elif user["role"] == "seller":
        seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
        if seller and seller["id"] == sample["seller_id"]:
            is_authorized = True
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Accès refusé")
    # Mark unread received messages as read
    await db.messages.update_many(
        {"conversation_id": conversation_id, "read": False, "from_user_id": {"$ne": user["id"]}},
        {"$set": {"read": True}},
    )
    return msgs


@router.post("", status_code=201)
async def send_message(req: SendMessageRequest, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Message vide")

    if user["role"] == "buyer":
        if not req.seller_id:
            raise HTTPException(status_code=400, detail="seller_id requis")
        buyer_id = user["id"]
        seller_id = req.seller_id
        seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
        if not seller:
            raise HTTPException(status_code=404, detail="Vendeur introuvable")
        to_user_id = seller["user_id"]
    elif user["role"] == "seller":
        if not req.buyer_id:
            raise HTTPException(status_code=400, detail="buyer_id requis")
        my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0})
        if not my_seller:
            raise HTTPException(status_code=400, detail="Boutique introuvable")
        buyer_id = req.buyer_id
        seller_id = my_seller["id"]
        to_user_id = buyer_id
    else:
        raise HTTPException(status_code=403, detail="Rôle invalide")

    conv = _conv_id(buyer_id, seller_id)
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv,
        "buyer_id": buyer_id,
        "seller_id": seller_id,
        "from_user_id": user["id"],
        "to_user_id": to_user_id,
        "order_id": req.order_id,
        "product_id": req.product_id,
        "text": req.text.strip(),
        "read": False,
        "created_at": _now(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    return msg


@router.get("/unread-count")
async def unread_count(user: dict = Depends(get_current_user_dep)):
    db = get_db()
    count = await db.messages.count_documents({"to_user_id": user["id"], "read": False})
    return {"count": count}
