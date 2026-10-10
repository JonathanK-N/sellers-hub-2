from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import jwt
import pytest
from fastapi import HTTPException
from auth import decode_token, require_otp_delivery


def test_unconfigured_sms_fails_closed_outside_explicit_sandbox(monkeypatch):
    monkeypatch.delenv("AUTH_MODE",raising=False)
    with patch("sms.is_sms_configured",return_value=False), pytest.raises(HTTPException) as error:
        require_otp_delivery()
    assert error.value.status_code == 503
    monkeypatch.setenv("AUTH_MODE","sandbox")
    with patch("sms.is_sms_configured",return_value=False):
        require_otp_delivery()


@pytest.mark.parametrize("changes", [{"type":"refresh"},{"sub":None},{"exp":0}])
def test_invalid_access_claims_are_rejected(monkeypatch, changes):
    monkeypatch.setenv("JWT_SECRET","synthetic-unit-test-secret-with-sufficient-length")
    payload = {"sub":"test","type":"access","iat":datetime.now(timezone.utc),"exp":datetime.now(timezone.utc)+timedelta(minutes=5), **changes}
    token = jwt.encode(payload,"synthetic-unit-test-secret-with-sufficient-length",algorithm="HS256")
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(token)
