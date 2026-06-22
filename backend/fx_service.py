"""
Taux de change USD → FC via ForexRateAPI.
- get_usd_to_fc()  : retourne le taux depuis le cache MongoDB (collection fx_rates).
- refresh_rate()   : fetch ForexRateAPI et met à jour le cache.
Le scheduler appelle refresh_rate() toutes les 6h.
"""
import os
import logging
import httpx
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

FOREXRATEAPI_KEY = os.getenv("FOREXRATEAPI_KEY", "")
FOREX_URL = "https://api.forexrateapi.com/v1/latest"

# Taux de fallback si l'API est indisponible et le cache vide
FALLBACK_RATE = 2800.0


async def refresh_rate() -> float:
    """Fetch le taux USD/CDF depuis ForexRateAPI et le persiste en base."""
    from db import get_db
    db = get_db()

    if not FOREXRATEAPI_KEY:
        logger.warning("[FX] FOREXRATEAPI_KEY non configuré — taux inchangé")
        return await get_usd_to_fc()

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(FOREX_URL, params={
                "api_key": FOREXRATEAPI_KEY,
                "base": "USD",
                "currencies": "CDF",
            })
            resp.raise_for_status()
            data = resp.json()

        rate = float(data["rates"]["CDF"])
        now = datetime.now(timezone.utc).isoformat()

        await db.fx_rates.update_one(
            {"pair": "USD_CDF"},
            {"$set": {"pair": "USD_CDF", "rate": rate, "updated_at": now}},
            upsert=True,
        )
        logger.info(f"[FX] Taux USD/CDF mis à jour : {rate}")
        return rate

    except Exception as e:
        logger.warning(f"[FX] Échec refresh taux USD/CDF : {e}")
        return await get_usd_to_fc()


async def get_usd_to_fc() -> float:
    """Retourne le taux USD/CDF depuis le cache MongoDB, ou le fallback."""
    from db import get_db
    db = get_db()
    try:
        doc = await db.fx_rates.find_one({"pair": "USD_CDF"}, {"_id": 0})
        if doc and doc.get("rate"):
            return float(doc["rate"])
    except Exception as e:
        logger.warning(f"[FX] Erreur lecture cache taux : {e}")
    return FALLBACK_RATE


async def convert_usd_to_fc(usd_amount: float) -> tuple[float, float]:
    """Retourne (montant_fc, taux_utilisé)."""
    rate = await get_usd_to_fc()
    return round(usd_amount * rate, 0), rate
