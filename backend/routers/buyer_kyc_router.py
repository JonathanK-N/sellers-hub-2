from uploads import read_upload
"""Buyer identity verification (KYC) — separate from seller boutique KYC.

Stores documents on the user record directly (no shop entity for buyers).
Validation is manual by an admin, mirroring the seller KYC flow.
"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from db import get_db
from auth import require_role
from s3_service import upload_private

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/buyer/kyc", tags=["buyer-kyc"])
APP_NAME = "afrimarket"


@router.post("/upload")
async def upload_buyer_kyc_doc(
    file: UploadFile = File(...),
    doc_type: str = "id",  # id | selfie
    user: dict = Depends(require_role("buyer")),
):
    """Upload an identity document to private storage."""
    if doc_type not in {"id", "selfie"}:
        raise HTTPException(status_code=400, detail="Type de document invalide")
    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
    path = f"{APP_NAME}/buyer_kyc/{user['id']}/{doc_type}_{uuid.uuid4()}.{ext}"
    data = await read_upload(file, allow_pdf=True)
    try:
        result = upload_private(path, data, file.content_type or "image/jpeg")
    except Exception as e:
        logger.error(f"Buyer KYC upload failed: {e}")
        raise HTTPException(status_code=500, detail="Échec du téléversement")

    db = get_db()
    file_id = str(uuid.uuid4())
    await db.files.insert_one({
        "id": file_id,
        "storage_path": result["path"],
        "owner_id": user["id"],
        "doc_type": doc_type,
        "is_private": True,
        "content_type": file.content_type or f"image/{ext}",
        "size": result.get("size", 0),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    kyc_docs = user.get("buyer_kyc_docs") or {}
    kyc_docs[doc_type] = {"file_id": file_id, "uploaded_at": datetime.now(timezone.utc).isoformat()}
    await db.users.update_one({"id": user["id"]}, {"$set": {"buyer_kyc_docs": kyc_docs}})

    return {"id": file_id, "doc_type": doc_type}


@router.post("/submit")
async def submit_buyer_kyc(user: dict = Depends(require_role("buyer"))):
    """Submit identity documents for admin review. Requires both 'id' and 'selfie'."""
    db = get_db()
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    docs = (fresh or {}).get("buyer_kyc_docs") or {}
    if "id" not in docs:
        raise HTTPException(status_code=400, detail="Pièce d'identité requise")
    if "selfie" not in docs:
        raise HTTPException(status_code=400, detail="Selfie requis")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "buyer_kyc_status": "pending_review",
            "buyer_kyc_submitted_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True, "buyer_kyc_status": "pending_review"}


@router.get("/status")
async def buyer_kyc_status(user: dict = Depends(require_role("buyer"))):
    db = get_db()
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not fresh:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return {
        "buyer_kyc_status": fresh.get("buyer_kyc_status", "none"),
        "buyer_verified": fresh.get("buyer_verified", False),
        "docs": {k: {"uploaded_at": v.get("uploaded_at")} for k, v in (fresh.get("buyer_kyc_docs") or {}).items()},
        "buyer_kyc_reject_reason": fresh.get("buyer_kyc_reject_reason"),
    }
