"""Deliverer applications: candidacy workflow before becoming an active
deliverer. Two distinct tracks:

  - "afrimarket" — joins the platform-wide independent deliverer network.
    Reviewed and approved/rejected by an admin.
  - "shop" — affiliated exclusively to one seller's shop. Reviewed and
    approved/rejected by that seller. A shop-affiliated deliverer cannot
    pick up deliveries for any other seller or the AfriMarket network.

Any authenticated user (buyer, seller, or an unaffiliated account) may
submit an application — becoming a deliverer is additive, not exclusive
to a dedicated "deliverer" signup. Approval is what actually activates
delivery capability (creates/updates the `deliverers` profile and grants
the `deliverer` role)."""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from db import get_db
from auth import get_current_user_dep, require_role, generate_otp, OTP_EXPIRY_MINUTES
from models import DelivererApplicationRequest, DelivererApplicationReject
from s3_service import upload_private, generate_presigned_url
from notifications import create_notification
from email_service import deliverer_application_approved_email, deliverer_application_rejected_email, send_email
from sms import send_otp_sms, is_sms_configured
from pydantic import BaseModel
from datetime import timedelta

logger = logging.getLogger(__name__)
router = APIRouter(tags=["deliverer-applications"])
APP_NAME = "afrimarket"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# Phone verification for the application form — works on ANY phone
# number typed in the form (not necessarily the account's own phone),
# unlike /auth/send-otp which requires an existing account with that
# exact number.
# ============================================================

class ApplicationOtpSendRequest(BaseModel):
    phone: str


class ApplicationOtpVerifyRequest(BaseModel):
    phone: str
    code: str


@router.post("/deliverer-applications/send-otp")
async def send_application_otp(req: ApplicationOtpSendRequest, user: dict = Depends(get_current_user_dep)):
    from auth import normalize_phone
    db = get_db()
    phone = normalize_phone(req.phone)
    code = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    await db.application_otp_codes.update_one(
        {"phone": phone, "user_id": user["id"]},
        {"$set": {"phone": phone, "user_id": user["id"], "code": code, "expires_at": expires}},
        upsert=True,
    )
    await send_otp_sms(phone, code)
    resp = {"message": "Code envoyé.", "phone": phone}
    if not is_sms_configured():
        resp["otp_dev"] = code
    return resp


@router.post("/deliverer-applications/verify-otp")
async def verify_application_otp(req: ApplicationOtpVerifyRequest, user: dict = Depends(get_current_user_dep)):
    from auth import normalize_phone
    db = get_db()
    phone = normalize_phone(req.phone)
    otp_doc = await db.application_otp_codes.find_one({"phone": phone, "user_id": user["id"]})
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Aucun code en attente")

    expires = otp_doc.get("expires_at")
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code expiré")
    if otp_doc["code"] != req.code.strip():
        raise HTTPException(status_code=400, detail="Code incorrect")

    await db.application_otp_codes.delete_one({"phone": phone, "user_id": user["id"]})

    # Mark phone as verified on the most recent draft/pending application for this user
    await db.deliverer_applications.update_one(
        {"user_id": user["id"], "status": {"$in": ["draft", "pending"]}},
        {"$set": {"phone_verified": True}},
        sort=[("created_at", -1)],
    )
    return {"ok": True, "phone_verified": True}

# ============================================================
# Candidate: submit application + upload documents
# ============================================================

