"""Payment boundaries. Author: Jonathan Kakesa (JonathanK-N)."""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from db import get_db
from financial_transactions import run_transaction
from money import minor_units
from auth import require_role
from payments.service import get_provider, cinetpay_configured, CinetPayProvider, is_sandbox
from payments.webhook_security import authenticate

router = APIRouter(prefix="/payments", tags=["payments"])


def _now():
    return datetime.now(timezone.utc).isoformat()


class InitRequest(BaseModel):
    order_group_id: str


@router.post("/init")
async def init_payment(req: InitRequest, user: dict = Depends(require_role("buyer"))):
    db = get_db()
    group = await db.order_groups.find_one({"id": req.order_group_id}, {"_id": 0})
    if not group:
        raise HTTPException(404, "Groupe de commandes introuvable")
    if group["buyer_id"] != user["id"]:
        raise HTTPException(403, "Accès refusé")
    status = group.get("payment_status")
    if status in {"paid", "cash_on_delivery"}:
        return {"simulated": False, "cash": group.get("payment_method") == "cash", "status": status, "order_group_id": req.order_group_id}
    if group.get("payment_method") == "cash":
        async def cash_operation(tx):
            fresh = await tx.order_groups.find_one({"id": req.order_group_id})
            if fresh.get("payment_status") not in {"cash_pending", "cash_on_delivery"}:
                raise HTTPException(409, "Transition de paiement impossible")
            await tx.order_groups.update_one({"id": req.order_group_id}, {"$set": {"payment_status":"cash_on_delivery"}})
            # COD is an arrangement, never proof that money was received.
            await tx.orders.update_many({"order_group_id":req.order_group_id, "escrow_status":"held"}, {"$set":{"cash_on_delivery":True}})
        await run_transaction(db, cash_operation)
        return {"simulated":False,"cash":True,"status":"cash_on_delivery","order_group_id":req.order_group_id}
    if not cinetpay_configured():
        raise HTTPException(503, "Prestataire de paiement non configuré")
    if is_sandbox():
        raise HTTPException(503, "Checkout v2 ne constitue pas une API sandbox certifiée")
    if status in {"pending", "initializing", "reconciliation_required"}:
        if group.get("payment_url"):
            return {"simulated":False, "payment_url":group["payment_url"], "reference":group.get("payment_ref")}
        raise HTTPException(409, "Paiement en attente de réconciliation ; aucune nouvelle émission")
    async def prepare(tx):
        result = await tx.order_groups.update_one({"id":req.order_group_id,"payment_status":"unpaid"}, {"$set":{"payment_status":"initializing", "payment_ref":req.order_group_id}})
        if result.modified_count != 1:
            raise HTTPException(409, "Paiement déjà initialisé")
        await tx.payment_intents.insert_one({"_id":req.order_group_id,"amount_minor":minor_units(group["grand_total"]),"currency":group["currency"],"status":"initializing","created_at":_now()})
    await run_transaction(db, prepare)
    result = await get_provider(group.get("payment_method", "")).collect(phone=user.get("phone", ""), amount=group["grand_total"], currency=group["currency"], external_ref=req.order_group_id, description="AfriMarket")
    async def complete(tx):
        state = "pending" if result.ok else "reconciliation_required"
        await tx.order_groups.update_one({"id":req.order_group_id,"payment_status":"initializing"}, {"$set":{"payment_status":state,"payment_url":result.payment_url}})
        await tx.payment_intents.update_one({"_id":req.order_group_id}, {"$set":{"status":state}})
    await run_transaction(db, complete)
    if not result.ok:
        raise HTTPException(502, "Résultat fournisseur incertain ; réconciliation requise")
    return {"simulated":False,"payment_url":result.payment_url,"reference":result.reference}


