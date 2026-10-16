"""SMS sending via Africa's Talking.

Environment variables:
  AT_USERNAME   — Africa's Talking username (use 'sandbox' for testing)
  AT_API_KEY    — Africa's Talking API key
  AT_SENDER_ID  — Sender ID / short code (optional, leave empty in sandbox)

If AT_USERNAME or AT_API_KEY are not set, the module falls back to simulation
mode (logs the code instead of sending a real SMS).
"""
import os
import logging

logger = logging.getLogger(__name__)

_at = None


def _get_at():
    global _at
    if _at is not None:
        return _at
    username = os.environ.get("AT_USERNAME", "").strip()
    api_key = os.environ.get("AT_API_KEY", "").strip()
    if not username or not api_key:
        return None
    try:
        import africastalking
        africastalking.initialize(username, api_key)
        _at = africastalking.SMS
        logger.info(f"[SMS] Africa's Talking initialisé (username={username})")
    except Exception as e:
        logger.error(f"[SMS] Erreur d'initialisation Africa's Talking: {e}")
        _at = None
    return _at


def is_sms_configured() -> bool:
    return bool(os.environ.get("AT_USERNAME") and os.environ.get("AT_API_KEY"))


async def send_otp_sms(phone: str, code: str) -> bool:
    """Send an OTP code via SMS. Returns True on success, False on failure.

    In simulation mode (no credentials), logs the code and returns True so the
    rest of the flow continues normally — the otp_dev field in the response will
    expose the code for development/testing.
    """
    message = f"Votre code de vérification AfriMarket est : {code}. Valable 10 minutes. Ne le partagez pas."
    sms = _get_at()

    if sms is None:
        if is_sms_configured():
            logger.error("SMS provider initialization unavailable")
            return False
        logger.warning("SMS sandbox simulation; verification values excluded from logs")
        return True

    sender_id = os.environ.get("AT_SENDER_ID", "").strip() or None
    # NOTE: In production, AT_SENDER_ID must be approved by Africa's Talking.
    # Leave it empty to use the default short code (works immediately).
    try:
        response = sms.send(message, [phone], sender_id=sender_id)
        recipients = response.get("SMSMessageData", {}).get("Recipients", [])
        if recipients:
            status = recipients[0].get("status", "unknown")
            cost = recipients[0].get("cost", "?")
            if status == "Success":
                logger.info("SMS verification accepted by provider")
                return True
            else:
                logger.error("SMS verification rejected by provider")
                return False
        logger.error("Unexpected SMS provider response")
        return False
    except Exception as e:
        logger.error("SMS verification transmission failed")
        return False
