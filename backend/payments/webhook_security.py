"""Checkout v2 HMAC verification per CinetPay's documented field order."""
import hashlib
import hmac
import os
from fastapi import HTTPException

FIELDS = ("cpm_site_id", "cpm_trans_id", "cpm_trans_date", "cpm_amount", "cpm_currency", "signature", "payment_method", "cel_phone_num", "cpm_phone_prefixe", "cpm_language", "cpm_version", "cpm_payment_config", "cpm_page_action", "cpm_custom", "cpm_designation", "cpm_error_message")


def authenticate(form, token):
    secret = os.environ.get("CINETPAY_SECRET_KEY")
    site = os.environ.get("CINETPAY_SITE_ID")
    if not secret or not site:
        raise HTTPException(503, "Authentification fournisseur non configurée")
    if any(not isinstance(form.get(key), str) for key in FIELDS):
        raise HTTPException(401, "Notification fournisseur invalide")
    if form["cpm_site_id"] != site or not isinstance(token, str) or len(token) != 64:
        raise HTTPException(401, "Notification fournisseur invalide")
    expected = hmac.new(secret.encode(), "".join(form[key] for key in FIELDS).encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, token):
        raise HTTPException(401, "Signature fournisseur invalide")