@router.post("/deliverer-applications", status_code=201)
async def submit_application(req: DelivererApplicationRequest, user: dict = Depends(get_current_user_dep)):
    db = get_db()

    if user["role"] == "seller":
        raise HTTPException(
            status_code=403,
            detail="Les vendeurs ne peuvent pas devenir livreurs. Cette fonctionnalité est réservée aux acheteurs.",
        )
    if user["role"] == "deliverer":
        raise HTTPException(status_code=400, detail="Vous êtes déjà livreur sur AfriMarket")

    if req.application_type not in ("afrimarket", "shop"):
        raise HTTPException(status_code=400, detail="Type de candidature invalide")

    if req.application_type == "shop":
        if not req.seller_id:
            raise HTTPException(status_code=400, detail="seller_id requis pour une candidature boutique")
        seller = await db.sellers.find_one({"id": req.seller_id}, {"_id": 0})
        if not seller:
            raise HTTPException(status_code=404, detail="Boutique introuvable")

    existing = await db.deliverer_applications.find_one(
        {"user_id": user["id"], "status": "pending"}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà une candidature en cours d'examen")

    application = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "application_type": req.application_type,
        "seller_id": req.seller_id if req.application_type == "shop" else None,
        "full_name": req.full_name,
        "date_of_birth": req.date_of_birth,
        "address": req.address,
        "phone": req.phone,
        "phone_verified": False,
        "email": req.email,
        "vehicle": req.vehicle,
        "documents": {},  # filled via /upload
        "contract_accepted": False,
        "contract_accepted_at": None,
        "status": "draft",  # draft -> pending (after submit) -> approved | rejected
        "reviewed_by": None,
        "reviewed_at": None,
        "reject_reason": None,
        "created_at": _now(),
    }
    await db.deliverer_applications.insert_one(application)
    application.pop("_id", None)
    return application


