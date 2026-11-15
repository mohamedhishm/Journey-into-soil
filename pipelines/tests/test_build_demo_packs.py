import json
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_demo_packs as b

SITE = {"id": "t1", "name_en": "Test", "lat": 30.0, "lon": 31.0}


def make_raw(start=date(2023, 1, 1), days=731, **overrides):
    """A POWER-shaped response: 2023-01-01 .. 2024-12-31 by default (includes the 2024 leap day)."""
    keys = [(start + timedelta(days=i)).strftime("%Y%m%d") for i in range(days)]
    base = {
        "T2M_MAX": 30.0, "T2M_MIN": 18.0, "RH2M": 55.0, "WS2M": 2.5, "ALLSKY_SFC_SW_DWN": 20.0, "PRECTOTCORR": 0.0,
    }
    series = {p: {k: v for k in keys} for p, v in base.items()}
    for param, patch in overrides.items():
        for idx, value in patch.items():
            series[param][keys[idx]] = value
    return {
        "geometry": {"coordinates": [31.0, 30.0, 12.5]},
        "header": {"api": {"version": "v2.10.3"}},
        "properties": {"parameter": series},
    }


def test_maps_parameters_and_dates():
    pack = b.convert_power(make_raw(), SITE)
    d = pack["daily"]
    assert set(d) == {"date", "tmax", "tmin", "rh", "u2", "rs", "rain"}
    assert d["date"][0] == "2023-01-01" and d["date"][-1] == "2024-12-31"
    assert "2024-02-29" in d["date"]
    assert len(d["date"]) == 731 == pack["meta"]["days"]
    assert (d["tmax"][0], d["tmin"][0], d["rh"][0], d["u2"][0], d["rs"][0]) == (30.0, 18.0, 55.0, 2.5, 20.0)
    assert pack["meta"]["period"] == "2023-01-01/2024-12-31"
    assert pack["meta"]["resolution_km"] == 50
    assert pack["meta"]["power_point"]["elevation_m"] == 12.5
    assert "POWER" in pack["meta"]["acknowledgement"]


def test_short_gap_is_interpolated_and_counted():
    raw = make_raw(T2M_MAX={10: 20.0, 11: -999.0, 12: -999.0, 13: 26.0})
    pack = b.convert_power(raw, SITE)
    assert pack["daily"]["tmax"][11:13] == [22.0, 24.0]
    assert pack["meta"]["filled_days"] == 2


def test_rain_gap_becomes_zero_not_interpolated():
    raw = make_raw(PRECTOTCORR={5: 10.0, 6: -999.0, 7: 10.0})
    pack = b.convert_power(raw, SITE)
    assert pack["daily"]["rain"][5:8] == [10.0, 0.0, 10.0]


def test_long_gap_is_rejected():
    raw = make_raw(RH2M={20: -999.0, 21: -999.0, 22: -999.0, 23: -999.0})
    with pytest.raises(b.PackError, match="missing day"):
        b.convert_power(raw, SITE)


def test_gap_at_the_edge_is_rejected():
    with pytest.raises(b.PackError):
        b.convert_power(make_raw(WS2M={0: -999.0}), SITE)


def test_missing_parameter_is_rejected():
    raw = make_raw()
    del raw["properties"]["parameter"]["RH2M"]
    with pytest.raises(b.PackError, match="RH2M"):
        b.convert_power(raw, SITE)


def test_non_contiguous_dates_are_rejected():
    raw = make_raw()
    for series in raw["properties"]["parameter"].values():
        series.pop("20230110")
    with pytest.raises(b.PackError, match="contiguous"):
        b.convert_power(raw, SITE)


def test_tmax_below_tmin_is_rejected():
    with pytest.raises(b.PackError, match="tmax < tmin"):
        b.convert_power(make_raw(T2M_MAX={3: 10.0}), SITE)


def test_implausible_value_is_rejected():
    with pytest.raises(b.PackError, match="rh outside"):
        b.convert_power(make_raw(RH2M={4: 130.0}), SITE)


def test_not_a_power_file_is_rejected():
    with pytest.raises(b.PackError, match="not a POWER"):
        b.convert_power({"hello": 1}, SITE)


def test_close_pairs_detects_competing_sites():
    sites = [
        {"id": "a", "lat": 30.0, "lon": 31.0},
        {"id": "b", "lat": 30.0, "lon": 31.1},
        {"id": "c", "lat": 25.0, "lon": 32.0},
    ]
    assert b.close_pairs(sites) == [("a", "b", 0.1)]


