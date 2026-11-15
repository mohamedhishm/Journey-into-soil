import json
import sys
from datetime import date, timedelta

import pytest
import yaml

from app import knowledge
from app.config import ROOT, get_settings
from app.engine.pipeline import run
from app.schemas.request import AnalysisRequest
from app.services.climate import get_climate

sys.path.insert(0, str(ROOT / "pipelines"))
import build_demo_packs as builder  # noqa: E402

REF = date(2026, 11, 12)
SITES = yaml.safe_load((ROOT / "knowledge" / "demo_sites.yaml").read_text(encoding="utf-8"))["sites"]


def _request(site, **extra):
    return AnalysisRequest(lat=site["lat"], lon=site["lon"], area_feddan=3, reference_date=REF, **site["preset"], **extra)


@pytest.mark.parametrize("site", SITES, ids=[s["id"] for s in SITES])
def test_every_demo_preset_is_a_valid_request(site):
    """A preset the API rejects would break the demo-site picker (this once happened for 6 of 27 sites)."""
    _request(site)  # schema: texture, irrigation, ... enums
    unknown = [h["crop"] for h in site["preset"].get("history", []) if h["crop"] not in knowledge.crops()]
    assert not unknown, f"{site['id']}: history crops not in knowledge/crops.yaml: {unknown}"


@pytest.mark.parametrize("site_id", ["kafr_el_sheikh", "gharbia", "nubaria", "minya", "fayoum", "matrouh"])
def test_main_demo_sites_produce_three_strategies(site_id):
    site = next(s for s in SITES if s["id"] == site_id)
    result = run(_request(site))
    assert [s["id"] for s in result["strategies"]] == ["existing", "primary", "contrast"]


@pytest.fixture()
def pack_dir(tmp_path, monkeypatch):
    """A real pack built by the real builder from a small POWER-shaped fixture, placed where the engine looks."""
    sys.path.insert(0, str(ROOT / "pipelines" / "tests"))
    from test_build_demo_packs import make_raw  # noqa: E402

    site = {"id": "fixture_site", "name_en": "Fixture", "lat": 30.79, "lon": 31.0}  # the API's default location
    raw_dir, out_dir = tmp_path / "raw", tmp_path / "packs" / "demo_sites"
    raw_dir.mkdir()
    raw = make_raw(PRECTOTCORR={0: 5.0})
    (raw_dir / "fixture_site.json").write_text(json.dumps(raw), encoding="utf-8")
    res = builder.build([site], raw_dir, out_dir)
    assert res["built"] == ["fixture_site"]
    monkeypatch.setattr(get_settings(), "packs_dir", tmp_path / "packs")
    return out_dir


def test_pack_replaces_synthetic_climate(pack_dir):
    days = [REF + timedelta(days=i) for i in range(30)]
    climate = get_climate(30.79, 31.0, days)
    assert climate.source == "pack"
    assert climate.pack_id == "fixture_site"
    assert climate.resolution_km == 50
    assert all(t == 30.0 for t in climate.tmax)  # the fixture's constant tmax came through


def test_pack_changes_what_the_result_says_about_its_data(pack_dir):
    result = run(AnalysisRequest(reference_date=REF))
    assert result["climate"]["source"] == "pack"
    assert next(n for n in result["nasa_data"] if n["id"] == "power")["status"] == "pack"
    assert "disclaimer.preview_data" not in result["disclaimers"]
    for s in result["strategies"]:
        factors = [f["key"] for f in s["confidence"]["factors"]]
        assert "conf.synthetic_climate" not in factors
        assert all(g["key"] != "gap.synthetic_climate" for g in s["gaps"])
        assert any(e["source"] == "power" for e in s["evidence"])


def test_without_a_pack_the_result_is_labelled_synthetic():
    result = run(AnalysisRequest(reference_date=REF))  # conftest points PACKS_DIR at an empty folder
    assert result["climate"]["source"] == "synthetic"
    assert "disclaimer.preview_data" in result["disclaimers"]


