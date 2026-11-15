from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.meteomatics import (
    _CACHE,
    fetch_telemetry,
    generate_analog_telemetry,
)


@pytest.fixture(autouse=True)
def clear_cache():
    _CACHE.clear()
    yield
    _CACHE.clear()


def test_generate_analog_telemetry():
    telemetry = generate_analog_telemetry(30.79, 31.0)
    assert telemetry["source"] == "meteomatics"
    assert telemetry["status"] == "demo_analog"
    assert telemetry["configured"] is False
    assert telemetry["coordinates"]["lat"] == 30.79
    assert telemetry["coordinates"]["lon"] == 31.0
    params = telemetry["parameters"]
    assert "t_2m_c" in params
    assert "relative_humidity_pct" in params
    assert "evapotranspiration_24h_mm" in params
    assert "soil_moisture_index_5cm" in params
    assert "soil_moisture_index_50cm" in params
    assert "soil_moisture_deficit_mm" in params
    # Physical sanity checks for Egypt
    assert 10.0 <= params["t_2m_c"] <= 48.0
    assert 10.0 <= params["relative_humidity_pct"] <= 100.0
    assert 0.0 <= params["soil_moisture_index_5cm"] <= 1.0


def test_fetch_telemetry_unconfigured_fallback():
    data = asyncio.run(fetch_telemetry(30.79, 31.0))
    assert data["source"] == "meteomatics"
    assert "parameters" in data
    assert data["coordinates"]["lat"] == 30.79


def test_meteomatics_route():
    client = TestClient(app)
    response = client.get("/api/v1/telemetry/meteomatics?lat=30.79&lon=31.0")
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "meteomatics"
    assert "parameters" in body
    assert "t_2m_c" in body["parameters"]
    assert "soil_moisture_index_5cm" in body["parameters"]
