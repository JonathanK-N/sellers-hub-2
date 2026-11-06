"""Consented business contact only. Author: Jonathan Kakesa (JonathanK-N)."""
import re
from fastapi import HTTPException
from auth import normalize_phone


def international_phone(value):
    if not isinstance(value, str):
        raise HTTPException(422, "Numéro international invalide")
    phone = normalize_phone(value)
    if not re.fullmatch(r"\+[1-9][0-9]{8,14}", phone):
        raise HTTPException(422, "Numéro international requis, avec indicatif pays")
    return phone


def public_contact(seller):
    contact = seller.get("whatsapp_contact") or {}
    if not isinstance(contact, dict):
        return None
    if not contact.get("visible") or not contact.get("verified"):
        return None
    try:
        phone = international_phone(contact.get("phone", ""))
    except HTTPException:
        return None
    return {"phone": phone, "verified": True, "visible": True, "link": "https://wa.me/" + phone[1:]}


PRIVATE_SELLER_FIELDS = {
    "_id", "kyc_docs", "whatsapp_contact", "whatsapp_verification", "commission_rate",
    "kyc_reject_reason", "kyc_requested_level", "kyc_submitted_at", "premium_auto_renew",
}
_SCHEME = re.compile(r"^([A-Za-z][A-Za-z0-9+.-]*):")
_IGNORED_BY_BROWSERS = re.compile(r"[\x00-\x20\x7f]")


def safe_link(value):
    """Lien social affichable : http(s) ou sans schéma ; javascript:, data:… sont refusés.
    Les navigateurs ignorent espaces et caractères de contrôle dans le schéma
    ("java\tscript:"), ils sont donc retirés avant la détection."""
    if not isinstance(value, str):
        return None
    if not value.strip():
        return value
    match = _SCHEME.match(_IGNORED_BY_BROWSERS.sub("", value))
    if match and match.group(1).lower() not in {"http", "https"}:
        return None
    return value.strip()


def safe_links(links):
    if not isinstance(links, dict):
        return {}
    return {key: safe_link(value) for key, value in links.items() if isinstance(key, str)}


def public_seller(seller):
    out = {key: value for key, value in seller.items() if key not in PRIVATE_SELLER_FIELDS}
    links = safe_links(seller.get("social_links"))
    links.pop("whatsapp_business", None)
    contact = public_contact(seller)
    if contact:
        links["whatsapp_business"] = contact["link"]
    out["social_links"] = links
    out["whatsapp_contact"] = contact
    return out


def owner_seller(seller):
    if seller is None:
        return None
    return {key: value for key, value in seller.items() if key not in {"_id", "whatsapp_verification"}}
