"""Régressions de l'audit de production : surface exposée et durcissements."""
import importlib

import pytest
from fastapi.testclient import TestClient


def reload_server(monkeypatch, **env):
    for key in ("ENABLE_API_DOCS", "CORS_ORIGINS", "MAINTENANCE_MODE"):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    import server
    return importlib.reload(server)


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_api_docs_are_hidden_by_default(monkeypatch, path):
    server = reload_server(monkeypatch)
    response = TestClient(server.app).get(path)
    assert response.status_code == 404


@pytest.mark.parametrize("path", ["/docs", "/openapi.json"])
def test_api_docs_can_be_enabled_for_development(monkeypatch, path):
    server = reload_server(monkeypatch, ENABLE_API_DOCS="true")
    response = TestClient(server.app).get(path)
    assert response.status_code == 200


def test_wildcard_cors_never_reflects_origin_with_credentials(monkeypatch):
    server = reload_server(monkeypatch, CORS_ORIGINS="*")
    client = TestClient(server.app)
    response = client.get("/api/", headers={"Origin": "https://evil.example", "Cookie": "access_token=x"})
    assert response.headers.get("access-control-allow-origin") == "*"
    assert "access-control-allow-credentials" not in response.headers
    preflight = client.options("/api/orders", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
    assert preflight.status_code == 200
    assert "authorization" in preflight.headers.get("access-control-allow-headers", "").lower()
    assert "access-control-allow-credentials" not in preflight.headers


def test_explicit_cors_origins_keep_credentials_for_listed_origins_only(monkeypatch):
    server = reload_server(monkeypatch, CORS_ORIGINS=" https://app.example ,https://admin.example")
    client = TestClient(server.app)
    allowed = client.get("/api/", headers={"Origin": "https://app.example"})
    assert allowed.headers.get("access-control-allow-origin") == "https://app.example"
    assert allowed.headers.get("access-control-allow-credentials") == "true"
    denied = client.get("/api/", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in denied.headers
