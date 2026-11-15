"""Build data/packs/demo_sites/<id>.json from the extracted NASA series.

The pack keeps the climate section untouched (written by the POWER pipeline when available)
and adds a `nasa` block with real, labelled observations:

    {
      "meta":  {... lat, lon, region, period ...},
      "daily": {... climate arrays, may be empty ...},
      "nasa":  {
        "smap": {...surface soil moisture, quality, gaps, limitations...},
        "ndvi": {...16-day composites, quality, timeline check...}
      },
      "provenance": {...products, versions, DOIs, retrieval time...}
    }

Missing products are written with status "planned" and an explicit reason; nothing is faked.

Usage:
    python pipelines/packs/build_demo_packs.py
    python pipelines/packs/build_demo_packs.py --smap data/raw/smap/observations.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipelines.ndvi.process import site_section as ndvi_section  # noqa: E402
from pipelines.ndvi.timeline import crop_calendar, timeline_check  # noqa: E402
from pipelines.smap.process import SmapObservation  # noqa: E402
from pipelines.smap.process import site_section as smap_section  # noqa: E402

PACK_DIR = ROOT / "data" / "packs" / "demo_sites"
SMAP_OBS = ROOT / "data" / "raw" / "smap" / "observations.json"
NDVI_OBS = ROOT / "data" / "raw" / "ndvi" / "observations.json"
CLIMATE_KEYS = ("date", "tmax", "tmin", "rh", "u2", "rs", "rain")


def load_yaml(name: str) -> dict:
    with (ROOT / "knowledge" / f"{name}.yaml").open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def planned(reason: str, product: str, version: str) -> dict:
    return {"status": "planned", "product": product, "version": version, "reason": reason, "observations": []}


def obs_from_json(raw: list[dict], site_id: str) -> list[SmapObservation]:
    from datetime import date as _date

    out = []
    for item in raw:
        out.append(
            SmapObservation(
                site_id=site_id,
                overpass=item["overpass"],
                date=_date.fromisoformat(item["date"]),
                time_utc=item.get("time_utc") or "",
                soil_moisture=item.get("soil_moisture_m3m3"),
                uncertainty=item.get("uncertainty_m3m3"),
                quality_flag=(item.get("quality") or {}).get("retrieval_qual_flag"),
                accepted=bool(item.get("accepted")),
                reject_reasons=item.get("reject_reasons") or [],
                surface_conditions=(item.get("quality") or {}).get("surface_conditions") or [],
                pixel_lat=(item.get("pixel") or {}).get("lat"),
                pixel_lon=(item.get("pixel") or {}).get("lon"),
                pixel_distance_km=(item.get("pixel") or {}).get("distance_km"),
                vegetation_opacity=item.get("vegetation_opacity"),
                granule=item.get("granule", ""),
            )
        )
    return out


def dhaka(*_args: object) -> None:  # pragma: no cover - placeholder to keep lint quiet
    return None


def build_site(site: dict, smap_raw: list[dict], ndvi_raw: list[dict], crops: dict, windows: dict) -> dict:
    path = PACK_DIR / f"{site['id']}.json"
    existing: dict = {}
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except ValueError:
            existing = {}

    smap = smap_section(site["id"], obs_from_json(smap_raw, site["id"])) if smap_raw else planned(
        "No SMAP SPL3SMP_E granule could be read for this site.", "SPL3SMP_E", "006"
    )

    ndvi_obs = []
    if ndvi_raw:
        from datetime import date as _date

        from pipelines.ndvi.process import NdviObservation

        for item in ndvi_raw:
            ndvi_obs.append(
                NdviObservation(
                    site_id=site["id"],
                    start=_date.fromisoformat(item["start"]),
                    end=_date.fromisoformat(item["end"]),
                    midpoint=_date.fromisoformat(item["midpoint"]),
                    ndvi=item.get("ndvi"),
                    accepted=bool(item.get("accepted")),
                    reject_reasons=item.get("reject_reasons") or [],
                    raw_ndvi=None,
                    reliability=(item.get("quality") or {}).get("pixel_reliability"),
                    modland_qa=(item.get("quality") or {}).get("modland_qa"),
                    usefulness=(item.get("quality") or {}).get("vi_usefulness"),
                    composite_doy=item.get("composite_doy"),
                    pixel_lat=(item.get("pixel") or {}).get("lat"),
                    pixel_lon=(item.get("pixel") or {}).get("lon"),
                    pixel_distance_km=(item.get("pixel") or {}).get("distance_km"),
                    granule=item.get("granule", ""),
                    box_median=(item.get("neighborhood") or {}).get("median_ndvi"),
                    box_p25=(item.get("neighborhood") or {}).get("p25_ndvi"),
                    box_p75=(item.get("neighborhood") or {}).get("p75_ndvi"),
                    box_n=(item.get("neighborhood") or {}).get("n_pixels"),
                    box_vegetated_fraction=(item.get("neighborhood") or {}).get("vegetated_fraction"),
                )
            )
    if ndvi_obs:
        ndvi = ndvi_section(site["id"], ndvi_obs)
        # Use the deduplicated section, not the raw records: overlapping tiles repeat composites.
        accepted = [o for o in ndvi["observations"] if o["accepted"]]
        history = (site.get("preset") or {}).get("history") or []
        period = ndvi.get("period") or {}
        if accepted and period:
            periods = crop_calendar(
                history,
                crops,
                windows,
                start=__import__("datetime").date.fromisoformat(period["start"]),
                end=__import__("datetime").date.fromisoformat(period["end"]),
            )
            regional = ndvi.get("regional_series") or []
            basis = regional if regional else accepted
            ndvi["timeline_check"] = timeline_check(basis, periods)
            ndvi["timeline_check"]["basis"] = (
                "median of usable 500 m pixels in a ~15 km box" if regional
                else "single 500 m pixel at the site"
            )
        else:
            ndvi["timeline_check"] = {
                "classification_used": False,
                "items": [],
                "summary": {"n_composites": 0, "classification_used": False},
                "limitations": ["No accepted NDVI composite is available for this site."],
            }
        ndvi["expected_calendar_source"] = "demo-site preset history + knowledge/season_windows.yaml"
    else:
        ndvi = planned("No VNP13A1 composite could be read for this site.", "VNP13A1", "002")
        ndvi["timeline_check"] = {
            "classification_used": False,
            "items": [],
            "summary": {"n_composites": 0, "classification_used": False},
            "limitations": ["No accepted NDVI composite is available, so the timeline check cannot run."],
        }

    previous_daily = existing.get("daily") or {}
    # Only keep a climate section that is actually a climate section (older packs from the
    # broken SMAP attempt wrote soil-moisture arrays into `daily`).
    if all(isinstance(previous_daily.get(key), list) and len(previous_daily.get(key, [])) for key in CLIMATE_KEYS[1:]) \
            and previous_daily.get("date"):
        daily = previous_daily
    else:
        daily = {key: [] for key in CLIMATE_KEYS}
    meta = {
        "id": site["id"],
        "name_en": site.get("name_en"),
        "name_ar": site.get("name_ar"),
        "lat": site["lat"],
        "lon": site["lon"],
        "region": site.get("region"),
        "source": "nasa-packs",
        "resolution_km": 9,
        "period": smap.get("period") or ndvi.get("period"),
    }
    pack = {
        "meta": meta,
        "daily": daily,
        "nasa": {"smap": smap, "ndvi": ndvi},
        "provenance": {
            "built_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "smaps": {"product": "SPL3SMP_E", "version": "006", "doi": "10.5067/M20OXIZHY3RJ",
                      "source": "NASA NSIDC DAAC", "variables": ["soil_moisture (surface, top ~5 cm)"]},
            "ndvi": {"product": "VNP13A1", "version": "002", "source": "NASA LP DAAC",
                     "variables": ["NDVI", "pixel reliability", "VI quality"]},
            "labels": {
                "smap": "observed (NASA satellite retrieval)",
                "ndvi": "observed (NASA satellite composite)",
                "model": "simulated (FAO-56 water balance)",
            },
        },
    }
    return pack


def main() -> int:
    parser = argparse.ArgumentParser(description="Build demo packs from extracted NASA series.")
    parser.add_argument("--smap", type=Path, default=SMAP_OBS)
    parser.add_argument("--ndvi", type=Path, default=NDVI_OBS)
    args = parser.parse_args()

    sites = load_yaml("demo_sites")["sites"]
    crops = {c["id"]: {**load_yaml("crops").get("defaults", {}), **c} for c in load_yaml("crops")["crops"]}
    windows = load_yaml("season_windows")

    smap_doc = json.loads(args.smap.read_text(encoding="utf-8")) if args.smap.exists() else {"sites": {}}
    ndvi_doc = json.loads(args.ndvi.read_text(encoding="utf-8")) if args.ndvi.exists() else {"sites": {}}
    PACK_DIR.mkdir(parents=True, exist_ok=True)

    for site in sites:
        pack = build_site(
            site,
            (smap_doc.get("sites") or {}).get(site["id"], []),
            (ndvi_doc.get("sites") or {}).get(site["id"], []),
            crops,
            windows,
        )
        out = PACK_DIR / f"{site['id']}.json"
        out.write_text(json.dumps(pack, indent=2, ensure_ascii=False), encoding="utf-8")
        smap_summary = pack["nasa"]["smap"].get("summary", {})
        ndvi_summary = pack["nasa"]["ndvi"].get("summary", {})
        print(
            f"{site['id']:16s} smap={pack['nasa']['smap']['status']:8s}"
            f"({smap_summary.get('n_days_with_data', 0)} days) "
            f"ndvi={pack['nasa']['ndvi']['status']:8s}({ndvi_summary.get('n_accepted', 0)} composites) "
            f"-> {out.name}"
        )
    print("\nDemo packs written. Missing products are marked 'planned' with a reason.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
