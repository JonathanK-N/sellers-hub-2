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
