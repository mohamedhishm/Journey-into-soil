"""Tests for live weather telemetry integration in rotation simulation."""

from __future__ import annotations

from app.engine import pipeline
from app.schemas.request import AnalysisRequest


def test_live_weather_simulation_grounding():
    req = AnalysisRequest(lat=30.79, lon=31.0, use_live_weather=True)
    res = pipeline.run(req)

    assert "nasa_evidence" in res
    assert "meteomatics" in res["nasa_evidence"]
    mm = res["nasa_evidence"]["meteomatics"]
    assert mm["status"] in ("live", "demo_analog")
    assert "parameters" in mm

    # Check if high deficit triggers advisory flag
    smd = mm["parameters"].get("soil_moisture_deficit_mm", 0.0)
    flag_keys = [f["key"] for f in res.get("flags", [])]
    if smd > 50.0:
        assert "flag.pre_sowing_deficit" in flag_keys


def test_simulation_without_live_weather_flag():
    req = AnalysisRequest(lat=30.79, lon=31.0, use_live_weather=False)
    res = pipeline.run(req)

    # When disabled, no meteomatics injection into pipeline
    assert "meteomatics" not in res.get("nasa_evidence", {})
    flag_keys = [f["key"] for f in res.get("flags", [])]
    assert "flag.pre_sowing_deficit" not in flag_keys