@router.post("/deliverer-applications/{application_id}/upload")
async def upload_document(
    application_id: str,
    doc_type: str,  # "id_document" | "selfie"
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user_dep),
):
    if doc_type not in {"id_document", "selfie"}:
        raise HTTPException(status_code=400, detail="Type de document invalide")

    db = get_db()
    app_doc = await db.deliverer_applications.find_one({"id": application_id, "user_id": user["id"]}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")
    if app_doc["status"] not in ("draft", "rejected"):
        raise HTTPException(status_code=400, detail="Cette candidature ne peut plus être modifiée")

    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
    path = f"{APP_NAME}/deliverer_applications/{application_id}/{doc_type}_{uuid.uuid4()}.{ext}"
    data = await file.read()
    try:
        result = upload_private(path, data, file.content_type or "image/jpeg")
    except Exception as e:
        logger.error(f"Deliverer application document upload failed: {e}")
        raise HTTPException(status_code=500, detail="Échec du téléversement")

    db_file_id = str(uuid.uuid4())
    await db.files.insert_one({
        "id": db_file_id,
        "storage_path": result["path"],
        "owner_id": user["id"],
        "is_private": True,
        "content_type": file.content_type or f"image/{ext}",
        "size": result.get("size", 0),
        "is_deleted": False,
        "created_at": _now(),
    })

    documents = app_doc.get("documents") or {}
    documents[doc_type] = {"file_id": db_file_id, "uploaded_at": _now()}
    await db.deliverer_applications.update_one(
        {"id": application_id}, {"$set": {f"documents.{doc_type}": documents[doc_type]}}
    )
    return {"file_id": db_file_id, "doc_type": doc_type}


@router.post("/deliverer-applications/{application_id}/accept-contract")
async def accept_contract(application_id: str, user: dict = Depends(get_current_user_dep)):
    db = get_db()
    app_doc = await db.deliverer_applications.find_one({"id": application_id, "user_id": user["id"]}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")
    await db.deliverer_applications.update_one(
        {"id": application_id},
        {"$set": {"contract_accepted": True, "contract_accepted_at": _now()}},
    )
    return {"ok": True}


@router.post("/deliverer-applications/{application_id}/submit")
async def finalize_submission(application_id: str, user: dict = Depends(get_current_user_dep)):
    """Move a draft application to 'pending' once all required fields are present."""
    db = get_db()
    app_doc = await db.deliverer_applications.find_one({"id": application_id, "user_id": user["id"]}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")

    docs = app_doc.get("documents") or {}
    missing = []
    if "id_document" not in docs:
        missing.append("pièce d'identité")
    if "selfie" not in docs:
        missing.append("selfie")
    if not app_doc.get("contract_accepted"):
        missing.append("acceptation du contrat")
    if missing:
        raise HTTPException(status_code=400, detail=f"Éléments manquants : {', '.join(missing)}")

    await db.deliverer_applications.update_one(
        {"id": application_id},
        {"$set": {"status": "pending", "submitted_at": _now()}},
    )
    updated = await db.deliverer_applications.find_one({"id": application_id}, {"_id": 0})
    return updated


@router.get("/deliverer-applications/me")
async def my_application(user: dict = Depends(get_current_user_dep)):
    db = get_db()
    app_doc = await db.deliverer_applications.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    return app_doc


# ============================================================
# Admin: review "afrimarket" track applications
# ============================================================

@router.get("/admin/deliverer-applications")
async def admin_list_applications(status: str = "pending", _: dict = Depends(require_role("admin"))):
    db = get_db()
    rows = await db.deliverer_applications.find(
        {"application_type": "afrimarket", "status": status}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return rows


@router.get("/admin/deliverer-applications/{application_id}")
async def admin_get_application(application_id: str, _: dict = Depends(require_role("admin"))):
    db = get_db()
    app_doc = await db.deliverer_applications.find_one(
        {"id": application_id, "application_type": "afrimarket"}, {"_id": 0}
    )
    if not app_doc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")
    docs = app_doc.get("documents") or {}
    urls = {}
    for doc_type, info in docs.items():
        f = await db.files.find_one({"id": info["file_id"]}, {"_id": 0, "storage_path": 1})
        if f:
            try:
                urls[doc_type] = generate_presigned_url(f["storage_path"], expires_in=300)
            except Exception as e:
                logger.warning(f"Presign failed for {doc_type}: {e}")
    app_doc["document_urls"] = urls
    return app_doc


async def _activate_deliverer(db, application: dict, reviewer_id: str):
    user_id = application["user_id"]
    affiliation = "afrimarket" if application["application_type"] == "afrimarket" else "shop"

    applicant_user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
    if applicant_user and applicant_user.get("role") == "seller":
        raise HTTPException(
            status_code=409,
            detail="Ce candidat est désormais vendeur et ne peut pas être activé comme livreur",
        )

    existing = await db.deliverers.find_one({"user_id": user_id}, {"_id": 0})
    profile = {
        "user_id": user_id,
        "vehicle": application.get("vehicle", "moto"),
        "is_active": True,
        "affiliation": affiliation,
        "seller_id": application.get("seller_id"),
        "full_name": application.get("full_name"),
    }
    if existing:
        await db.deliverers.update_one({"user_id": user_id}, {"$set": profile})
    else:
        profile["id"] = str(uuid.uuid4())
        profile["country_code"] = (await db.users.find_one({"id": user_id}, {"_id": 0, "country_code": 1}) or {}).get("country_code", "CD")
        profile["created_at"] = _now()
        await db.deliverers.insert_one(profile)

    await db.users.update_one({"id": user_id}, {"$set": {"role": "deliverer"}})
    await db.deliverer_applications.update_one(
        {"id": application["id"]},
        {"$set": {"status": "approved", "reviewed_by": reviewer_id, "reviewed_at": _now()}},
    )

    try:
        await create_notification(
            user_id, "deliverer_application_approved", "Candidature approuvée 🎉",
            "Votre candidature livreur a été approuvée. Vous pouvez commencer à livrer dès maintenant.",
            {"application_id": application["id"]},
        )
    except Exception:
        pass

    applicant = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1})
    applicant_email = application.get("email") or (applicant or {}).get("email")
    if applicant_email:
        subject, html = deliverer_application_approved_email(application.get("full_name", "Livreur"))
        await send_email(applicant_email, subject, html)


@router.post("/admin/deliverer-applications/{application_id}/approve")
async def admin_approve_application(application_id: str, user: dict = Depends(require_role("admin"))):
    db = get_db()
    app_doc = await db.deliverer_applications.find_one(
        {"id": application_id, "application_type": "afrimarket"}, {"_id": 0}
    )
    if not app_doc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")
    if app_doc["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cette candidature n'est plus en attente")

    await _activate_deliverer(db, app_doc, user["id"])
    return {"ok": True}


@router.post("/admin/deliverer-applications/{application_id}/reject")
async def admin_reject_application(application_id: str, req: DelivererApplicationReject, user: dict = Depends(require_role("admin"))):
    db = get_db()
    app_doc = await db.deliverer_applications.find_one(
        {"id": application_id, "application_type": "afrimarket"}, {"_id": 0}
    )
    if not app_doc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")

    await db.deliverer_applications.update_one(
        {"id": application_id},
        {"$set": {"status": "rejected", "reviewed_by": user["id"], "reviewed_at": _now(), "reject_reason": req.reason}},
    )
    try:
        await create_notification(
            app_doc["user_id"], "deliverer_application_rejected", "Candidature non retenue",
            f"Votre candidature livreur n'a pas été retenue. Motif : {req.reason or 'non précisé'}",
            {"application_id": application_id},
        )
    except Exception:
        pass

    applicant = await db.users.find_one({"id": app_doc["user_id"]}, {"_id": 0, "email": 1})
    applicant_email = app_doc.get("email") or (applicant or {}).get("email")
    if applicant_email:
        subject, html = deliverer_application_rejected_email(app_doc.get("full_name", "Candidat"), req.reason)
        await send_email(applicant_email, subject, html)
    return {"ok": True}


# ============================================================
# Seller: review "shop" track applications for their own shop
# ============================================================

@router.get("/seller/deliverer-applications")
async def seller_list_applications(status: str = "pending", user: dict = Depends(require_role("seller"))):
    db = get_db()
    my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not my_seller:
        return []
    rows = await db.deliverer_applications.find(
        {"application_type": "shop", "seller_id": my_seller["id"], "status": status}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return rows


@router.get("/seller/deliverer-applications/{application_id}")
async def seller_get_application(application_id: str, user: dict = Depends(require_role("seller"))):
    db = get_db()
    my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    app_doc = await db.deliverer_applications.find_one(
        {"id": application_id, "application_type": "shop"}, {"_id": 0}
    )
    if not app_doc or not my_seller or app_doc.get("seller_id") != my_seller["id"]:
        raise HTTPException(status_code=404, detail="Candidature introuvable")

    docs = app_doc.get("documents") or {}
    urls = {}
    for doc_type, info in docs.items():
        f = await db.files.find_one({"id": info["file_id"]}, {"_id": 0, "storage_path": 1})
        if f:
            try:
                urls[doc_type] = generate_presigned_url(f["storage_path"], expires_in=300)
            except Exception as e:
                logger.warning(f"Presign failed for {doc_type}: {e}")
    app_doc["document_urls"] = urls
    return app_doc


@router.post("/seller/deliverer-applications/{application_id}/approve")
async def seller_approve_application(application_id: str, user: dict = Depends(require_role("seller"))):
    db = get_db()
    my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    app_doc = await db.deliverer_applications.find_one(
        {"id": application_id, "application_type": "shop"}, {"_id": 0}
    )
    if not app_doc or not my_seller or app_doc.get("seller_id") != my_seller["id"]:
        raise HTTPException(status_code=404, detail="Candidature introuvable")
    if app_doc["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cette candidature n'est plus en attente")

    await _activate_deliverer(db, app_doc, user["id"])
    return {"ok": True}


@router.post("/seller/deliverer-applications/{application_id}/reject")
async def seller_reject_application(application_id: str, req: DelivererApplicationReject, user: dict = Depends(require_role("seller"))):
    db = get_db()
    my_seller = await db.sellers.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    app_doc = await db.deliverer_applications.find_one(
        {"id": application_id, "application_type": "shop"}, {"_id": 0}
    )
    if not app_doc or not my_seller or app_doc.get("seller_id") != my_seller["id"]:
        raise HTTPException(status_code=404, detail="Candidature introuvable")

    await db.deliverer_applications.update_one(
        {"id": application_id},
        {"$set": {"status": "rejected", "reviewed_by": user["id"], "reviewed_at": _now(), "reject_reason": req.reason}},
    )
    try:
        await create_notification(
            app_doc["user_id"], "deliverer_application_rejected", "Candidature non retenue",
            f"Votre candidature livreur n'a pas été retenue par la boutique. Motif : {req.reason or 'non précisé'}",
            {"application_id": application_id},
        )
    except Exception:
        pass

    applicant = await db.users.find_one({"id": app_doc["user_id"]}, {"_id": 0, "email": 1})
    applicant_email = app_doc.get("email") or (applicant or {}).get("email")
    if applicant_email:
        subject, html = deliverer_application_rejected_email(app_doc.get("full_name", "Candidat"), req.reason)
        await send_email(applicant_email, subject, html)
    return {"ok": True}
