"""Resend-only compatibility entry points backed by the persistent outbox."""
import hashlib
import logging
from communications.config import configuration
from communications.outbox import enqueue
from communications.render import render, PlainText
from db import get_db

logger = logging.getLogger(__name__)


def email_configured():
    try:
        return configuration()["mode"] != "disabled"
    except ValueError:
        return False


async def send_email(to, subject, html, event_key=None):
    """Return queue acceptance, never a claim of inbox delivery."""
    if not to or not email_configured():
        return False
    try:
        parser = PlainText()
        parser.feed(html)
        text = "\n".join(parser.parts).strip()
        # Compatibility callers are deterministic for a repeated identical decision.
        identity = event_key or "legacy/" + hashlib.sha256((subject + html).encode()).hexdigest()
        return bool(await enqueue(get_db(), identity, to, subject, html, text))
    except Exception:
        logger.warning("Transactional email queue unavailable")
        return False


def application_email(full_name, message):
    config = configuration()
    subject, html, _ = render("application_approved_or_rejected", {
        "prenom": full_name, "message": message, "logo_url": config["logo"],
        "lien_action": config["frontend"].rstrip("/") + "/livreur/candidature",
    })
    return subject, html


def deliverer_application_approved_email(full_name, dashboard_url=None):
    return application_email(full_name, "Votre candidature a été approuvée. Consultez votre espace livreur.")


def deliverer_application_rejected_email(full_name, reason=""):
    return application_email(full_name, "Votre candidature n’a pas été retenue. " + reason)
