"""Central event renderer; callers supply proven business facts and stable identities."""
import logging
from .config import configuration
from .render import render
from .outbox import enqueue

logger = logging.getLogger(__name__)


async def emit(db, event, entity_id, user, context=None, path="/buyer/orders"):
    config = configuration()
    if config["mode"] == "disabled" or not user.get("email_verified") or not user.get("email"):
        return None
    if not path.startswith("/") or path.startswith("//"):
        raise ValueError("Invalid action path")
    values = {"prenom": user.get("name", ""), "logo_url": config["logo"],
              "lien_action": config["frontend"].rstrip("/") + path, **(context or {})}
    subject, html, text = render(event, values)
    return await enqueue(db, event + "/" + str(entity_id), user["email"], subject, html, text)


async def notify_event(db, event, entity_id, user_id, context=None, path="/buyer/orders"):
    """Best effort for non-transactional notifications; no provider network call."""
    try:
        user = await db.users.find_one({"id": user_id}) or {}
        return await emit(db, event, entity_id, user, context, path)
    except Exception:
        logger.warning("Transactional event queue unavailable")
        return None
