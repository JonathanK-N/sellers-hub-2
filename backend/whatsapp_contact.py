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


def public_seller(seller):
    out = {key: value for key, value in seller.items() if key not in {"_id", "kyc_docs", "whatsapp_contact", "whatsapp_verification", "commission_rate"}}
    links = dict(seller.get("social_links") or {})
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
