import json
from datetime import date, timedelta

import pytest

from app import knowledge
from app.config import ROOT, get_settings
from app.engine import plan as planner
from app.engine import rotation
from app.engine.pipeline import run
from app.schemas.request import AnalysisRequest, HistoryItem, Priorities, Scenario

REF = date(2026, 11, 1)


def req(**kw):
    return AnalysisRequest(reference_date=REF, **kw)


@pytest.fixture(scope="module")
def base():
    return run(req())


def crops_of(s):
    return [x["crop"] for x in s["seasons"]]


def test_three_distinct_strategies_with_existing_first(base):
    ids = [s["id"] for s in base["strategies"]]
    assert ids == ["existing", "primary", "contrast"]
    keys = {tuple(crops_of(s)) for s in base["strategies"]}
    assert len(keys) == 3


def test_existing_repeats_same_season_history(base):
    assert crops_of(base["strategies"][0]) == ["wheat", "maize", "wheat"]


def test_each_strategy_has_the_challenge_fields(base):
    for s in base["strategies"]:
        for f in ("why", "evidence", "benefits", "gaps", "risks", "confidence"):
            assert s[f] is not None
        assert s["why"] and s["evidence"] and s["gaps"]


def test_first_season_matches_request_and_crops_fit_season(base):
    crops = knowledge.crops()
    for s in base["strategies"]:
        assert s["seasons"][0]["season"] == "winter"
        for x in s["seasons"]:
            if x["crop"]:
                assert x["season"] in crops[x["crop"]]["seasons"]


def test_sim_arrays_align_with_timeline(base):
    n = base["timeline"]["days"]
    for s in base["strategies"]:
        assert all(len(row) == n for row in s["sim"]["moisture"])
        assert len(s["sim"]["root_cm"]) == n == len(base["climate"]["dates"])


def test_deterministic_apart_from_timestamp(base):
    again = run(req())
    a, b = dict(base), dict(again)
    a.pop("generated_at"), b.pop("generated_at")
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def test_synthetic_climate_is_labelled_and_low_confidence(base):
    assert base["climate"]["source"] == "synthetic"
    assert "disclaimer.preview_data" in base["disclaimers"]
    assert all(s["confidence"]["level"] == "low" for s in base["strategies"])
    assert any(g["key"] == "gap.synthetic_climate" for g in base["strategies"][1]["gaps"])


def test_nematodes_exclude_host_families_from_generated_strategies():
    r = run(req(pest="nematodes"))
    crops = knowledge.crops()
    for s in r["strategies"][1:]:
        for c in crops_of(s):
            assert c is None or crops[c]["family"] not in ("solan", "cucur")
    assert any(g["key"] == "gap.pest_diagnosis" for g in r["strategies"][1]["gaps"])


def test_rice_never_recommended_on_sand():
    r = run(req(texture="sand"))
    for s in r["strategies"][1:]:
        assert "rice" not in crops_of(s)


def test_saline_field_avoids_sensitive_crops():
    r = run(req(soil_ec=8.0, water_ec=3.0))
    for s in r["strategies"][1:]:
        for c in crops_of(s):
            assert c not in ("onion", "lentil", "faba", "pepper", "potato", "berseem")


def test_income_priority_makes_income_the_primary_archetype():
    r = run(req(priorities=Priorities(water=0.5, soil_health=0.5, income=5, risk=0.5)))
    assert r["strategies"][1]["archetype"] == "income"


def test_warming_increases_water_use():
    cool = run(req())
    hot = run(req(scenario=Scenario(dT=3.0, dP=-30)))
    assert hot["strategies"][0]["indicators"]["et_mm"] > cool["strategies"][0]["indicators"]["et_mm"]
    assert hot["request_id"] != cool["request_id"]


def test_next_season_summer_respected():
    r = run(req(next_season="summer", history=[HistoryItem(crop="wheat", season="winter")]))
    assert [x["season"] for x in r["strategies"][0]["seasons"]] == ["summer", "winter", "summer"]


def test_unknown_crop_is_flagged_not_fatal():
    r = run(req(history=[HistoryItem(crop="dragonfruit", season="summer")]))
    assert any(f["key"] == "flag.unknown_crop" for f in r["flags"])


