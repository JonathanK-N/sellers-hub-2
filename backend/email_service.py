"""Email notifications via Resend (https://resend.com).

Uses the REST API directly via httpx rather than the resend SDK, to avoid
an extra dependency since httpx is already a project requirement.

In dev/sandbox (no RESEND_API_KEY or using the shared resend.dev sender),
emails fail silently with a logged warning rather than raising — email is
a nice-to-have notification channel, never something that should block a
user-facing action like submitting an application.
"""
import os
import logging

import httpx

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
# resend.dev is Resend's shared test sender — works without a verified
# custom domain, but Resend restricts delivery to the account owner's own
# verified email address until a real domain is configured.
EMAIL_FROM = os.environ.get("EMAIL_FROM", "AfriMarket <onboarding@resend.dev>")


def email_configured() -> bool:
    return bool(RESEND_API_KEY)


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send a transactional email. Returns True on success, False on any
    failure (never raises) — callers should treat email as best-effort."""
    if not to:
        return False
    if not email_configured():
        logger.warning(f"Email not sent (RESEND_API_KEY not configured): to={to} subject={subject}")
        return False

    payload = {
        "from": EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                RESEND_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code in (200, 201):
            return True
        logger.warning(f"Resend send failed ({resp.status_code}): {resp.text[:300]} to={to}")
        return False
    except Exception as e:
        logger.warning(f"Resend send error: {e} to={to}")
        return False


# ---------- Templates ----------

def _wrap_template(title: str, body_html: str, accent: str = "#1D9E75") -> str:
    """Shared HTML shell matching AfriMarket's brand colors."""
    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#085041;padding:24px 28px;">
          <span style="display:inline-block;width:32px;height:32px;background:{accent};border-radius:8px;color:#fff;font-weight:900;text-align:center;line-height:32px;font-size:16px;">A</span>
          <span style="color:#fff;font-weight:800;font-size:18px;margin-left:10px;vertical-align:middle;">AfriMarket</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px 0;color:#085041;font-size:20px;font-weight:800;">{title}</h1>
          <div style="color:#374151;font-size:14px;line-height:1.6;">{body_html}</div>
        </td></tr>
        <tr><td style="padding:20px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;">AfriMarket — La marketplace francophone made in Kinshasa.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def deliverer_application_approved_email(full_name: str, dashboard_url: str = "https://afrimarket.up.railway.app/livreur") -> tuple[str, str]:
    subject = "Votre candidature livreur AfriMarket a été approuvée 🎉"
    body = f"""
      <p>Bonjour {full_name},</p>
      <p>Excellente nouvelle : votre candidature pour devenir livreur AfriMarket a été <strong style="color:#1D9E75;">approuvée</strong>.</p>
      <p>Vous pouvez dès maintenant vous connecter et commencer à accepter des livraisons depuis votre tableau de bord livreur.</p>
      <p style="margin-top:24px;">
        <a href="{dashboard_url}" style="display:inline-block;background:#1D9E75;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
          Accéder à mon tableau de bord
        </a>
      </p>
      <p style="margin-top:24px;">Bienvenue dans l'équipe AfriMarket !</p>
    """
    return subject, _wrap_template(subject.replace(" 🎉", ""), body)


def deliverer_application_rejected_email(full_name: str, reason: str = "") -> tuple[str, str]:
    subject = "Mise à jour de votre candidature livreur AfriMarket"
    reason_html = f'<p style="margin-top:12px;padding:12px;background:#fef2f2;border-radius:8px;color:#991b1b;font-size:13px;"><strong>Motif :</strong> {reason}</p>' if reason else ""
    body = f"""
      <p>Bonjour {full_name},</p>
      <p>Après examen de votre dossier, nous ne sommes malheureusement pas en mesure de valider votre candidature de livreur pour le moment.</p>
      {reason_html}
      <p style="margin-top:20px;">Vous pouvez soumettre une nouvelle candidature à tout moment depuis votre profil AfriMarket.</p>
    """
    return subject, _wrap_template("Candidature non retenue", body, accent="#E24B4A")
