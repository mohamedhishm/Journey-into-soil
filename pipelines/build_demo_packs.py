"""Build demo-site climate packs from raw NASA POWER downloads (backlog B3).

Reads   data/raw/power/<site_id>.json          (written by knowledge/pipelines/fetch_raw_data.py)
Writes  data/packs/demo_sites/<site_id>.json   (read by api/app/services/climate.py)

Run from the repo root:
    python pipelines/build_demo_packs.py                       # every site that has a raw file
    python pipelines/build_demo_packs.py --only kafr_el_sheikh,gharbia

Pack format (authoritative reader: api/app/services/climate.py):
    {"meta":  {id, lat, lon, source, resolution_km, period, ...},
     "daily": {"date": ["YYYY-MM-DD"...], "tmax": [], "tmin": [], "rh": [], "u2": [], "rs": [], "rain": []}}

Units after conversion: temperatures deg C, rh %, u2 m/s at 2 m, rs MJ m-2 day-1, rain mm/day.
The script refuses to write a pack from bad data (missing days, long gaps, impossible values) instead of hiding the problem.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "api") not in sys.path:
    sys.path.insert(0, str(ROOT / "api"))
from app.services.soil import parse_soilgrids  # noqa: E402

# POWER parameter -> pack key
PARAMS = {
    "T2M_MAX": "tmax",
    "T2M_MIN": "tmin",
    "RH2M": "rh",
    "WS2M": "u2",
    "ALLSKY_SFC_SW_DWN": "rs",
    "PRECTOTCORR": "rain",
}
FILL = -999.0
MAX_GAP_DAYS = 3  # longer runs of missing data make the pack unusable
RESOLUTION_KM = 50  # POWER meteorology is MERRA-2, about 0.5 x 0.625 degrees (matches the nasa_data panel in the API)
NEAR_DEG = 0.15  # climate.py uses the closest pack within this distance; sites closer than this compete for it

LIMITS = {  # (low, high) physically plausible daily values for Egypt
    "tmax": (-5.0, 55.0),
    "tmin": (-15.0, 45.0),
    "rh": (0.0, 100.0),
    "u2": (0.0, 40.0),
    "rs": (0.0, 40.0),
    "rain": (0.0, 400.0),
}


class PackError(ValueError):
    pass


def _parse_day(key: str) -> date:
    return datetime.strptime(key, "%Y%m%d").date()


def _fill_gaps(values: list[float | None], name: str, site_id: str, is_rain: bool) -> int:
    """Fill short gaps in place. Rain gaps become 0 (never interpolate rain); others interpolate linearly."""
    n = len(values)
    filled = 0
    i = 0
    while i < n:
        if values[i] is not None:
            i += 1
            continue
        j = i
        while j < n and values[j] is None:
            j += 1
        run = j - i
        if run > MAX_GAP_DAYS or i == 0 or j == n:
            raise PackError(f"{site_id}: {name} has {run} missing day(s) starting at index {i}; limit is {MAX_GAP_DAYS} and not at the edges")
        for k in range(i, j):
            if is_rain:
                values[k] = 0.0
            else:
                left, right = values[i - 1], values[j]
                values[k] = left + (right - left) * (k - i + 1) / (run + 1)
        filled += run
        i = j
    return filled


def convert_power(raw: dict, site: dict) -> dict:
    """Convert one raw POWER response into a pack dict. Raises PackError on bad input."""
    site_id = site["id"]
    try:
        series = raw["properties"]["parameter"]
    except (KeyError, TypeError) as exc:
        raise PackError(f"{site_id}: not a POWER daily response (no properties.parameter)") from exc
    missing = [p for p in PARAMS if p not in series]
    if missing:
        raise PackError(f"{site_id}: missing parameters {missing}")

    day_keys = sorted(series["T2M_MAX"])
    if not day_keys:
        raise PackError(f"{site_id}: empty series")
    days = [_parse_day(k) for k in day_keys]
    for a, b in zip(days, days[1:]):
        if b - a != timedelta(days=1):
            raise PackError(f"{site_id}: dates are not contiguous between {a} and {b}")
    for p in PARAMS:
        if sorted(series[p]) != day_keys:
            raise PackError(f"{site_id}: {p} has different dates than T2M_MAX")

    daily: dict[str, list] = {"date": [d.isoformat() for d in days]}
    filled_total = 0
    for p, key in PARAMS.items():
        vals: list[float | None] = [None if series[p][k] in (FILL, None) else float(series[p][k]) for k in day_keys]
        filled_total += _fill_gaps(vals, p, site_id, is_rain=(key == "rain"))
        daily[key] = [round(v, 2) for v in vals]

    for key, (lo, hi) in LIMITS.items():
        bad = [i for i, v in enumerate(daily[key]) if not (lo <= v <= hi) or math.isnan(v)]
        if bad:
            raise PackError(f"{site_id}: {key} outside [{lo}, {hi}] on {daily['date'][bad[0]]} (value {daily[key][bad[0]]}), {len(bad)} day(s)")
    inverted = [i for i, (hi, lo) in enumerate(zip(daily["tmax"], daily["tmin"])) if hi < lo]
    if inverted:
        raise PackError(f"{site_id}: tmax < tmin on {daily['date'][inverted[0]]}, {len(inverted)} day(s)")

    header = raw.get("header", {})
    coords = raw.get("geometry", {}).get("coordinates", [None, None, None])
    meta = {
        "id": site_id,
        "name_en": site.get("name_en"),
        "lat": site["lat"],
        "lon": site["lon"],
        "source": "NASA POWER daily API, AG community (MERRA-2 meteorology, CERES/SRB solar)",
        "source_api_version": (header.get("api") or {}).get("version"),
        "resolution_km": RESOLUTION_KM,
        "period": f"{daily['date'][0]}/{daily['date'][-1]}",
        "days": len(days),
        "filled_days": filled_total,
        "power_point": {"lon": coords[0], "lat": coords[1], "elevation_m": coords[2] if len(coords) > 2 else None},
        "units": {"tmax": "degC", "tmin": "degC", "rh": "%", "u2": "m/s at 2 m", "rs": "MJ m-2 day-1", "rain": "mm/day"},
        "acknowledgement": (
            "These data were obtained from the NASA Langley Research Center POWER Project funded through the "
            "NASA Earth Science Directorate Applied Science Program."
        ),
    }
    return {"meta": meta, "daily": daily}


def load_sites(path: Path) -> list[dict]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))["sites"]


def close_pairs(sites: list[dict]) -> list[tuple[str, str, float]]:
    """Site pairs closer than NEAR_DEG: a click near both will pick only one of the two packs."""
    out = []
    for i, a in enumerate(sites):
        for b in sites[i + 1:]:
            d = math.hypot(a["lat"] - b["lat"], a["lon"] - b["lon"])
            if d <= NEAR_DEG:
                out.append((a["id"], b["id"], round(d, 3)))
    return out


def build(
    sites: list[dict],
    raw_dir: Path,
    out_dir: Path,
    only: set[str] | None = None,
    raw_soil_dir: Path | None = None,
) -> dict:
    """Build packs. Returns {"built": [...], "skipped": [...], "failed": [(id, reason)], "warnings": [...]}."""
    result: dict = {"built": [], "skipped": [], "failed": [], "warnings": []}
    chosen = [s for s in sites if not only or s["id"] in only]
    if only:
        unknown = only - {s["id"] for s in sites}
        if unknown:
            result["failed"].extend((u, "unknown site id") for u in sorted(unknown))

    if raw_soil_dir is None:
        candidate_soil = raw_dir.parent / "soilgrids"
        raw_soil_dir = candidate_soil if candidate_soil.exists() else (ROOT / "data" / "raw" / "soilgrids")

    for site in chosen:
        src = raw_dir / f"{site['id']}.json"
        if not src.exists():
            result["skipped"].append(site["id"])
            continue
        try:
            pack = convert_power(json.loads(src.read_text(encoding="utf-8")), site)
        except (PackError, json.JSONDecodeError) as exc:
            result["failed"].append((site["id"], str(exc)))
            continue

        # Ingest SoilGrids data if available and non-null
        soil_data = None
        if raw_soil_dir:
            soil_src = raw_soil_dir / f"{site['id']}.json"
            if soil_src.exists():
                try:
                    raw_soil = json.loads(soil_src.read_text(encoding="utf-8"))
                    soil_data = parse_soilgrids(raw_soil)
                except (json.JSONDecodeError, OSError, KeyError, TypeError, ValueError):
                    soil_data = None
                if soil_data:
                    meta_src = raw_soil_dir / f"{site['id']}.meta.json"
                    meta: dict = {}
                    if meta_src.exists():
                        try:
                            meta = json.loads(meta_src.read_text(encoding="utf-8"))
                        except (json.JSONDecodeError, OSError):
                            meta = {}
                    s_lat = meta.get("sample_lat", raw_soil.get("sample_lat", site["lat"]))
                    s_lon = meta.get("sample_lon", raw_soil.get("sample_lon", site["lon"]))
                    dist_km = meta.get("offset_km", raw_soil.get("offset_km", 0.0))

                    soil_data["sample_lat"] = s_lat
                    soil_data["sample_lon"] = s_lon
                    soil_data["offset_km"] = dist_km
                    soil_data["source"] = "soilgrids_250m_model"
                    soil_data["depth"] = "0-5cm"

                    if dist_km > 5.0:
                        result["warnings"].append(f"{site['id']}: SoilGrids sampled at offset {dist_km} km > 5 km")
                else:
                    result["warnings"].append(f"{site['id']}: no valid SoilGrids topsoil data; soil block omitted")

        pack["soil"] = soil_data

        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{site['id']}.json").write_text(json.dumps(pack, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        result["built"].append(site["id"])
        if pack["meta"]["filled_days"]:
            result["warnings"].append(f"{site['id']}: {pack['meta']['filled_days']} short-gap value(s) filled")
    for a, b, d in close_pairs([s for s in chosen if s["id"] in result["built"]]):
        result["warnings"].append(f"{a} and {b} are only {d} deg apart: a click near both uses the closer pack (ties: the later one)")
    return result


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--sites", type=Path, default=ROOT / "knowledge" / "demo_sites.yaml")
    ap.add_argument("--raw", type=Path, default=ROOT / "data" / "raw" / "power")
    ap.add_argument("--raw-soil", type=Path, default=ROOT / "data" / "raw" / "soilgrids")
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "packs" / "demo_sites")
    ap.add_argument("--only", help="comma-separated site ids")
    args = ap.parse_args(argv)

    only = {s.strip() for s in args.only.split(",") if s.strip()} if args.only else None
    res = build(load_sites(args.sites), args.raw, args.out, only, raw_soil_dir=args.raw_soil)
    print(f"built {len(res['built'])}: {', '.join(res['built']) or '-'}")
    if res["skipped"]:
        print(f"skipped (no raw file): {', '.join(res['skipped'])}")
    for w in res["warnings"]:
        print(f"warning: {w}")
    for site_id, why in res["failed"]:
        print(f"FAILED {site_id}: {why}", file=sys.stderr)
    return 1 if res["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
