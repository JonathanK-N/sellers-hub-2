"""Health regression tests: no server startup, database writes or remote calls."""
import asyncio
from unittest.mock import AsyncMock, patch
import pytest
import server


def test_health_checks_database_and_fx():
    db = AsyncMock()
    db.fx_rates.find_one.return_value = None
    with patch.object(server, 'get_db', return_value=db):
        result = asyncio.run(server.health())
    assert result['status'] == 'ok'
    assert result['checks']['mongodb'] == 'ok'
    assert result['checks']['fx_rate'] == 'no_data'
    db.command.assert_awaited_once_with('ping')


def test_health_reports_database_failure():
    db = AsyncMock()
    db.command.side_effect = RuntimeError('mongodb://private:credential@example.invalid unavailable')
    db.fx_rates.find_one.return_value = None
    with patch.object(server, 'get_db', return_value=db):
        result = asyncio.run(server.health())
    assert result['status'] == 'degraded'
    assert result['checks']['mongodb'] == 'error: unavailable'


@pytest.mark.parametrize('mode,seed_expected', [(None, False), ('production', False), ('sandbox', True)])
def test_startup_seeds_only_explicit_synthetic_sandbox(monkeypatch, mode, seed_expected):
    if mode is None:
        monkeypatch.delenv('AUTH_MODE', raising=False)
    else:
        monkeypatch.setenv('AUTH_MODE', mode)
    with patch.object(server, 'init_db'), patch.object(server, 'seed_all', new_callable=AsyncMock) as seed, patch.object(server, 'init_storage'), patch('scheduler.start_scheduler'):
        asyncio.run(server.on_startup())
    assert seed.await_count == int(seed_expected)
