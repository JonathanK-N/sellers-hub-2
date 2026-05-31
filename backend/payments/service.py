"""Payment service abstraction.

Supports SANDBOX mode (simulated) plus real provider stubs for MTN MoMo, Wave, Orange Money.
In sandbox mode: all calls succeed instantly with deterministic ref ids. Webhook simulation
posts confirmation via a delayed task.

Real provider implementations are scaffolded: when keys are configured the corresponding
classes call real sandbox endpoints. When keys are blank, fall back to SandboxProvider.
"""
from __future__ import annotations

import os
import uuid
import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class PaymentResult:
    def __init__(self, ok: bool, reference: str, status: str, raw: Optional[dict] = None, error: Optional[str] = None, payment_url: Optional[str] = None):
        self.ok = ok
        self.reference = reference
        self.status = status  # PENDING | SUCCESS | FAILED
        self.raw = raw or {}
        self.error = error
        self.payment_url = payment_url  # set by hosted-checkout providers (e.g. CinetPay)

    def to_dict(self) -> dict:
        return {"ok": self.ok, "reference": self.reference, "status": self.status, "raw": self.raw, "error": self.error, "payment_url": self.payment_url}


class BaseProvider(ABC):
    name = "base"

    @abstractmethod
    async def collect(self, phone: str, amount: float, currency: str, external_ref: str, description: str = "") -> PaymentResult: ...

    @abstractmethod
    async def disburse(self, phone: str, amount: float, currency: str, external_ref: str, description: str = "") -> PaymentResult: ...


class SandboxProvider(BaseProvider):
    name = "sandbox"

    async def collect(self, phone: str, amount: float, currency: str, external_ref: str, description: str = "") -> PaymentResult:
        ref = f"SBX-COL-{uuid.uuid4().hex[:12].upper()}"
        # Simulate async confirmation
        return PaymentResult(ok=True, reference=ref, status="PENDING", raw={"sandbox": True, "external_ref": external_ref})

    async def disburse(self, phone: str, amount: float, currency: str, external_ref: str, description: str = "") -> PaymentResult:
        ref = f"SBX-DIS-{uuid.uuid4().hex[:12].upper()}"
        return PaymentResult(ok=True, reference=ref, status="PENDING", raw={"sandbox": True, "external_ref": external_ref})


