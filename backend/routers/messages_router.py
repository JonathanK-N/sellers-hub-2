"""Private messaging. Author: Jonathan Kakesa (JonathanK-N)."""
import base64
import binascii
import hashlib
import json
import re
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from db import get_db
from auth import get_current_user_dep

router = APIRouter(prefix="/messages", tags=["messages"])
ID_PATTERN = r"^[A-Za-z0-9_-]{1,128}$"


def _now():
    return datetime.now(timezone.utc).isoformat()


def _conv_id(buyer_id, seller_id):
    return buyer_id + "__" + seller_id


def _active(user):
    return user and not any(user.get(k) for k in ("banned", "suspended", "is_deleted", "deleted")) and user.get("is_active") is not False


class SendMessageRequest(BaseModel):
    seller_id: str | None = Field(default=None, pattern=ID_PATTERN)
    buyer_id: str | None = Field(default=None, pattern=ID_PATTERN)
    order_id: str | None = Field(default=None, pattern=ID_PATTERN)
    product_id: str | None = Field(default=None, pattern=ID_PATTERN)
    client_message_id: str | None = Field(default=None, min_length=8, max_length=128, pattern=ID_PATTERN)
    text: str = Field(min_length=1, max_length=2000)


async def _participants(db, conversation_id, user, writing=False):
    parts = conversation_id.split("__")
    if len(parts) != 2 or any(not re.fullmatch(ID_PATTERN, p) for p in parts):
        raise HTTPException(404, "Conversation introuvable")
    buyer_id, seller_id = parts
    if not _active(user) or user.get("role") not in {"buyer", "seller"}:
        raise HTTPException(403, "Accès refusé")
    if user["role"] == "buyer" and buyer_id != user["id"]:
        raise HTTPException(404, "Conversation introuvable")
    seller = await db.sellers.find_one({"id": seller_id})
    if user["role"] == "seller" and (not seller or seller.get("user_id") != user["id"]):
        raise HTTPException(404, "Conversation introuvable")
    buyer = await db.users.find_one({"id": buyer_id, "role": "buyer"})
    seller_user = await db.users.find_one({"id": seller["user_id"], "role": "seller"}) if seller else None
    if writing:
        if not _active(buyer) or not _active(seller_user) or not _active(seller):
            raise HTTPException(409, "Un participant n’est plus disponible")
    elif not seller or not buyer:
        if not await db.messages.find_one({"conversation_id": conversation_id, "buyer_id": buyer_id, "seller_id": seller_id}):
            raise HTTPException(404, "Conversation introuvable")
    return buyer_id, seller_id, seller, buyer


def _encode_cursor(message):
    return base64.urlsafe_b64encode(json.dumps([message["created_at"], message["id"]]).encode()).decode().rstrip("=")


def _decode_cursor(value):
    try:
        data = json.loads(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)))
        if not isinstance(data, list) or len(data) != 2 or not all(isinstance(x, str) for x in data):
            raise ValueError
        datetime.fromisoformat(data[0].replace("Z", "+00:00"))
        if len(data[0]) > 40 or not re.fullmatch(ID_PATTERN, data[1]):
            raise ValueError
        return data
    except (ValueError, TypeError, UnicodeDecodeError, binascii.Error):
        raise HTTPException(422, "Curseur de messages invalide")


def _cursor_query(value, direction):
    stamp, identifier = _decode_cursor(value)
    operator = "$lt" if direction == "before" else "$gt"
    return {"$or": [{"created_at": {operator: stamp}}, {"created_at": stamp, "id": {operator: identifier}}]}


@router.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user_dep), limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0, le=5000)):
    db = get_db()
    if user["role"] == "buyer":
        query = {"buyer_id": user["id"]}
    elif user["role"] == "seller":
        seller = await db.sellers.find_one({"user_id": user["id"]})
        if not seller:
            return []
        query = {"seller_id": seller["id"]}
    else:
        raise HTTPException(403, "Accès refusé")
    pipeline = [
        {"$match": query}, {"$sort": {"created_at": -1, "id": -1}},
        {"$group": {"_id": "$conversation_id", "last_message": {"$first": "$$ROOT"}, "unread_count": {"$sum": {"$cond": [{"$and": [{"$eq": ["$read", False]}, {"$eq": ["$to_user_id", user["id"]]}]}, 1, 0]}}}},
        {"$sort": {"last_message.created_at": -1, "_id": 1}}, {"$skip": offset}, {"$limit": limit},
    ]
    out = []
    async for row in db.messages.aggregate(pipeline):
        message = row["last_message"]
        other = await (db.sellers.find_one({"id": message["seller_id"]}) if user["role"] == "buyer" else db.users.find_one({"id": message["buyer_id"]}))
        out.append({"conversation_id": row["_id"], "other_name": (other or {}).get("shop_name" if user["role"] == "buyer" else "name", "Compte indisponible"), "last_text": message["text"], "last_at": message["created_at"], "unread_count": row["unread_count"], "buyer_id": message["buyer_id"], "seller_id": message["seller_id"]})
    return out


