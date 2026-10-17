"""Explicit configuration; no shared sender and no implicit live sends."""
import os
import logging
from email.utils import parseaddr
from .render import https_url

logger = logging.getLogger(__name__)


def sending_enabled():
    """Fail closed before business hooks; readiness validation still rejects invalid modes."""
    mode = os.getenv("EMAIL_MODE", "disabled")
    if mode not in ("disabled", "test", "live"):
        logger.warning("Email disabled: invalid EMAIL_MODE syntax")
        return False
    return mode != "disabled"


def mailbox(value):
    if not value or any(c in value for c in "\r\n"):
        raise ValueError("Invalid email address")
    address = parseaddr(value)[1]
    if address.count("@") != 1 or not all(address.split("@")) or " " in address:
        raise ValueError("Invalid email address")
    return address.lower()


def configuration():
    mode = os.getenv("EMAIL_MODE", "disabled")
    if mode not in ("disabled", "test", "live"):
        raise ValueError("Invalid EMAIL_MODE")
    result = {"mode": mode, "key": os.getenv("RESEND_API_KEY", ""),
              "from": os.getenv("EMAIL_FROM", ""), "reply_to": os.getenv("EMAIL_REPLY_TO", ""),
              "frontend": os.getenv("FRONTEND_URL", ""), "logo": os.getenv("EMAIL_LOGO_URL", "")}
    if mode != "disabled":
        if not result["key"]:
            raise ValueError("RESEND_API_KEY is required")
        sender = mailbox(result["from"])
        if sender.rsplit("@", 1)[1] != "afri-market.app":
            raise ValueError("EMAIL_FROM must use the approved afri-market.app domain")
        mailbox(result["reply_to"])
        https_url(result["frontend"])
        https_url(result["logo"])
    return result