def test_soilgrids_pack_honesty_measured_vs_estimated(tmp_path, monkeypatch):
    """With pack soil and no user-entered om/ph, input_status is 'estimated'; with user-entered values it is 'measured'."""
    sys.path.insert(0, str(ROOT / "pipelines" / "tests"))
    from test_build_demo_packs import make_raw  # noqa: E402

    site = {"id": "soil_site", "name_en": "Soil Site", "lat": 30.79, "lon": 31.0}
    raw_dir = tmp_path / "raw" / "power"
    raw_soil = tmp_path / "raw" / "soilgrids"
    out_dir = tmp_path / "packs" / "demo_sites"
    raw_dir.mkdir(parents=True)
    raw_soil.mkdir(parents=True)

    raw_power = make_raw(PRECTOTCORR={0: 5.0})
    (raw_dir / "soil_site.json").write_text(json.dumps(raw_power), encoding="utf-8")

    raw_soil_data = {
        "properties": {
            "layers": [
                {"name": "sand", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 450}}]},
                {"name": "clay", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 250}}]},
                {"name": "soc", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 120}}]},
                {"name": "phh2o", "unit_measure": {"d_factor": 10}, "depths": [{"values": {"mean": 75}}]},
            ]
        }
    }
    (raw_soil / "soil_site.json").write_text(json.dumps(raw_soil_data), encoding="utf-8")

    res = builder.build([site], raw_dir, out_dir, raw_soil_dir=raw_soil)
    assert res["built"] == ["soil_site"]
    monkeypatch.setattr(get_settings(), "packs_dir", tmp_path / "packs")

    # Case 1: no user-entered om/ph -> pack provides numeric defaults, but input_status remains 'estimated'
    r1 = run(AnalysisRequest(lat=30.79, lon=31.0, reference_date=REF))
    assert next(n for n in r1["nasa_data"] if n["id"] == "soilgrids")["status"] == "pack"
    assert r1["input_status"]["organic_matter"] == "estimated"
    assert r1["input_status"]["ph"] == "estimated"
    assert r1["layers"][0]["source"]["om"] == "estimated"
    assert r1["layers"][0]["source"]["ph"] == "estimated"
    assert r1["layers"][0]["ph"] == 7.5
    strat1 = next(s for s in r1["strategies"] if s["id"] == "primary")
    assert "conf.soil_estimated" in [f["key"] for f in strat1["confidence"]["factors"]]

    # Case 2: user enters measured om and ph -> input_status is 'measured'
    r2 = run(AnalysisRequest(lat=30.79, lon=31.0, reference_date=REF, organic_matter=2.5, ph=7.2))
    assert r2["input_status"]["organic_matter"] == "measured"
    assert r2["input_status"]["ph"] == "measured"
    assert r2["layers"][0]["source"]["om"] == "measured"
    assert r2["layers"][0]["source"]["ph"] == "measured"
    assert r2["layers"][0]["ph"] == 7.2
    assert r2["layers"][0]["om"] == 2.5


def test_real_demo_sites_soilgrids_honesty(monkeypatch):
    monkeypatch.setattr(get_settings(), "packs_dir", ROOT / "data" / "packs")
    # new_valley has real soil in pack -> "pack"
    nv_site = next(s for s in SITES if s["id"] == "new_valley")
    nv_res = run(_request(nv_site))
    assert next(n for n in nv_res["nasa_data"] if n["id"] == "soilgrids")["status"] == "pack"
    # Preset defines ph=8.2 (measured), but organic_matter is omitted (estimated)
    assert nv_res["input_status"]["ph"] == "measured"
    assert nv_res["input_status"]["organic_matter"] == "estimated"
    nv_primary = next(s for s in nv_res["strategies"] if s["id"] == "primary")
    assert "conf.soil_estimated" in [f["key"] for f in nv_primary["confidence"]["factors"]]

    # kafr_el_sheikh has no soil in pack (raw data nulls) -> "planned"
    kes_site = next(s for s in SITES if s["id"] == "kafr_el_sheikh")
    kes_res = run(_request(kes_site))
    assert next(n for n in kes_res["nasa_data"] if n["id"] == "soilgrids")["status"] == "planned"
    assert kes_res["input_status"]["ph"] == "measured"
    assert kes_res["input_status"]["organic_matter"] == "estimated"
    kes_primary = next(s for s in kes_res["strategies"] if s["id"] == "primary")
    assert "conf.soil_estimated" in [f["key"] for f in kes_primary["confidence"]["factors"]]


def test_surface_om_capping_pack_vs_user():
    """Pack OM (e.g. 7.2) is capped at 3.5; user-entered OM (e.g. 5.0) stays 5.0 uncapped."""
    from app.engine import profile

    # Case 1: pack OM is high (7.21) and user entered nothing -> layer om is capped at 3.5
    req_pack = AnalysisRequest(reference_date=REF)
    layers_pack = profile.build_layers(req_pack, soil={"om": 7.21, "ph": 7.7})
    assert layers_pack[0].om == 3.5

    # Case 2: user explicitly enters high OM (5.0) -> stays 5.0 uncapped
    req_user = AnalysisRequest(reference_date=REF, organic_matter=5.0)
    layers_user = profile.build_layers(req_user, soil={"om": 7.21, "ph": 7.7})
    assert layers_user[0].om == 5.0