@router.get("/conversations/{conversation_id}/history")
async def history(conversation_id: str, user: dict = Depends(get_current_user_dep), limit: int = Query(default=50, ge=1, le=100), before: str | None = Query(default=None, max_length=512), after: str | None = Query(default=None, max_length=512)):
    db = get_db()
    await _participants(db, conversation_id, user)
    if before and after:
        raise HTTPException(422, "Choisir before ou after")
    query = {"conversation_id": conversation_id}
    if before or after:
        query.update(_cursor_query(before or after, "before" if before else "after"))
    direction = 1 if after else -1
    messages = await db.messages.find(query, {"_id": 0, "request_hash": 0}).sort([("created_at", direction), ("id", direction)]).limit(limit + 1).to_list(limit + 1)
    more = len(messages) > limit
    messages = messages[:limit]
    if not after:
        messages.reverse()
    return {"messages": messages, "has_more": more, "next_before": _encode_cursor(messages[0]) if messages else None, "latest_cursor": _encode_cursor(messages[-1]) if messages else after}


class ReadRequest(BaseModel):
    through: str = Field(min_length=1, max_length=512)


@router.post("/conversations/{conversation_id}/read")
async def mark_read(conversation_id: str, req: ReadRequest, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    await _participants(db, conversation_id, user)
    stamp, identifier = _decode_cursor(req.through)
    query = {"conversation_id": conversation_id, "to_user_id": user["id"], "read": False, "$or": [{"created_at": {"$lt": stamp}}, {"created_at": stamp, "id": {"$lte": identifier}}]}
    result = await db.messages.update_many(query, {"$set": {"read": True, "read_at": _now()}})
    return {"marked_read": result.modified_count}


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, user: dict = Depends(get_current_user_dep)):
    page = await history(conversation_id, user, 100, None, None)
    if page["latest_cursor"]:
        await mark_read(conversation_id, ReadRequest(through=page["latest_cursor"]), user)
    return page["messages"]


async def _ensure_notification(db, message):
    identifier = "message:" + message["id"]
    await db.notifications.update_one({"_id": identifier}, {"$setOnInsert": {"id": identifier, "user_id": message["to_user_id"], "type": "message_received", "title": "Nouveau message", "body": "Un participant vous a envoyé un message.", "data": {"conversation_id": message["conversation_id"]}, "read": False, "created_at": message["created_at"]}}, upsert=True)


@router.post("", status_code=201)
async def send_message(req: SendMessageRequest, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "Message vide")
    if user["role"] == "buyer":
        buyer_id, seller_id = user["id"], req.seller_id
    elif user["role"] == "seller":
        seller = await db.sellers.find_one({"user_id": user["id"]})
        buyer_id, seller_id = req.buyer_id, (seller or {}).get("id")
    else:
        raise HTTPException(403, "Accès refusé")
    if not buyer_id or not seller_id:
        raise HTTPException(422, "Participants requis")
    conversation_id = _conv_id(buyer_id, seller_id)
    _, _, seller, _ = await _participants(db, conversation_id, user, writing=True)
    if req.order_id and not await db.orders.find_one({"id": req.order_id, "buyer_id": buyer_id, "seller_id": seller_id}):
        raise HTTPException(404, "Commande introuvable")
    if req.product_id and not await db.products.find_one({"id": req.product_id, "seller_id": seller_id, "is_active": {"$ne": False}}):
        raise HTTPException(404, "Produit introuvable")
    fingerprint = hashlib.sha256(json.dumps([conversation_id, req.order_id, req.product_id, text], separators=(",", ":")).encode()).hexdigest()
    key = req.client_message_id or str(uuid.uuid4())
    identifier = "message:" + user["id"] + ":" + key
    previous = await db.messages.find_one({"_id": identifier})
    if previous:
        if previous.get("request_hash") != fingerprint:
            raise HTTPException(409, "Identifiant de message réutilisé pour un autre contenu")
        await _ensure_notification(db, previous)
        previous.pop("_id", None)
        previous.pop("request_hash", None)
        return previous
    now = datetime.now(timezone.utc)
    bucket = "messages:" + user["id"] + ":" + str(int(now.timestamp()) // 60)
    rate = await db.message_rate_limits.find_one_and_update({"_id": bucket}, {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": now + timedelta(minutes=2)}}, upsert=True, return_document=ReturnDocument.AFTER)
    if rate["count"] > 30:
        raise HTTPException(429, "Trop de messages ; réessayez dans une minute", headers={"Retry-After": "60"})
    message = {"_id": identifier, "id": str(uuid.uuid4()), "conversation_id": conversation_id, "buyer_id": buyer_id, "seller_id": seller_id, "client_message_id": key, "from_user_id": user["id"], "to_user_id": seller["user_id"] if user["role"] == "buyer" else buyer_id, "order_id": req.order_id, "product_id": req.product_id, "text": text, "read": False, "created_at": now.isoformat(), "request_hash": fingerprint}
    await db.messages.update_one({"_id": identifier}, {"$setOnInsert": message}, upsert=True)
    saved = await db.messages.find_one({"_id": identifier})
    if saved["request_hash"] != fingerprint:
        raise HTTPException(409, "Identifiant de message réutilisé pour un autre contenu")
    await _ensure_notification(db, saved)
    saved.pop("_id", None)
    saved.pop("request_hash", None)
    return saved


@router.get("/unread-count")
async def unread_count(user: dict = Depends(get_current_user_dep)):
    if user["role"] not in {"buyer", "seller"}:
        raise HTTPException(403, "Accès refusé")
    return {"count": await get_db().messages.count_documents({"to_user_id": user["id"], "read": False})}