def test_build_writes_skips_and_reports_failures(tmp_path):
    raw_dir, out_dir = tmp_path / "raw", tmp_path / "out"
    raw_dir.mkdir()
    sites = [
        {"id": "ok", "lat": 30.0, "lon": 31.0},
        {"id": "nofile", "lat": 25.0, "lon": 32.0},
        {"id": "bad", "lat": 27.0, "lon": 30.0},
    ]
    (raw_dir / "ok.json").write_text(json.dumps(make_raw()), encoding="utf-8")
    (raw_dir / "bad.json").write_text(json.dumps(make_raw(RH2M={4: 130.0})), encoding="utf-8")
    res = b.build(sites, raw_dir, out_dir)
    assert res["built"] == ["ok"] and res["skipped"] == ["nofile"]
    assert [f[0] for f in res["failed"]] == ["bad"]
    assert not (out_dir / "bad.json").exists()
    pack = json.loads((out_dir / "ok.json").read_text(encoding="utf-8"))
    assert pack["meta"]["id"] == "ok"


def test_build_only_flag_and_unknown_ids(tmp_path):
    raw_dir, out_dir = tmp_path / "raw", tmp_path / "out"
    raw_dir.mkdir()
    (raw_dir / "ok.json").write_text(json.dumps(make_raw()), encoding="utf-8")
    sites = [{"id": "ok", "lat": 30.0, "lon": 31.0}, {"id": "other", "lat": 25.0, "lon": 32.0}]
    res = b.build(sites, raw_dir, out_dir, only={"ok", "typo"})
    assert res["built"] == ["ok"]
    assert res["failed"] == [("typo", "unknown site id")]


def test_build_merges_soilgrids_topsoil_and_omits_on_null(tmp_path):
    raw_power = tmp_path / "raw" / "power"
    raw_soil = tmp_path / "raw" / "soilgrids"
    out_dir = tmp_path / "out"
    raw_power.mkdir(parents=True)
    raw_soil.mkdir(parents=True)
    sites = [
        {"id": "with_soil", "lat": 30.0, "lon": 31.0},
        {"id": "null_soil", "lat": 25.0, "lon": 32.0},
    ]
    (raw_power / "with_soil.json").write_text(json.dumps(make_raw()), encoding="utf-8")
    (raw_power / "null_soil.json").write_text(json.dumps(make_raw()), encoding="utf-8")

    soil_payload_valid = {
        "properties": {
            "layers": [
                {"name": "sand", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 400}}]},
                {"name": "clay", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 300}}]},
                {"name": "soc", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 150}}]},
                {"name": "phh2o", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 78}}]},
            ]
        }
    }
    soil_payload_null = {
        "properties": {
            "layers": [
                {"name": "sand", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": None}}]},
                {"name": "clay", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": None}}]},
            ]
        }
    }
    (raw_soil / "with_soil.json").write_text(json.dumps(soil_payload_valid), encoding="utf-8")
    (raw_soil / "null_soil.json").write_text(json.dumps(soil_payload_null), encoding="utf-8")

    res = b.build(sites, raw_power, out_dir, raw_soil_dir=raw_soil)
    assert res["built"] == ["with_soil", "null_soil"]
    assert any("null_soil: no valid SoilGrids" in w for w in res["warnings"])

    pack_valid = json.loads((out_dir / "with_soil.json").read_text(encoding="utf-8"))
    assert pack_valid["soil"]["sand"] == 40.0
    assert pack_valid["soil"]["clay"] == 30.0
    assert pack_valid["soil"]["om"] == 2.59
    assert pack_valid["soil"]["ph"] == 7.8
    assert pack_valid["soil"]["offset_km"] == 0.0
    assert pack_valid["soil"]["source"] == "soilgrids_250m_model"

    pack_null = json.loads((out_dir / "null_soil.json").read_text(encoding="utf-8"))
    assert pack_null["soil"] is None


def test_neighbour_search_picks_offset_and_records_distance():
    """Fixture with null at origin, data at 0.05 E -> picks that point, records offset_km."""
    from neighbour_search import haversine_km, search_nearby_soil

    origin_lat, origin_lon = 30.0, 31.0
    target_lat, target_lon = 30.0, 31.05  # 0.05 E
    expected_dist = haversine_km(origin_lat, origin_lon, target_lat, target_lon)

    class MockResponse:
        def __init__(self, data):
            self._data = data

        def raise_for_status(self):
            pass

        def json(self):
            return self._data

    class MockClient:
        def get(self, url, params=None):
            pdict = dict(params or [])
            lat, lon = float(pdict.get("lat", 0)), float(pdict.get("lon", 0))
            if abs(lat - target_lat) < 1e-4 and abs(lon - target_lon) < 1e-4:
                return MockResponse(
                    {
                        "properties": {
                            "layers": [
                                {"name": "sand", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 420}}]},
                                {"name": "clay", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 280}}]},
                                {"name": "soc", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 110}}]},
                                {"name": "phh2o", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 76}}]},
                            ]
                        }
                    }
                )
            return MockResponse(
                {
                    "properties": {
                        "layers": [
                            {"name": "sand", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": None}}]},
                            {"name": "clay", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": None}}]},
                        ]
                    }
                }
            )

    mock_client = MockClient()
    payload, sample_lat, sample_lon, offset_km = search_nearby_soil(mock_client, origin_lat, origin_lon)
    assert payload is not None
    assert (sample_lat, sample_lon) == (target_lat, target_lon)
    assert offset_km == expected_dist
    assert offset_km > 0.0
