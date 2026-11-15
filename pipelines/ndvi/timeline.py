"""Bare-field versus crop timeline check from an observed NDVI series.

Method (deliberately simple, documented, and never presented as ground truth):
  1. Build the *expected* crop calendar for the study period from the demo site's preset crop
     history and the season windows in knowledge/season_windows.yaml (sowing window + crop
     cycle length). Periods outside any growing window are labelled "expected fallow".
  2. Compare accepted NDVI composites inside expected-crop periods with those inside expected
     fallow periods. The separation threshold is the midpoint of the two medians, and is only
     used when the two medians differ by at least MIN_SEPARATION (0.10 NDVI). Otherwise the
     check returns "uncertain" and no bare/crop classification is made.
  3. Each composite is then labelled by comparing its NDVI to that threshold, and agreement
     with the expected state is reported as ok / check.

NDVI is a greenness indicator: a mismatch can be a late/early sowing, a second crop, weeds,
irrigation differences, or simply 500 m pixel mixing. That is why mismatches are labelled
"check" (indicative) rather than "wrong".
"""

from __future__ import annotations

from datetime import date, timedelta
from statistics import median
from typing import Any

MIN_SEPARATION = 0.10


def cycle_length(crop: dict) -> int:
    stages = crop.get("cycle_days") or [30, 30, 30, 30]
    return int(sum(stages))


def _md(text: str, year: int) -> date:
    month, day = text.split("-")
    return date(year, int(month), int(day))


def crop_calendar(history: list[dict], crops: dict[str, dict], windows: dict, start: date, end: date) -> list[dict]:
    """Expected growing periods between start and end, from history + season windows.

    `history` is newest-first [{crop, season}]. For each season occurrence we use the most
    recent history entry for that season; no entry means the field is expected to be fallow.
    """
    by_season: dict[str, str] = {}
    for item in history:
        by_season.setdefault(item["season"], item["crop"])
    periods: list[dict] = []
    for year in (start.year - 1, start.year, start.year + 1):
        for season, spec in windows["seasons"].items():
            try:
                earliest = _md(spec["earliest_sow"], year)
            except (KeyError, ValueError):
                continue
            if not (start <= earliest <= end):
                continue
            crop_id = by_season.get(season)
            crop = crops.get(crop_id) if crop_id else None
            if crop is None:
                continue
            sow = max(earliest, start)
            harvest = min(sow + timedelta(days=cycle_length(crop) - 1), end)
            periods.append({"start": sow.isoformat(), "end": harvest.isoformat(), "crop": crop_id, "season": season})
    periods.sort(key=lambda p: p["start"])
    return periods


def _expected_at(day: date, periods: list[dict]) -> dict | None:
    for period in periods:
        if date.fromisoformat(period["start"]) <= day <= date.fromisoformat(period["end"]):
            return period
    return None


def timeline_check(series: list[dict], periods: list[dict]) -> dict[str, Any]:
    """Compare accepted NDVI composites against the expected crop calendar.

    `series` items need at least {"start", "end", "midpoint", "ndvi"}.
    """
    items = []
    for obs in series:
        if obs.get("ndvi") is None:
            continue
        mid = date.fromisoformat(obs.get("midpoint") or obs["start"])
        expected = _expected_at(mid, periods)
        items.append(
            {
                "start": obs["start"],
                "end": obs["end"],
                "midpoint": mid.isoformat(),
                "ndvi": obs["ndvi"],
                "expected": "crop" if expected else "fallow",
                "expected_crop": expected["crop"] if expected else None,
                "expected_season": expected["season"] if expected else None,
            }
        )

    crop_vals = [i["ndvi"] for i in items if i["expected"] == "crop"]
    fallow_vals = [i["ndvi"] for i in items if i["expected"] == "fallow"]
    threshold = None
    separation = None
    if crop_vals and fallow_vals:
        crop_med, fallow_med = median(crop_vals), median(fallow_vals)
        separation = round(crop_med - fallow_med, 3)
        if abs(crop_med - fallow_med) >= MIN_SEPARATION:
            threshold = round((crop_med + fallow_med) / 2, 3)

    n_ok = n_check = n_uncertain = 0
    for item in items:
        if threshold is None:
            item["observed"] = "uncertain"
            item["agreement"] = "uncertain"
            n_uncertain += 1
            continue
        item["observed"] = "vegetated" if item["ndvi"] >= threshold else "low_cover"
        expected_vegetated = item["expected"] == "crop"
        if expected_vegetated == (item["observed"] == "vegetated"):
            item["agreement"] = "ok"
            n_ok += 1
        else:
            item["agreement"] = "check"
            n_check += 1

    return {
        "method": "expected calendar vs NDVI threshold",
        "classification_used": threshold is not None,
        "threshold_ndvi": threshold,
        "separation_ndvi": separation,
        "min_separation_ndvi": MIN_SEPARATION,
        "median_crop_ndvi": round(median(crop_vals), 3) if crop_vals else None,
        "median_fallow_ndvi": round(median(fallow_vals), 3) if fallow_vals else None,
        "expected_periods": periods,
        "items": items,
        "summary": {
            "n_composites": len(items),
            "n_ok": n_ok,
            "n_check": n_check,
            "n_uncertain": n_uncertain,
            "classification_used": threshold is not None,
        },
        "limitations": [
            "The expected calendar comes from the demo-site preset history, not from the farmer's "
            "field records; a mismatch can be late sowing, a second crop, weeds or irrigation.",
            "A 500 m NDVI pixel mixes many fields, so it cannot confirm what is growing on this field.",
            "NDVI is a greenness indicator, not a measurement of soil health, crop identity or yield.",
            "16-day composites smooth the season and blur short fallow gaps.",
        ],
    }