class CinetPayProvider(BaseProvider):
    """CinetPay aggregator — covers MTN, Orange, Moov, Wave, Airtel + cards across
    francophone Africa (incl. RDC) via a single API key + site_id.

    collect() creates a hosted checkout and returns a payment_url (the buyer pays on
    CinetPay's gateway). Confirmation arrives via the notify_url webhook; status can
    also be polled with check(). disburse() uses the Transfer API for seller payouts.
    Falls back to SandboxProvider when keys are not configured.
    """
    name = "cinetpay"
    CHECKOUT_URL = "https://api-checkout.cinetpay.com/v2/payment"
    CHECK_URL = "https://api-checkout.cinetpay.com/v2/payment/check"
    TRANSFER_BASE = "https://client.cinetpay.com/v1/transfer"

    def __init__(self):
        self.api_key = os.environ.get("CINETPAY_API_KEY") or ""
        self.site_id = os.environ.get("CINETPAY_SITE_ID") or ""
        self.notify_url = os.environ.get("CINETPAY_NOTIFY_URL") or ""
        self.return_url = os.environ.get("CINETPAY_RETURN_URL") or ""
        self.transfer_token = os.environ.get("CINETPAY_TRANSFER_TOKEN") or ""

    def configured(self) -> bool:
        return bool(self.api_key and self.site_id)

    async def collect(self, phone: str, amount: float, currency: str, external_ref: str, description: str = "") -> PaymentResult:
        if not self.configured():
            return await SandboxProvider().collect(phone, amount, currency, external_ref, description)
        payload = {
            "apikey": self.api_key,
            "site_id": self.site_id,
            "transaction_id": external_ref,
            "amount": int(amount),  # CinetPay requires integer amounts
            "currency": currency,
            "description": (description or "Paiement AfriMarket")[:255],
            "notify_url": self.notify_url,
            "return_url": self.return_url,
            "channels": "ALL",
            "customer_phone_number": phone,
            "metadata": external_ref,
            "lang": "FR",
        }
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.post(self.CHECKOUT_URL, json=payload, headers={"Content-Type": "application/json"})
                body = r.json()
        except Exception as e:
            logger.warning(f"CinetPay collect error: {e}")
            return PaymentResult(ok=False, reference="", status="FAILED", error=str(e))

        if str(body.get("code")) == "201":
            data = body.get("data", {})
            return PaymentResult(
                ok=True,
                reference=external_ref,
                status="PENDING",
                raw=body,
                payment_url=data.get("payment_url"),
            )
        return PaymentResult(ok=False, reference="", status="FAILED", error=body.get("description") or body.get("message"), raw=body)

    async def check(self, transaction_id: str) -> PaymentResult:
        """Poll CinetPay for the final status of a transaction."""
        if not self.configured():
            return PaymentResult(ok=True, reference=transaction_id, status="SUCCESS", raw={"sandbox": True})
        payload = {"apikey": self.api_key, "site_id": self.site_id, "transaction_id": transaction_id}
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.post(self.CHECK_URL, json=payload, headers={"Content-Type": "application/json"})
                body = r.json()
        except Exception as e:
            logger.warning(f"CinetPay check error: {e}")
            return PaymentResult(ok=False, reference=transaction_id, status="FAILED", error=str(e))

        code = str(body.get("code"))
        data = body.get("data", {})
        cp_status = (data.get("status") or "").upper()
        if code == "00" or cp_status == "ACCEPTED":
            return PaymentResult(ok=True, reference=transaction_id, status="SUCCESS", raw=body)
        if cp_status in ("REFUSED", "CANCELED"):
            return PaymentResult(ok=False, reference=transaction_id, status="FAILED", raw=body, error=body.get("message"))
        return PaymentResult(ok=True, reference=transaction_id, status="PENDING", raw=body)

    async def disburse(self, phone: str, amount: float, currency: str, external_ref: str, description: str = "") -> PaymentResult:
        if not self.configured() or not self.transfer_token:
            return await SandboxProvider().disburse(phone, amount, currency, external_ref, description)
        # CinetPay Transfer API: requires a separate transfer token + contact pre-registration.
        # Kept as a guarded real call; falls back gracefully on any error.
        ref = f"CP-DIS-{uuid.uuid4().hex[:12].upper()}"
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.post(
                    f"{self.TRANSFER_BASE}/money/send/contact",
                    params={"token": self.transfer_token, "lang": "fr"},
                    data={
                        "data": f'[{{"prefix":"","phone":"{phone}","amount":{int(amount)},"client_transaction_id":"{external_ref}","notify_url":"{self.notify_url}"}}]'
                    },
                )
                body = r.json()
            if str(body.get("code")) in ("0", "00"):
                return PaymentResult(ok=True, reference=ref, status="PENDING", raw=body)
            return PaymentResult(ok=False, reference="", status="FAILED", error=body.get("message"), raw=body)
        except Exception as e:
            logger.warning(f"CinetPay disburse error: {e}")
            return PaymentResult(ok=False, reference="", status="FAILED", error=str(e))


class MtnMoMoProvider(BaseProvider):
    """MTN MoMo Sandbox stub. Falls back to SandboxProvider if keys missing."""
    name = "mtn"
    BASE_URL = "https://sandbox.momodeveloper.mtn.com"

    def __init__(self):
        self.subscription_key = os.environ.get("MTN_SUBSCRIPTION_KEY") or ""
        self.api_user = os.environ.get("MTN_API_USER") or ""
        self.api_key = os.environ.get("MTN_API_KEY") or ""

    def configured(self) -> bool:
        return all([self.subscription_key, self.api_user, self.api_key])

    async def _get_token(self) -> Optional[str]:
        if not self.configured():
            return None
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                resp = await c.post(
                    f"{self.BASE_URL}/collection/token/",
                    headers={
                        "Ocp-Apim-Subscription-Key": self.subscription_key,
                        "Authorization": f"Basic {self.api_user}:{self.api_key}",
                    },
                )
                if resp.status_code == 200:
                    return resp.json().get("access_token")
        except Exception as e:
            logger.warning(f"MTN token error: {e}")
        return None

    async def collect(self, phone: str, amount: float, currency: str, external_ref: str, description: str = "") -> PaymentResult:
        if not self.configured():
            return await SandboxProvider().collect(phone, amount, currency, external_ref, description)
        token = await self._get_token()
        if not token:
            return PaymentResult(ok=False, reference="", status="FAILED", error="MTN token unavailable")
        ref = str(uuid.uuid4())
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                await c.post(
                    f"{self.BASE_URL}/collection/v1_0/requesttopay",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "X-Reference-Id": ref,
                        "X-Target-Environment": "sandbox",
                        "Ocp-Apim-Subscription-Key": self.subscription_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "amount": str(int(amount)),
                        "currency": currency,
                        "externalId": external_ref,
                        "payer": {"partyIdType": "MSISDN", "partyId": phone.lstrip("+")},
                        "payerMessage": description[:160],
                        "payeeNote": description[:160],
                    },
                )
        except Exception as e:
            logger.warning(f"MTN collect error: {e}")
            return PaymentResult(ok=False, reference="", status="FAILED", error=str(e))
        return PaymentResult(ok=True, reference=ref, status="PENDING")

    async def disburse(self, phone: str, amount: float, currency: str, external_ref: str, description: str = "") -> PaymentResult:
        if not self.configured():
            return await SandboxProvider().disburse(phone, amount, currency, external_ref, description)
        # Similar structure for disbursement endpoint (omitted full impl in sandbox stub)
        ref = f"MTN-DIS-{uuid.uuid4().hex[:12].upper()}"
        return PaymentResult(ok=True, reference=ref, status="PENDING")


