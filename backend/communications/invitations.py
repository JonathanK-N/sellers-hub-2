"""Shop-owned invitations; acceptance never bypasses KYC or seller approval."""
from datetime import timedelta, timezone
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from auth import require_role, get_current_user_dep
from db import get_db
from financial_transactions import run_transaction
from .router import router, enabled, address, Token
from .tokens import issue, consume, digest, allow_request
from .outbox import now, enqueue
from .config import configuration
from .render import render
from .events import emit


class InvitationRequest(BaseModel):
    email: str = Field(max_length=254)
    name: str = Field(min_length=1, max_length=100)


async def shop(db, user):
    row = await db.sellers.find_one({"user_id": user["id"]})
    if not row:
        raise HTTPException(404, "Boutique introuvable")
    return row


def public(row):
    return {key: row[key] for key in ("id", "email", "name", "status", "expires_at")}


async def invitation_link(db, row, seller, owner):
    config = configuration()
    token = await issue(db, "invitation", owner["id"], 48 * 60, invitation_id=row["id"], generation=row["generation"])
    subject, html, text = render("deliverer_invitation", {"prenom": row["name"],
        "boutique": seller.get("shop_name", ""), "vendeur": owner.get("name", ""),
        "logo_url": config["logo"], "lien_action": config["frontend"].rstrip("/") + "/email/invitation#token=" + token})
    await enqueue(db, "invitation/" + row["id"] + "/" + str(row["generation"]), row["email"], subject, html, text,
                  expires_at=row["expires_at"])


@router.post("/seller/invitations", status_code=201)
async def invite(req: InvitationRequest, user=Depends(require_role("seller"))):
    enabled()
    db = get_db()
    if not await allow_request(db, "invite", user["id"], maximum=10, seconds=3600):
        raise HTTPException(429, "Limite d’invitations atteinte")
    async def operation(bound):
        seller = await shop(bound, user)
        email = address(req.email)
        # One active invitation per recipient/shop. The _id is also the concurrency guard.
        key = digest(seller["id"] + ":" + email)
        existing = await bound.email_invitations.find_one({"_id": key})
        if existing and existing["status"] in ("pending", "accepted"):
            raise HTTPException(409, "Invitation déjà existante ; utilisez le renvoi")
        row = {"_id": key, "id": key, "email": email, "name": req.name, "seller_id": seller["id"],
            "owner_id": user["id"], "status": "pending", "generation": (existing or {}).get("generation", 0) + 1,
            "expires_at": now() + timedelta(hours=48)}
        await bound.email_invitations.replace_one({"_id": key}, row, upsert=True)
        await invitation_link(bound, row, seller, user)
        return public(row)
    return await run_transaction(db, operation)


@router.get("/seller/invitations")
async def invitations(user=Depends(require_role("seller"))):
    rows = await get_db().email_invitations.find({"owner_id": user["id"]}).limit(100).to_list(100)
    result = []
    for row in rows:
        value = public(row)
        if value["status"] == "pending" and value["expires_at"].replace(tzinfo=timezone.utc) < now():
            value["status"] = "expired"
        result.append(value)
    return result


@router.post("/seller/invitations/{invitation_id}/{action}")
async def manage(invitation_id: str, action: str, user=Depends(require_role("seller"))):
    enabled()
    if action not in ("cancel", "resend"):
        raise HTTPException(404, "Action introuvable")
    db = get_db()
    if not await allow_request(db, "manage-invite", user["id"], maximum=20, seconds=3600):
        raise HTTPException(429, "Veuillez patienter")
    async def operation(bound):
        row = await bound.email_invitations.find_one({"id": invitation_id, "owner_id": user["id"]})
        if not row:
            raise HTTPException(404, "Invitation introuvable")
        if row["status"] == "accepted":
            raise HTTPException(409, "Invitation déjà acceptée")
        row.update(generation=row["generation"] + 1, status="cancelled" if action == "cancel" else "pending",
                   expires_at=now() + timedelta(hours=48))
        await bound.email_invitations.replace_one({"_id": row["_id"]}, row)
        if action == "resend":
            await invitation_link(bound, row, await shop(bound, user), user)
        else:
            await emit(bound, "invitation_expired_or_cancelled", row["id"] + "/cancel/" + str(row["generation"]),
                       user, path="/seller/email-invitations")
        return public(row)
    return await run_transaction(db, operation)


@router.post("/invitations/accept")
async def accept(req: Token, user=Depends(get_current_user_dep)):
    enabled()
    if user["role"] != "buyer" or not user.get("email_verified"):
        raise HTTPException(403, "Connectez-vous avec le compte acheteur et l’e-mail vérifié de l’invitation")
    async def operation(db):
        token = await consume(db, req.token, "invitation")
        row = await db.email_invitations.find_one({"id": token["invitation_id"], "status": "pending",
            "generation": token["generation"], "email": user["email"], "expires_at": {"$gt": now()}})
        if not row:
            raise HTTPException(400, "Invitation invalide ou expirée")
        if await db.deliverers.find_one({"user_id": user["id"]}):
            raise HTTPException(409, "Une affiliation livreur existe déjà")
        existing = await db.deliverer_applications.find_one({"user_id": user["id"], "status": {"$in": ["draft", "pending", "approved"]}})
        if existing:
            raise HTTPException(409, "Une candidature existe déjà")
        await db.email_invitations.update_one({"_id": row["_id"]}, {"$set": {"status": "accepted", "recipient_id": user["id"]}})
        owner = await db.users.find_one({"id": row["owner_id"]}) or {}
        await emit(db, "invitation_accepted", row["id"] + "/" + str(row["generation"]), owner,
                   path="/seller/deliverer-applications")
        return {"ok": True, "seller_id": row["seller_id"], "next": "/become-deliverer?shop=" + row["seller_id"]}
    return await run_transaction(get_db(), operation)


async def expire_invitations(db):
    if configuration()["mode"] == "disabled":
        return
    from pymongo import ReturnDocument
    async def operation(bound):
        row = await bound.email_invitations.find_one_and_update(
            {"status": "pending", "expires_at": {"$lte": now()}},
            {"$set": {"status": "expired"}}, return_document=ReturnDocument.AFTER)
        if row:
            owner = await bound.users.find_one({"id": row["owner_id"]}) or {}
            await emit(bound, "invitation_expired_or_cancelled", row["id"] + "/expired/" + str(row["generation"]),
                       owner, path="/seller/email-invitations")
    await run_transaction(db, operation)
