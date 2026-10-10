"""Health regression tests: no server startup, database writes or remote calls."""
import asyncio
from unittest.mock import AsyncMock, patch
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
    db.command.side_effect = RuntimeError('database unavailable')
    db.fx_rates.find_one.return_value = None
    with patch.object(server, 'get_db', return_value=db):
        result = asyncio.run(server.health())
    assert result['status'] == 'degraded'
    assert result['checks']['mongodb'].startswith('error:')