async def apply_verified_payment(tx, transaction_id, verified):
    group = await tx.order_groups.find_one({"id":transaction_id})
    if not group:
        raise HTTPException(404, "Référence de paiement inconnue")
    if group.get("payment_method") == "cash":
        raise HTTPException(409, "Commande cash incompatible avec le fournisseur")
    if not verified.ok and verified.status != "FAILED":
        raise HTTPException(503, "Vérification fournisseur indisponible")
    data = verified.raw.get("data", {})
    currency = "CDF" if group["currency"] == "FC" else group["currency"]
    if verified.reference != transaction_id or minor_units(data.get("amount")) != minor_units(group["grand_total"]) or data.get("currency") != currency:
        raise HTTPException(409, "Preuve fournisseur incompatible avec la commande")
    if verified.status == "PENDING":
        return {"ok":True,"status":"pending"}
    status = group.get("payment_status")
    if status == "paid":
        return {"ok":True,"duplicate":True}
    if status not in {"initializing", "pending", "reconciliation_required"}:
        raise HTTPException(409, "Événement désordonné ou transition impossible")
    await tx.payment_events.insert_one({"_id":transaction_id+":"+verified.status,"reference":transaction_id,"status":verified.status,"verified_at":_now()})
    if verified.status == "SUCCESS":
        await tx.order_groups.update_one({"id":transaction_id}, {"$set":{"payment_status":"paid","paid_at":_now()}})
        await tx.orders.update_many({"order_group_id":transaction_id,"escrow_status":"awaiting_payment"}, {"$set":{"escrow_status":"held","payment_confirmed":True}})
        await tx.transactions.update_many({"order_group_id":transaction_id,"payment_status":"pending"}, {"$set":{"payment_status":"captured_in_escrow","confirmed_at":_now()}})
        amount = minor_units(group["grand_total"])
        await tx.financial_ledger.insert_one({"_id":"capture:"+transaction_id,"currency":group["currency"],"lines":[{"account":"provider:cinetpay","minor":-amount},{"account":"escrow:"+transaction_id,"minor":amount}]})
    elif verified.status == "FAILED":
        async for order in tx.orders.find({"order_group_id":transaction_id}):
            if order.get("status") != "confirmed" or order.get("escrow_status") != "awaiting_payment":
                raise HTTPException(409, "Échec fournisseur exige une revue de commande")
            for item in order["items"]:
                await tx.products.update_one({"id":item["product_id"]}, {"$inc":{"stock":item["quantity"]}})
        await tx.order_groups.update_one({"id":transaction_id}, {"$set":{"payment_status":"failed"}})
        await tx.orders.update_many({"order_group_id":transaction_id}, {"$set":{"status":"cancelled","escrow_status":"payment_failed"}})
        await tx.transactions.update_many({"order_group_id":transaction_id}, {"$set":{"payment_status":"failed"}})
    return {"ok":True}


@router.post("/webhook/cinetpay")
async def cinetpay_webhook(request: Request):
    if not cinetpay_configured():
        raise HTTPException(503, "Webhook du prestataire indisponible")
    if is_sandbox():
        raise HTTPException(503, "Webhook Checkout v2 désactivé dans le staging sandbox")
    try:
        form = dict(await request.form())
    except Exception:
        raise HTTPException(400, "Notification invalide")
    authenticate(form, request.headers.get("x-token"))
    transaction_id = form["cpm_trans_id"]
    if transaction_id.startswith("premium_"):
        raise HTTPException(503, "Activation Premium fournisseur suspendue jusqu'à certification")
    verified = await CinetPayProvider().check(transaction_id)
    return await run_transaction(get_db(), lambda tx: apply_verified_payment(tx, transaction_id, verified))


@router.get("/status/{order_group_id}")
async def payment_status(order_group_id: str, user: dict = Depends(require_role("buyer"))):
    group = await get_db().order_groups.find_one({"id":order_group_id}, {"_id":0})
    if not group or group["buyer_id"] != user["id"]:
        raise HTTPException(404, "Introuvable")
    return {"order_group_id":order_group_id,"payment_status":group.get("payment_status","unpaid")}
