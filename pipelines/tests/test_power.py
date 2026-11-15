"""Tests for NASA POWER data fetcher."""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from pipelines.power.fetch import (
    DEFAULT_PARAMETERS,
    POWER_DAILY_URL,
    fetch_all_sites,
    fetch_site_power,
    load_demo_sites,
)


def _mock_power_payload(start: str = "20240101", end: str = "20240102") -> dict:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [30.94, 31.11, 0.0]},
        "properties": {
            "parameter": {
                param: {start: 20.0, end: 21.0} for param in DEFAULT_PARAMETERS
            }
        },
        "header": {"title": "NASA POWER Agroclimatology"},
        "messages": [],
        "parameters": {p: {} for p in DEFAULT_PARAMETERS},
        "times": {},
    }


def test_load_demo_sites():
    sites = load_demo_sites()
    assert len(sites) >= 5
    ids = [s["id"] for s in sites]
    assert "kafr_el_sheikh" in ids
    assert "gharbia" in ids
    for s in sites:
        assert "lat" in s and "lon" in s
        assert isinstance(s["lat"], (int, float))
        assert isinstance(s["lon"], (int, float))


def test_fetch_site_power_success():
    payload = _mock_power_payload()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = payload

    session = MagicMock()
    session.get.return_value = mock_resp

    result = fetch_site_power(
        lat=31.11,
        lon=30.94,
        start="20240101",
        end="20240102",
        session=session,
    )

    assert result == payload
    session.get.assert_called_once()
    args, kwargs = session.get.call_args
    assert args[0] == POWER_DAILY_URL
    params = kwargs["params"]
    assert params["latitude"] == 31.11
    assert params["longitude"] == 30.94
    assert params["community"] == "AG"
    assert params["start"] == "20240101"
    assert params["end"] == "20240102"


def test_fetch_site_power_retry():
    payload = _mock_power_payload()
    mock_err = MagicMock()
    mock_err.status_code = 503

    mock_ok = MagicMock()
    mock_ok.status_code = 200
    mock_ok.json.return_value = payload

    session = MagicMock()
    session.get.side_effect = [mock_err, mock_ok]

    with patch("time.sleep", return_value=None):
        result = fetch_site_power(
            lat=31.11,
            lon=30.94,
            start="20240101",
            end="20240102",
            session=session,
            max_retries=2,
        )

    assert result == payload
    assert session.get.call_count == 2


def test_fetch_all_sites_cache(tmp_path):
    sites = [
        {"id": "test_site", "lat": 31.0, "lon": 30.0},
    ]
    out_dir = tmp_path / "power"

    # Pre-populate cache
    out_dir.mkdir(parents=True)
    cached_file = out_dir / "test_site.json"
    cached_file.write_text(json.dumps({"cached": True}), encoding="utf-8")

    session = MagicMock()

    # Without force: should skip network fetch
    results = fetch_all_sites(sites=sites, out_dir=out_dir, force=False)
    assert results["test_site"] == cached_file
    session.get.assert_not_called()

    # With force: should fetch
    payload = _mock_power_payload()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = payload

    with patch("pipelines.power.fetch.fetch_site_power", return_value=payload):
        results_forced = fetch_all_sites(sites=sites, out_dir=out_dir, force=True, pause_sec=0)
        assert results_forced["test_site"].exists()
        saved = json.loads(results_forced["test_site"].read_text(encoding="utf-8"))
        assert saved == payload
