"""Tests for the NASA vs Model and NDVI evidence blocks."""

from __future__ import annotations

import json

from app.services import nasa

DATES = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]
LAYERS = [{"wp": 0.10, "fc": 0.30, "top_cm": 0, "bottom_cm": 20}]
STRATEGIES = [
    {"id": "existing", "sim": {"moisture": [[0.5, 0.6, 0.7, 0.8]]}},
    {"id": "primary", "sim": {"moisture": [[0.4, 0.5, 0.6, 0.7]]}},
    {"id": "contrast", "sim": {"moisture": [[0.6, 0.7, 0.8, 0.9]]}},
]


def _pack(tmp_path, observations, ndvi_observations=None):
    pack = {
        "meta": {"id": "demo", "lat": 31.1, "lon": 30.9},
        "daily": {"date": []},
        "nasa": {
            "smap": {
                "status": "pack",
                "product": "SPL3SMP_E",
                "version": "006",
                "depth": "surface, ~top 5 cm",
                "depth_cm": [0, 5],
                "root_zone_available": False,
                "units": "m3/m3",
                "observations": observations,
                "daily": [
                    {"date": o["date"], "soil_moisture_m3m3": o["soil_moisture_m3m3"], "n_overpasses": 1}
                    for o in observations if o.get("accepted")
                ],
                "summary": {"n_observations": len(observations), "n_days_with_data": len(observations)},
            },
            "ndvi": {
                "status": "pack" if ndvi_observations else "planned",
                "product": "VNP13A1",
                "version": "002",
                "observations": ndvi_observations or [],
                "timeline_check": {
                    "classification_used": True, "threshold_ndvi": 0.4,
                    "items": [{"start": "2026-01-01", "end": "2026-01-16", "ndvi": 0.6,
                               "expected": "crop", "agreement": "ok"}],
                    "summary": {"n_ok": 1, "n_check": 0, "n_uncertain": 0},
                },
            },
        },
    }
    path = tmp_path / "demo.json"
    path.write_text(json.dumps(pack), encoding="utf-8")
    return path


def _obs(day, value, accepted=True):
    return {
        "date": day, "overpass": "AM", "time_utc": "2026-11-01T06:00:00Z",
        "soil_moisture_m3m3": value, "uncertainty_m3m3": 0.04, "accepted": accepted,
        "quality": {"retrieval_qual_flag": 0, "recommended": True, "attempted": True,
                    "successful": True, "surface_conditions": []},
        "pixel": {"lat": 31.09, "lon": 30.95, "distance_km": 2.5},
    }


def test_missing_pack_reports_planned_without_crashing():
    evidence = nasa.build(None, STRATEGIES, DATES, LAYERS)
    assert evidence["smap"]["status"] == "planned"
    assert evidence["smap"]["indicative"] is True
    assert evidence["smap"]["limitations"] == ["smap.missing_pack"]
    assert evidence["ndvi"]["status"] == "planned"
    assert evidence["ndvi"]["limitations"] == ["ndvi.missing_pack"]


def test_smap_comparison_is_indicative_and_pairs_only_accepted_observations(tmp_path):
    path = _pack(tmp_path, [_obs("2026-11-01", 0.15), _obs("2026-11-02", 0.22),
                            _obs("2026-11-03", 0.50, accepted=False), _obs("2026-12-01", 0.20)])
    evidence = nasa.build(path, STRATEGIES, DATES, LAYERS)
    smap = evidence["smap"]
    assert smap["status"] == "pack"
    assert smap["indicative"] is True
    assert smap["root_zone_available"] is False
    assert smap["n_accepted"] == 3  # the accepted ones; rejected kept out of the comparison
    comparison = smap["comparison"]["existing"]
    assert comparison["n_pairs"] == 2  # one value per day, and only dates inside the timeline
    # model top layer: wp + f*(fc-wp) => 0.10 + 0.5*0.20 = 0.20 for day 1
    assert comparison["pairs"][0]["modeled_m3m3"] == 0.2
    assert "smap.surface_only" in smap["limitations"]
    assert "smap.depth_mismatch" in smap["limitations"]


def test_ndvi_block_passes_timeline_check_and_labels_limitations(tmp_path):
    path = _pack(tmp_path, [_obs("2026-11-01", 0.15)], ndvi_observations=[
        {"start": "2026-01-01", "end": "2026-01-16", "midpoint": "2026-01-08", "ndvi": 0.6, "accepted": True,
         "quality": {"pixel_reliability": 0}, "pixel": {"distance_km": 0.4}},
    ])
    evidence = nasa.build(path, STRATEGIES, DATES, LAYERS)
    ndvi = evidence["ndvi"]
    assert ndvi["status"] == "pack"
    assert len(ndvi["observations"]) == 1
    assert ndvi["timeline_check"]["classification_used"] is True
    assert ndvi["timeline_check"]["items"][0]["agreement"] == "ok"
    assert "ndvi.greenness_only" in ndvi["limitations"]


def test_zero_pairs_is_reported_not_invented(tmp_path):
    path = _pack(tmp_path, [_obs("2025-01-01", 0.2), _obs("2025-01-02", 0.2), _obs("2025-01-03", 0.2)])
    comparison = nasa.build(path, STRATEGIES, DATES, LAYERS)["smap"]["comparison"]["primary"]
    assert comparison["n_pairs"] == 0
    assert comparison["status"] == "no_overlap"
    assert comparison["bias_m3m3"] is None
