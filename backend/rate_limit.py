"""
Rate limiting centralisé pour AfriMarket.
Utilise slowapi (wrapper autour de limits) avec Redis ou mémoire locale.

Limites par endpoint (par IP) :
  /auth/send-otp     : 5  req / minute   (coûteux — SMS Africa's Talking)
  /auth/verify-otp   : 10 req / minute   (brute-force OTP)
  /auth/login        : 10 req / minute   (brute-force password)
  /auth/register     : 5  req / minute   (spam inscription)
  /auth/admin/login  : 5  req / minute   (brute-force admin)
  /products (GET)    : 120 req / minute  (lecture normale)
  /orders (POST)     : 20  req / minute  (création commande)
  Global (tout)      : 300 req / minute  par IP
"""
import os
import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request

logger = logging.getLogger(__name__)

# Storage : Redis si disponible, sinon mémoire locale (suffit pour 1 instance)
_storage_uri = os.environ.get("REDIS_URL", "memory://")

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_storage_uri,
    default_limits=["300/minute"],
)

# Handler d'erreur 429
rate_limit_handler = _rate_limit_exceeded_handler

# ── Limites par catégorie ──────────────────────────────────────────────────────

# Endpoints SMS / OTP — les plus sensibles (coût Africa's Talking)
LIMIT_OTP_SEND    = "5/minute"
LIMIT_OTP_VERIFY  = "10/minute"

# Auth
LIMIT_LOGIN       = "10/minute"
LIMIT_REGISTER    = "5/minute"
LIMIT_ADMIN_LOGIN = "5/minute"

# Lecture
LIMIT_PRODUCTS    = "120/minute"

# Écriture
LIMIT_ORDER_POST  = "20/minute"
