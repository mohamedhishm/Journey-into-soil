"""Unit tests for the SMAP extraction helpers (no network, no granules needed)."""

from __future__ import annotations

import datetime as dt

import numpy as np

from pipelines.smap.process import (
    PIXEL_M,
    EaseGrid,
    SmapObservation,
    daily_values,
    ease_grid_from_row,
    haversine_km,
    parse_quality,
    site_section,
    surface_conditions,
)


def test_quality_bits_follow_the_documented_convention():
    # retrieval_qual_flag: bit0 recommended (0=yes), bit1 attempted (0=yes), bit2 successful (0=yes)
    assert parse_quality(0) == {"recommended": True, "attempted": True, "successful": True}
    assert parse_quality(8)["recommended"] is True  # F/T failure does not invalidate soil moisture
    assert parse_quality(1)["recommended"] is False
    assert parse_quality(5) == {"recommended": False, "attempted": True, "successful": False}
    assert parse_quality(None) == {"recommended": None, "attempted": None, "successful": None}


def test_surface_conditions_are_named_by_bit():
    assert surface_conditions(1) == ["9_km_static_water_body"]
    assert surface_conditions(1 << 7) == ["9_km_radiometer_frozen_ground"]
    assert surface_conditions(1 << 10) == ["9_km_dense_vegetation"]
    assert surface_conditions(0) == []
    assert surface_conditions(65534) == []


def test_ease_grid_row_and_column_from_a_reference_row():
    row_ref = 400
    lats = np.full(20, 31.0)
    # one 9 km column step in longitude at the 30 deg standard parallel of EASE-Grid 2.0
    lon_step = np.degrees(9000.0 / (6378137.0 * np.cos(np.radians(30.0))))
    lons = -20.0 + lon_step * np.arange(20)
    grid = ease_grid_from_row(lats, lons, row_ref)
    assert isinstance(grid, EaseGrid)
    assert grid.row_of(31.0) == row_ref
    assert grid.col_of(lons[3]) == 3
    # one degree of latitude is about 12.4 rows at the 30 deg standard parallel of EASE-Grid 2.0
    rows_per_degree = abs(grid.row_of(30.0) - grid.row_of(31.0))
    assert 11 <= rows_per_degree <= 14
    assert grid.col_of(lons[7]) == 7
    assert PIXEL_M == 9000.0


def test_ease_grid_rejects_an_all_fill_row():
    fill = np.full(10, -9999.0)
    assert ease_grid_from_row(fill, fill, 10) is None


def test_haversine_is_close_to_reality():
    assert 2.0 < haversine_km(31.11, 30.94, 31.0893, 30.9492) < 3.5


def _obs(overpass: str, day: str, value: float, accepted: bool = True) -> dict:
    return {
        "site_id": "demo",
        "overpass": overpass,
        "date": day,
        "time_utc": "",
        "soil_moisture_m3m3": value,
        "uncertainty_m3m3": 0.04,
        "accepted": accepted,
        "reject_reasons": [],
        "quality": {"retrieval_qual_flag": 0, "recommended": True, "attempted": True, "successful": True,
                    "surface_conditions": []},
        "pixel": {"lat": 31.09, "lon": 30.95, "distance_km": 2.0},
        "vegetation_opacity": 0.1,
        "granule": "g",
    }


def test_daily_values_average_overpasses_and_skip_rejected():
    values = daily_values([_obs("AM", "2026-11-01", 0.10), _obs("PM", "2026-11-01", 0.20),
                           _obs("AM", "2026-11-02", 0.30, accepted=False)])
    assert len(values) == 1
    assert values[0]["date"] == "2026-11-01"
    assert values[0]["soil_moisture_m3m3"] == 0.15
    assert values[0]["n_overpasses"] == 2


def test_site_section_is_planned_without_accepted_observations():
    observation = SmapObservation(
        site_id="demo", overpass="AM", date=dt.date(2026, 11, 1), time_utc="",
        soil_moisture=0.02, uncertainty=None, quality_flag=5, accepted=False,
        reject_reasons=["not_recommended_quality"],
    )
    section = site_section("demo", [observation])
    assert section["status"] == "planned"
    assert section["root_zone_available"] is False
    assert section["depth_cm"] == [0, 5]
    assert section["observations"][0]["accepted"] is False
