"""NASA evidence for a result: SMAP surface soil moisture vs the simulated model, and NDVI.

Everything here is derived from the demo pack written by pipelines/packs/build_demo_packs.py.
No observation is ever synthesised: when a product is missing the block reports
status "planned" plus an explicit reason, and the rest of the result is unaffected.

The SMAP comparison is deliberately conservative:
  * SMAP measures the top ~5 cm; the model's top layer is thicker, so the comparison is
    *indicative* and always labelled as such.
  * Only accepted retrievals (recommended quality, land, documented valid range) are compared.
  * A 9 km satellite cell is an area average; the model is one field. Both facts are reported.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any


def load_pack(pack_path: str | Path | None) -> dict[str, Any]:
    """Read a demo pack; an unreadable or missing pack yields an empty dict (never an error)."""
    if not pack_path:
        return {}
    try:
        return json.loads(Path(pack_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def earliest_observation_date(pack_path: str | Path | None) -> Any:
    """First date with an accepted SMAP retrieval in the pack (None when unavailable)."""
    pack = load_pack(pack_path)
    smap = (pack.get("nasa") or {}).get("smap") or {}
    if smap.get("status") != "pack":
        return None
    dates = [o["date"] for o in smap.get("observations", []) if o.get("accepted") and o.get("date")]
    if not dates:
        return None
    from datetime import date as _date

    return _date.fromisoformat(min(dates))


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx <= 0 or syy <= 0:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return round(sxy / math.sqrt(sxx * syy), 3)


def compare(model_by_date: dict[str, float], observations: list[dict]) -> dict[str, Any]:
    """Pair observed and modelled volumetric values on matching dates."""
    pairs = []
    for obs in observations:
        value = obs.get("soil_moisture_m3m3")
        modelled = model_by_date.get(obs.get("date"))
        if value is None or modelled is None:
            continue
        pairs.append((obs["date"], float(value), float(modelled)))
    if not pairs:
        return {"n_pairs": 0, "status": "no_overlap", "bias_m3m3": None, "rmse_m3m3": None,
                "mae_m3m3": None, "pearson_r": None}
    obs_vals = [p[1] for p in pairs]
    mod_vals = [p[2] for p in pairs]
    diffs = [m - o for o, m in zip(obs_vals, mod_vals)]
    return {
        "n_pairs": len(pairs),
        "status": "ok" if len(pairs) >= 3 else "few_pairs",
        "bias_m3m3": round(sum(diffs) / len(diffs), 4),
        "rmse_m3m3": round(math.sqrt(sum(d * d for d in diffs) / len(diffs)), 4),
        "mae_m3m3": round(sum(abs(d) for d in diffs) / len(diffs), 4),
        "pearson_r": _pearson(obs_vals, mod_vals),
        "pairs": [{"date": d, "observed_m3m3": round(o, 4), "modeled_m3m3": round(m, 4)} for d, o, m in pairs],
    }


def _model_series(strategy: dict, dates: list[str], layers: list[dict]) -> dict[str, float]:
    """Top-layer model moisture converted from 0..1 (WP..FC) to volumetric m3/m3."""
    try:
        top = strategy["sim"]["moisture"][0]
        layer = layers[0]
    except (KeyError, IndexError, TypeError):
        return {}
    wp, fc = float(layer["wp"]), float(layer["fc"])
    return {d: wp + float(f) * (fc - wp) for d, f in zip(dates, top)}


def smap_block(pack: dict, strategies: list[dict], dates: list[str], layers: list[dict]) -> dict[str, Any]:
    section = (pack.get("nasa") or {}).get("smap") or {}
    if not section or section.get("status") != "pack":
        return {
            "status": "planned",
            "product": section.get("product", "SPL3SMP_E"),
            "version": section.get("version", "006"),
            "reason": section.get("reason") or "No SMAP observations are available for this location.",
            "observations": [],
            "comparison": {},
            "limitations": ["smap.missing_pack"],
            "indicative": True,
        }

    accepted = [
        o for o in section.get("observations", [])
        if o.get("accepted") and o.get("soil_moisture_m3m3") is not None
    ]
    # Compare one value per day: the pack already averages accepted AM/PM overpasses per date.
    daily = section.get("daily") or []
    paired = [{"date": d["date"], "soil_moisture_m3m3": d["soil_moisture_m3m3"]} for d in daily]
    comparisons: dict[str, dict] = {}
    for strategy in strategies:
        model = _model_series(strategy, dates, layers)
        comparisons[strategy["id"]] = compare(model, paired)

    return {
        "status": "pack",
        "product": section.get("product", "SPL3SMP_E"),
        "product_title": section.get("product_title"),
        "version": section.get("version", "006"),
        "doi": section.get("doi"),
        "variable": section.get("variable"),
        "depth": section.get("depth"),
        "depth_cm": section.get("depth_cm"),
        "root_zone_available": bool(section.get("root_zone_available", False)),
        "units": section.get("units", "m3/m3"),
        "resolution_km": section.get("resolution_km", 9),
        "period": section.get("period"),
        "observations": [
            {
                "date": o["date"],
                "overpass": o.get("overpass"),
                "time_utc": o.get("time_utc"),
                "soil_moisture_m3m3": o.get("soil_moisture_m3m3"),
                "uncertainty_m3m3": o.get("uncertainty_m3m3"),
                "quality": o.get("quality"),
                "pixel": o.get("pixel"),
            }
            for o in accepted
        ],
        "n_observations_total": section.get("summary", {}).get("n_observations", 0),
        "n_accepted": len(accepted),
        "n_days_with_data": section.get("summary", {}).get("n_days_with_data", 0),
        "model_label": "simulated (FAO-56 water balance, top soil layer)",
        "comparison": comparisons,
        "indicative": True,
        "limitations": [
            "smap.surface_only",
            "smap.depth_mismatch",
            "smap.area_average",
            "smap.not_ground_truth",
            "smap.quality_filter",
        ],
    }


def ndvi_block(pack: dict) -> dict[str, Any]:
    section = (pack.get("nasa") or {}).get("ndvi") or {}
    if not section or section.get("status") != "pack":
        return {
            "status": "planned",
            "product": section.get("product", "VNP13A1"),
            "version": section.get("version", "002"),
            "reason": section.get("reason") or "No NDVI composites are available for this location.",
            "observations": [],
            "timeline_check": {"classification_used": False, "items": [], "summary": {}},
            "limitations": ["ndvi.missing_pack"],
        }
    accepted = [o for o in section.get("observations", []) if o.get("accepted")]
    check = section.get("timeline_check") or {}
    return {
        "status": "pack",
        "product": section.get("product", "VNP13A1"),
        "product_title": section.get("product_title"),
        "version": section.get("version", "002"),
        "variable": section.get("variable"),
        "units": section.get("units"),
        "resolution_km": section.get("resolution_km", 0.5),
        "compositing_period_days": section.get("compositing_period_days", 16),
        "period": section.get("period"),
        "observations": [
            {
                "start": o["start"],
                "end": o["end"],
                "midpoint": o.get("midpoint"),
                "ndvi": o.get("ndvi"),
                "quality": o.get("quality"),
                "pixel": o.get("pixel"),
            }
            for o in accepted
        ],
        "timeline_check": {
            "classification_used": bool(check.get("classification_used", check.get("summary", {}).get("classification_used", False))),
            "threshold_ndvi": check.get("threshold_ndvi"),
            "separation_ndvi": check.get("separation_ndvi"),
            "expected_periods": check.get("expected_periods", []),
            "items": check.get("items", []),
            "summary": check.get("summary", {}),
        },
        "limitations": ["ndvi.greenness_only", "ndvi.pixel_mixing", "ndvi.composite_smoothing", "ndvi.timeline_indicative"],
    }


def build(pack_path: str | Path | None, strategies: list[dict], dates: list[str], layers: list[dict]) -> dict[str, Any]:
    pack = load_pack(pack_path)
    evidence = {"smap": smap_block(pack, strategies, dates, layers), "ndvi": ndvi_block(pack)}
    evidence["smap"]["window"] = {
        "simulation_start": dates[0] if dates else None,
        "simulation_end": dates[-1] if dates else None,
        "note": "comparison uses only days present in both the simulation window and the observations",
    }
    return evidence