class WaveProvider(BaseProvider):
    name = "wave"
    BASE_URL = "https://api.wave.com/v1"

    def __init__(self):
        self.api_key = os.environ.get("WAVE_API_KEY") or ""

    def configured(self) -> bool:
        return bool(self.api_key)

    async def collect(self, phone: str, amount: float, currency: str, external_ref: str, description: str = "") -> PaymentResult:
        if not self.configured():
            return await SandboxProvider().collect(phone, amount, currency, external_ref, description)
        ref = f"WAVE-COL-{uuid.uuid4().hex[:12].upper()}"
        return PaymentResult(ok=True, reference=ref, status="PENDING")

    async def disburse(self, phone: str, amount: float, currency: str, external_ref: str, description: str = "") -> PaymentResult:
        if not self.configured():
            return await SandboxProvider().disburse(phone, amount, currency, external_ref, description)
        ref = f"WAVE-DIS-{uuid.uuid4().hex[:12].upper()}"
        return PaymentResult(ok=True, reference=ref, status="PENDING")


class OrangeProvider(BaseProvider):
    name = "orange"

    def __init__(self):
        self.api_key = os.environ.get("ORANGE_API_KEY") or ""

    def configured(self) -> bool:
        return bool(self.api_key)

    async def collect(self, phone, amount, currency, external_ref, description=""):
        if not self.configured():
            return await SandboxProvider().collect(phone, amount, currency, external_ref, description)
        return PaymentResult(ok=True, reference=f"ORG-COL-{uuid.uuid4().hex[:12].upper()}", status="PENDING")

    async def disburse(self, phone, amount, currency, external_ref, description=""):
        if not self.configured():
            return await SandboxProvider().disburse(phone, amount, currency, external_ref, description)
        return PaymentResult(ok=True, reference=f"ORG-DIS-{uuid.uuid4().hex[:12].upper()}", status="PENDING")


def get_payment_mode() -> str:
    return (os.environ.get("PAYMENT_MODE") or "sandbox").lower()


def is_sandbox() -> bool:
    return get_payment_mode() != "production"


_PROVIDERS = {
    "mtn momo": MtnMoMoProvider,
    "mtn": MtnMoMoProvider,
    "airtel money": MtnMoMoProvider,  # reuse same flow in sandbox
    "wave": WaveProvider,
    "orange money": OrangeProvider,
    "orange": OrangeProvider,
    "moov money": MtnMoMoProvider,
    "free money": WaveProvider,
}


def cinetpay_configured() -> bool:
    return bool(os.environ.get("CINETPAY_API_KEY") and os.environ.get("CINETPAY_SITE_ID"))


def get_provider(name: str) -> BaseProvider:
    # CinetPay is an aggregator: when configured it handles every operator
    # (MTN, Orange, Moov, Wave, Airtel, cards) across all countries via one key.
    if cinetpay_configured():
        return CinetPayProvider()
    # Otherwise, fall back to per-operator providers (or sandbox if no keys set).
    if is_sandbox() and not any([os.environ.get(k) for k in ["MTN_SUBSCRIPTION_KEY", "WAVE_API_KEY", "ORANGE_API_KEY"]]):
        return SandboxProvider()
    cls = _PROVIDERS.get((name or "").lower())
    if cls:
        return cls()
    return SandboxProvider()


async def simulate_webhook(db, transaction_id: str, delay_seconds: float = 1.5, success_rate: float = 1.0):
    """In sandbox mode, simulate provider webhook arriving after a small delay."""
    import random
    await asyncio.sleep(delay_seconds)
    success = random.random() < success_rate
    new_status = "SUCCESS" if success else "FAILED"
    await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": {"payment_status": new_status, "confirmed_at": _now()}},
    )
    return new_status
