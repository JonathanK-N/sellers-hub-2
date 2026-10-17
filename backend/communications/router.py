"""Email verification, password reset, provider webhooks and synthetic admin previews."""
import os
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from auth import get_current_user_dep, require_role, hash_password
from db import get_db
from financial_transactions import run_transaction
from .config import configuration, mailbox
from .events import emit
from .outbox import enqueue, now
from .render import CATALOG, render
from .tokens import issue, consume, allow_request
from .webhooks import verify, handle

def private_response(response: Response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"


router = APIRouter(prefix="/communications", tags=["communications"], dependencies=[Depends(private_response)])


class Address(BaseModel):
    email: str = Field(max_length=254)


class Token(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class Reset(Token):
    password: str = Field(min_length=12, max_length=72)


def enabled():
    if configuration()["mode"] == "disabled":
        raise HTTPException(503, "Le service e-mail n’est pas activé")


def address(value):
    try:
        return mailbox(value)
    except ValueError:
        raise HTTPException(422, "Adresse e-mail invalide")


async def send_link(db, purpose, user, recipient, minutes):
    config = configuration()
    token = await issue(db, purpose, user["id"], minutes, email=recipient)
    path = "/email/verify" if purpose == "verify_email" else "/email/reset"
    subject, html, text = render(purpose, {"prenom": user.get("name", ""),
        "email": recipient, "logo_url": config["logo"],
        "lien_action": config["frontend"].rstrip("/") + path + "#token=" + token})
    await enqueue(db, purpose + "/" + token[:16], recipient, subject, html, text,
                  expires_at=now() + timedelta(minutes=minutes))


@router.post("/email/request-verification", status_code=202)
async def request_verification(req: Address, user=Depends(get_current_user_dep)):
    enabled()
    db = get_db()
    target = address(req.email)
    if not await allow_request(db, "verify", user["id"]):
        raise HTTPException(429, "Veuillez patienter avant de réessayer")
    async def operation(bound):
        await send_link(bound, "verify_email", user, target, 24 * 60)
    await run_transaction(db, operation)
    return {"ok": True}


@router.post("/email/verify")
async def verify_email(req: Token):
    enabled()
    async def operation(db):
        row = await consume(db, req.token, "verify_email")
        owner = await db.email_accounts.find_one({"_id": row["email"]})
        if owner and owner["user_id"] != row["user_id"]:
            raise HTTPException(409, "Adresse e-mail indisponible")
        await db.email_accounts.update_one({"_id": row["email"]},
            {"$setOnInsert": {"user_id": row["user_id"]}}, upsert=True)
        user = await db.users.find_one({"id": row["user_id"]})
        if not user or user.get("deleted") or user.get("banned"):
            raise HTTPException(400, "Lien invalide ou expiré")
        old = user.get("email")
        await db.users.update_one({"id": user["id"]},
            {"$set": {"email": row["email"], "email_verified": True}})
        if old and old != row["email"]:
            await db.email_accounts.delete_one({"_id": old, "user_id": user["id"]})
        await emit(db, "welcome", user["id"], {**user, "email": row["email"], "email_verified": True},
                   {"email": row["email"]}, path="/buyer/home")
    await run_transaction(get_db(), operation)
    return {"ok": True}


@router.post("/password/request-reset", status_code=202)
async def request_reset(req: Address, request: Request):
    enabled()
    db = get_db()
    target = address(req.email)
    ip = request.client.host if request.client else "unknown"
    ip_ok = await allow_request(db, "reset-ip", ip, maximum=10)
    email_ok = await allow_request(db, "reset-email", target)
    if ip_ok and email_ok:
        async def operation(bound):
            owner = await bound.email_accounts.find_one({"_id": target})
            user = await bound.users.find_one({"id": owner["user_id"], "email": target,
                "email_verified": True}) if owner else None
            if user and user.get("is_active") is not False and not any(user.get(k) for k in ("banned", "suspended", "deleted", "is_deleted")):
                await send_link(bound, "password_reset", user, target, 30)
        await run_transaction(db, operation)
    return {"ok": True, "message": "Si le compte est éligible, un lien sera envoyé."}


@router.post("/password/reset")
async def reset_password(req: Reset):
    enabled()
    if len(req.password.encode("utf-8")) > 72:
        raise HTTPException(422, "Mot de passe trop long")
    hashed = hash_password(req.password)
    async def operation(db):
        row = await consume(db, req.token, "password_reset")
        user = await db.users.find_one({"id": row["user_id"], "email": row["email"], "email_verified": True})
        if not user or user.get("is_active") is False or any(user.get(k) for k in ("banned", "suspended", "deleted", "is_deleted")):
            raise HTTPException(400, "Lien invalide ou expiré")
        await db.users.update_one({"id": user["id"]},
            {"$set": {"password_hash": hashed}, "$inc": {"auth_version": 1}})
        await db.email_tokens.update_many({"user_id": user["id"], "purpose": "password_reset"}, {"$set": {"used": True}})
        await emit(db, "password_changed", row["_id"], user, path="/auth/login")
    await run_transaction(get_db(), operation)
    return {"ok": True, "message": "Mot de passe modifié. Reconnectez-vous."}


@router.post("/resend/webhook")
async def webhook(request: Request):
    secret = os.getenv("RESEND_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(503, "Webhook non configuré")
    body = bytearray()
    async for part in request.stream():
        body.extend(part)
        if len(body) > 262144:
            raise HTTPException(413, "Requête trop volumineuse")
    try:
        event_id, event = verify(bytes(body), request.headers, secret)
    except ValueError:
        raise HTTPException(400, "Signature invalide")
    result = await handle(get_db(), event_id, event)
    if not result["ok"]:
        raise HTTPException(503, "Événement en attente de rapprochement")
    return result


def preview_context():
    values = {key: "Exemple synthétique" for spec in CATALOG.values() for key in spec["required"]}
    config = configuration()
    if not config["frontend"] or not config["logo"]:
        raise HTTPException(503, "Configurer les URL HTTPS de prévisualisation")
    return {**values, "prenom": "Camille", "email": "delivered@resend.dev",
        "commande": "DEMO-001", "montant": "25 000 FC", "logo_url": config["logo"],
        "lien_action": config["frontend"].rstrip("/") + "/auth/login"}


@router.get("/admin/templates")
async def templates(user=Depends(require_role("admin"))):
    return [{"id": key, "subject": item["subject"]} for key, item in CATALOG.items()]


@router.get("/admin/templates/{name}")
async def preview(name: str, user=Depends(require_role("admin"))):
    if name not in CATALOG:
        raise HTTPException(404, "Modèle introuvable")
    subject, html, text = render(name, preview_context())
    return Response(html, media_type="text/html", headers={"Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; img-src https:; style-src 'unsafe-inline'; sandbox"})