def test_rotation_rules_from_the_guide():
    c = knowledge.crops()
    s, notes = rotation.transition([c["wheat"]], c["wheat"])
    assert s < 0 and any(n["rule"] == "same_family_as_previous" for n in notes)
    s2, _ = rotation.transition([c["wheat"]], c["faba"])
    assert s2 > 0
    s3, _ = rotation.transition([c["maize"]], c["maize"])
    assert s3 < s


def test_plan_rejects_berseem_then_cotton_and_accepts_wheat_then_maize():
    c = knowledge.crops()
    assert planner.plan_sequence(["winter", "summer"], [c["berseem"], c["cotton"]], REF) is None
    p = planner.plan_sequence(["winter", "summer"], [c["wheat"], c["maize"]], REF)
    assert p and p[0][0] == date(2026, 11, 1) and p[1][0] > p[0][1]


def test_every_message_key_has_english_and_arabic():
    en = json.loads((ROOT / "contracts/i18n/en.json").read_text(encoding="utf-8"))
    ar = json.loads((ROOT / "contracts/i18n/ar.json").read_text(encoding="utf-8"))
    assert set(en) == set(ar)
    results = [run(req()), run(req(pest="nematodes", texture="sand", soil_ec=6.0)),
               run(req(texture="clay", drainage="poor", effective_depth_cm=60, water_availability="scarce", pest="unknown")),
               run(req(irrigation="none", scenario=Scenario(dT=5, dP=-50)))]
    missing = set()

    def walk(o):
        if isinstance(o, dict):
            if "key" in o and "params" in o:
                if o["key"] not in en:
                    missing.add(o["key"])
                for k, v in o["params"].items():
                    if k in ("crop", "prev") and f"crop.{v}" not in en:
                        missing.add(f"crop.{v}")
                    if k == "family" and f"family.{v}" not in en:
                        missing.add(f"family.{v}")
                    if k == "texture" and f"texture.{v}" not in en:
                        missing.add(f"texture.{v}")
                    if k == "season" and f"season.{v}" not in en:
                        missing.add(f"season.{v}")
                    if k == "priority" and f"priority.{v}" not in en:
                        missing.add(f"priority.{v}")
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    for r in results:
        walk(r["strategies"])
        walk(r["flags"])
        for key in r["needs_local_review"] + r["disclaimers"] + [r["layers"][0]["name_key"]]:
            if key not in en:
                missing.add(key)
        for n in r["nasa_data"]:
            for key in (n["name_key"], n["role_key"]):
                if key not in en:
                    missing.add(key)
        for s in r["strategies"]:
            if s["label_key"] not in en:
                missing.add(s["label_key"])
    assert not missing, sorted(missing)


def test_pack_climate_elevates_confidence_and_removes_synthetic_labels(tmp_path, monkeypatch):
    dates = []
    base_d = date(2024, 1, 1)
    for i in range(366):
        d = base_d + timedelta(days=i)
        dates.append(d.isoformat())
    n = len(dates)
    fixture_pack = {
        "meta": {
            "id": "gharbia",
            "lat": 30.79,
            "lon": 31.0,
            "source": "NASA POWER",
            "resolution_km": 50.0,
            "products": ["power"],
            "period": "2024",
        },
        "daily": {
            "date": dates,
            "tmax": [25.0] * n,
            "tmin": [15.0] * n,
            "rh": [60.0] * n,
            "u2": [2.0] * n,
            "rs": [18.0] * n,
            "rain": [0.0] * n,
        },
    }
    demo_dir = tmp_path / "demo_sites"
    demo_dir.mkdir(parents=True)
    (demo_dir / "gharbia.json").write_text(json.dumps(fixture_pack), encoding="utf-8")

    monkeypatch.setattr(get_settings(), "packs_dir", tmp_path)

    res = run(req(lat=30.79, lon=31.0))

    assert res["climate"]["source"] == "pack"
    assert res["climate"]["pack_id"] == "gharbia"
    assert "disclaimer.preview_data" not in res["disclaimers"]

    nasa_power = next(item for item in res["nasa_data"] if item["id"] == "power")
    assert nasa_power["status"] == "pack"

    for s in res["strategies"]:
        gap_keys = [g["key"] for g in s["gaps"]]
        assert "gap.synthetic_climate" not in gap_keys
        assert "gap.nasa_not_loaded" not in gap_keys

        conf_factor_keys = [f["key"] for f in s["confidence"]["factors"]]
        assert "conf.synthetic_climate" not in conf_factor_keys
        assert s["confidence"]["level"] in ("medium", "high")
        assert s["confidence"]["score"] >= 0.50

