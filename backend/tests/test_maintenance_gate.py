"""Maintenance blocks requests and background writers. Author: Jonathan Kakesa."""
from unittest.mock import patch
import asyncio

import pytest
from fastapi.testclient import TestClient
import server


@pytest.mark.parametrize("mode", [None, "false"])
def test_maintenance_is_opt_in(mode, monkeypatch):
    monkeypatch.delenv("MAINTENANCE_MODE", raising=False)
    if mode is not None:
        monkeypatch.setenv("MAINTENANCE_MODE", mode)
    assert server.maintenance_enabled() is False


@pytest.mark.parametrize("mode", ['"true",', "TRUE", ""])
def test_malformed_mode_refuses_startup(mode, monkeypatch):
    monkeypatch.setenv("MAINTENANCE_MODE", mode)
    with pytest.raises(ValueError):
        asyncio.run(server.on_startup())


def test_maintenance_blocks_business_routes_and_initialization(monkeypatch):
    monkeypatch.setenv("MAINTENANCE_MODE", "true")
    with patch.object(server, "init_db") as database, patch.object(server, "init_storage") as storage, patch("scheduler.start_scheduler") as scheduler:
        with TestClient(server.app) as client:
            for method, path, expected in [("GET", "/api/health", 200), ("GET", "/api/products", 503), ("POST", "/api/orders", 503), ("PATCH", "/api/profile", 503), ("DELETE", "/api/orders/fixture", 503), ("OPTIONS", "/api/orders", 503), ("HEAD", "/api/products", 503)]:
                response = client.request(method, path)
                assert response.status_code == expected
                assert response.headers["Cache-Control"] == "no-store"
                assert response.headers["Retry-After"] == "300"
            assert client.get("/api/health").json()["status"] == "maintenance"
    database.assert_not_called()
    storage.assert_not_called()
    scheduler.assert_not_called()


def test_normal_requests_reach_the_application(monkeypatch):
    monkeypatch.setenv("MAINTENANCE_MODE", "false")
    client = TestClient(server.app, raise_server_exceptions=False)
    try:
        assert client.get("/api/not-a-real-route").status_code == 404
    finally:
        client.close()
