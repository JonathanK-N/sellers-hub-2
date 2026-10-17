"""Maintenance must never initialize application writers. Author: Jonathan Kakesa."""
import http.client
import threading
from unittest.mock import patch

import pytest
import runtime_entry


@pytest.mark.parametrize("mode", [None, "false"])
def test_normal_start_preserves_uvicorn(mode, monkeypatch):
    monkeypatch.setenv("PORT", "8080")
    monkeypatch.delenv("MAINTENANCE_MODE", raising=False)
    if mode is not None:
        monkeypatch.setenv("MAINTENANCE_MODE", mode)
    with patch.object(runtime_entry.os, "execvp") as execute:
        runtime_entry.main()
    execute.assert_called_once_with("uvicorn", ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"])


def test_maintenance_does_not_launch_business_application(monkeypatch):
    monkeypatch.setenv("PORT", "8080")
    monkeypatch.setenv("MAINTENANCE_MODE", "true")
    with patch.object(runtime_entry, "ThreadingHTTPServer") as server, patch.object(runtime_entry.os, "execvp") as execute:
        runtime_entry.main()
    server.return_value.serve_forever.assert_called_once()
    execute.assert_not_called()


@pytest.mark.parametrize("mode", ['"true",', "TRUE", ""])
def test_malformed_mode_refuses_startup(mode, monkeypatch):
    monkeypatch.setenv("MAINTENANCE_MODE", mode)
    with pytest.raises(ValueError):
        runtime_entry.main()


def test_maintenance_denies_all_business_methods_without_database():
    server = runtime_entry.ThreadingHTTPServer(("127.0.0.1", 0), runtime_entry.Maintenance)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        for method, path, expected in [("GET", "/api/health", 200), ("GET", "/api/products", 503), ("POST", "/api/orders", 503), ("PATCH", "/api/profile", 503), ("DELETE", "/api/orders/fixture", 503), ("OPTIONS", "/api/orders", 503), ("HEAD", "/api/products", 503)]:
            connection = http.client.HTTPConnection("127.0.0.1", server.server_port)
            connection.request(method, path)
            response = connection.getresponse()
            response.read()
            assert response.status == expected
            assert response.getheader("Cache-Control") == "no-store"
            assert response.getheader("Retry-After") == "300"
            connection.close()
    finally:
        server.shutdown()
        server.server_close()
