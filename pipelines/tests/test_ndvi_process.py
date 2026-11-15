"""Unit tests for the NDVI helpers and the bare-field / crop timeline check."""

from __future__ import annotations

import math

import pytest

from pipelines.ndvi.process import (
    R_SPHERE,
    _pixel_latlon,
    decode_qa,
    dedupe_by_composite,
    granule_start,
    is_fill,
    quality_decision,
    scale_ndvi,
    sinusoidal_xy,
)
from pipelines.ndvi.timeline import crop_calendar, timeline_check


def test_scale_and_fill_follow_the_product_metadata():
    assert scale_ndvi(5000) == 0.5
    assert scale_ndvi(-1000) == -0.1
    assert is_fill(-15000) and is_fill(-13000)
    assert not is_fill(5000)


def test_decode_qa_bit_fields():
    # MODLAND_QA bits 0-1 = 0 (good), usefulness bits 2-5 = 0001 => qa = 0b000100 = 4
    decoded = decode_qa(4)
    assert decoded["modland_qa"] == 0
    assert decoded["usefulness"] == 1
    # cloud (mixed clouds bit 10) and snow (bit 14)
    assert decode_qa((1 << 10) | (1 << 14))["mixed_clouds"] == 1
    assert decode_qa((1 << 10) | (1 << 14))["snow_ice"] == 1
    assert decode_qa(65535)["modland_qa"] is None


def test_quality_decision_accepts_only_usable_pixels():
    assert quality_decision(5000, 0, 0)[0] is True
    assert quality_decision(5000, 2, 0)[0] is True
    accepted, reasons = quality_decision(5000, 9, 0)
    assert accepted is False and any("cloud" in r for r in reasons)
    accepted, reasons = quality_decision(-15000, 0, 0)
    assert accepted is False and "no_observation" in reasons
    accepted, _ = quality_decision(20000, 0, 0)
    assert accepted is False


def test_sinusoidal_projection_matches_the_grid_metadata_and_round_trips():
    # GCTP sinusoidal: y = R*lat (radians). The granule's StructMetadata anchors this: tile
    # h20v06 documents a 30 deg north bounding coordinate and UpperLeftPointMtrs y = 3,335,851.
    assert R_SPHERE * math.radians(30.0) == pytest.approx(3335851.559, abs=1.0)
    x, y = sinusoidal_xy(31.11, 30.94)
    assert y == pytest.approx(R_SPHERE * math.radians(31.11), rel=1e-9)
    assert x == pytest.approx(R_SPHERE * math.radians(30.94) * math.cos(math.radians(31.11)), rel=1e-9)
    lat, lon = _pixel_latlon(x, y)
    assert lat == pytest.approx(31.11, abs=1e-6)
    assert lon == pytest.approx(30.94, abs=1e-6)


def test_duplicate_tile_records_collapse_to_one_per_composite():
    def record(granule, ndvi, reliability, distance, start="2026-03-01"):
        return {
            "start": start,
            "end": "2026-03-16",
            "ndvi": ndvi,
            "accepted": reliability <= 2,
            "quality": {"pixel_reliability": reliability},
            "pixel": {"distance_km": distance},
            "granule": granule,
        }

    records = [
        record("A2026060.h20v05", 0.41, 0, 0.22),
        record("A2026060.h20v06", 0.35, 0, 0.31),
        record("A2026061.h20v06", 0.30, 0, 0.25, start="2026-03-09"),  # next composite period
    ]
    kept = dedupe_by_composite(records)
    assert len(kept) == 2
    first = next(item for item in kept if item["start"] == "2026-03-01")
    assert first["granule"] == "A2026060.h20v05"  # closer pixel wins, both are reliable


def test_granule_start_parses_the_date():
    assert granule_start("VNP13A1.A2026265.h20v05.002.2026289164701").isoformat() == "2026-09-22"
    assert granule_start("VNP13A1.A2026001.h20v05.002.2026010123456").isoformat() == "2026-01-01"


def _series(ndvi_values: list[float], midpoints: list[str]) -> list[dict]:
    return [
        {"start": mid, "end": mid, "midpoint": mid, "ndvi": value}
        for value, mid in zip(ndvi_values, midpoints)
    ]


def test_timeline_check_classifies_when_crop_and_fallow_separate():
    periods = [
        {"start": "2026-01-01", "end": "2026-02-28", "crop": "wheat", "season": "winter"},
        {"start": "2026-05-01", "end": "2026-07-31", "crop": "maize", "season": "summer"},
    ]
    series = _series(
        [0.65, 0.70, 0.25, 0.22, 0.60],
        ["2026-01-15", "2026-02-15", "2026-04-01", "2026-04-20", "2026-06-01"],
    )
    check = timeline_check(series, periods)
    assert check["classification_used"] is True
    assert check["threshold_ndvi"] is not None
    assert check["summary"]["n_ok"] == 5
    assert {item["expected"] for item in check["items"]} == {"crop", "fallow"}


def test_timeline_check_stays_uncertain_when_periods_do_not_separate():
    periods = [{"start": "2026-01-01", "end": "2026-02-28", "crop": "wheat", "season": "winter"}]
    series = _series([0.40, 0.42, 0.41], ["2026-01-15", "2026-03-15", "2026-04-15"])
    check = timeline_check(series, periods)
    assert check["classification_used"] is False
    assert all(item["agreement"] == "uncertain" for item in check["items"])
    assert check["limitations"]


def test_crop_calendar_uses_history_and_season_windows():
    crops = {"wheat": {"id": "wheat", "cycle_days": [20, 25, 60, 30]}, "maize": {"id": "maize", "cycle_days": [25, 40, 40, 30]}}
    windows = {"seasons": {
        "winter": {"earliest_sow": "11-01", "latest_sow": "12-15", "latest_harvest": "05-31"},
        "summer": {"earliest_sow": "04-01", "latest_sow": "06-15", "latest_harvest": "10-31"},
    }}
    history = [{"crop": "wheat", "season": "winter"}, {"crop": "maize", "season": "summer"}]
    periods = crop_calendar(history, crops, windows, start=__import__("datetime").date(2025, 11, 1),
                            end=__import__("datetime").date(2026, 11, 1))
    assert {p["crop"] for p in periods} == {"wheat", "maize"}
    assert all(p["start"] <= p["end"] for p in periods)
    wheat = next(p for p in periods if p["crop"] == "wheat")
    assert wheat["start"].startswith("2025-11")
