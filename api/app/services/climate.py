"""Daily climate for a list of dates.

Order of preference: a NASA data pack for a nearby demo site (data/packs/demo_sites/*.json) -> synthetic Nile Delta
climatology. The synthetic series is a LABELLED PLACEHOLDER: smooth seasonal cycles and seeded random rain. It exists so the
whole product runs before real NASA data arrives; results built on it are reported with low confidence.

Pack format (see docs/data-sources.md):
  {"meta": {"id","lat","lon","source","resolution_km","period"},
   "daily": {"date": ["YYYY-MM-DD"...], "tmax": [], "tmin": [], "rh": [], "u2": [], "rs": [], "rain": []}}
Planning uses an analog-year approach: each future date takes the value of the same month-day from the latest year in the pack.
"""
from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass, field
from datetime import date

from ..config import get_settings
from ..sim.et0 import extraterrestrial_radiation, fao56_et0
from ..sim.types import DayInput

HISTORICAL_YEARS = list(range(2011, 2026))


@dataclass
class Climate:
    dates: list[str]
    tmin: list[float]
    tmax: list[float]
    rain: list[float]
    et0: list[float]
    source: str  # "synthetic" | "pack"
    pack_id: str | None = None
    pack_path: str | None = None
    resolution_km: float | None = None
    notes: list[str] = field(default_factory=list)
    products: list[str] = field(default_factory=list)
    soil: dict | None = None


def _seasonal(doy: int) -> float:
    return math.sin(2 * math.pi * (doy - 110) / 365)


def synthetic_day(lat: float, d: date) -> dict[str, float]:
    doy = d.timetuple().tm_yday
    south = max(0.0, 31.0 - lat)
    tmean = 20.7 + 7.4 * _seasonal(doy) + 0.9 * south
    dtr = 9.0 + 0.9 * south
    rh = 62.0 - 8.0 * _seasonal(doy) - 2.5 * south
    u2 = 2.3 + 0.5 * math.cos(2 * math.pi * (doy - 60) / 365)
    rs = 0.70 * extraterrestrial_radiation(lat, doy)
    month = d.month
    p_rain = {12: 0.09, 1: 0.09, 2: 0.08, 3: 0.05, 11: 0.05, 4: 0.02, 10: 0.02}.get(month, 0.0)
    rng = random.Random(f"{round(lat, 1)}-{d.isoformat()}")
    scale = max(0.3, min(1.2, (lat - 27.0) / 4.0))
    rain = rng.expovariate(1 / 5.0) * scale if rng.random() < p_rain * scale else 0.0
    return {"tmax": tmean + dtr / 2, "tmin": tmean - dtr / 2, "rh": rh, "u2": u2, "rs": rs, "rain": round(rain, 1)}


def _find_pack(lat: float, lon: float) -> tuple[dict, str] | tuple[None, None]:
    """Nearest demo pack within 0.15 deg, with its path (path is needed for NASA evidence)."""
    folder = get_settings().packs_dir / "demo_sites"
    if not folder.exists():
        return None, None
    best, best_path, best_dist = None, None, 0.15
    for path in folder.glob("*.json"):
        try:
            pack = json.loads(path.read_text(encoding="utf-8"))
            meta = pack["meta"]
            dist = math.hypot(meta["lat"] - lat, meta["lon"] - lon)
        except (ValueError, KeyError, OSError, TypeError):
            continue
        if dist <= best_dist:
            best, best_path, best_dist = pack, str(path), dist
    return best, best_path


def pack_path_for(lat: float, lon: float) -> str | None:
    """Path of the demo pack that would serve this location (used for NASA evidence lookup)."""
    _pack, path = _find_pack(lat, lon)
    return path


def find_pack(lat: float, lon: float) -> dict | None:
    """Find the nearest demo pack for coordinates, or None if none within 0.15 deg."""
    pack, _path = _find_pack(lat, lon)
    return pack


def _analog_lookup(pack: dict) -> dict[str, dict[str, float]]:
    daily = pack.get("daily") or {}
    if not daily.get("date"):
        return {}
    table: dict[str, dict[str, float]] = {}
    required = ("tmax", "tmin", "rh", "u2", "rs", "rain")
    if not all(isinstance(daily.get(k), list) for k in required):
        return {}  # a pack without a climate section is not a climate pack (e.g. NASA-only packs)
    for i, iso in enumerate(daily["date"]):  # later years overwrite earlier ones
        try:
            table[iso[5:]] = {k: daily[k][i] for k in required}
        except (KeyError, IndexError, TypeError):
            continue
    return table


def get_climate(lat: float, lon: float, dates: list[date], d_t: float = 0.0, d_p: float = 0.0) -> Climate:
    pack, pack_path = _find_pack(lat, lon)
    table = _analog_lookup(pack) if pack else {}
    rows: list[dict[str, float]] = []
    used_pack = 0
    for d in dates:
        row = table.get(d.isoformat()[5:])
        if row:
            used_pack += 1
        else:
            row = synthetic_day(lat, d)
        rows.append(row)

    source = "pack" if pack and used_pack >= 0.9 * len(dates) else "synthetic"
    tmin, tmax, rain, et0 = [], [], [], []
    for d, r in zip(dates, rows):
        t_min, t_max = r["tmin"] + d_t, r["tmax"] + d_t
        rr = max(0.0, r["rain"] * (1 + d_p / 100.0))
        tmin.append(round(t_min, 1))
        tmax.append(round(t_max, 1))
        rain.append(round(rr, 1))
        et0.append(round(fao56_et0(t_min, t_max, r["rh"], r["u2"], r["rs"], lat, d.timetuple().tm_yday), 2))
    notes = []
    if source == "synthetic":
        notes.append("synthetic_climate")
    products = list((pack or {}).get("meta", {}).get("products", ["power"])) if source == "pack" else []
    soil = pack.get("soil") if (source == "pack" and pack) else None
    return Climate(
        dates=[d.isoformat() for d in dates], tmin=tmin, tmax=tmax, rain=rain, et0=et0, source=source,
        pack_id=(pack or {}).get("meta", {}).get("id") if source == "pack" else None,
        pack_path=pack_path if pack else None,
        resolution_km=(pack or {}).get("meta", {}).get("resolution_km") if source == "pack" else None,
        notes=notes,
        products=products,
        soil=soil,
    )


def _is_leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def get_historical_climate_series(
    lat: float,
    lon: float,
    dates: list[date],
    d_t: float = 0.0,
    d_p: float = 0.0,
    years: list[int] | None = None,
) -> tuple[Climate, list[list[DayInput]], list[int]]:
    pack, _pack_path = _find_pack(lat, lon)
    baseline = get_climate(lat, lon, dates, d_t, d_p)
    baseline_days = [
        DayInput(d, e, r, t)
        for d, e, r, t in zip(baseline.dates, baseline.et0, baseline.rain, baseline.tmax)
    ]
    if not pack or baseline.source != "pack":
        if years is None:
            years = HISTORICAL_YEARS
        return baseline, [baseline_days for _ in years], list(years)

    daily = pack["daily"]
    date_to_idx = {iso: i for i, iso in enumerate(daily["date"])}
    if years is None:
        pack_years = sorted(list({int(iso[:4]) for iso in daily.get("date", []) if len(iso) >= 4 and iso[:4].isdigit()}))
        available_anchor_years = [y for y in HISTORICAL_YEARS if y in pack_years]
        years = available_anchor_years if available_anchor_years else (pack_years[:5] if pack_years else HISTORICAL_YEARS)

    table = _analog_lookup(pack)
    d0 = dates[0]

    all_series: list[list[DayInput]] = []
    evaluated_years: list[int] = []

    for anchor_year in years:
        year_days: list[DayInput] = []
        for d in dates:
            delta_years = d.year - d0.year
            target_year = anchor_year + delta_years
            if target_year > 2025:
                wrap_span = max(1, years[-1] - years[0] + 1)
                target_year = years[0] + (target_year - 2026) % wrap_span
            elif target_year < 2000:
                target_year = years[0]

            m = d.month
            day_num = d.day
            if m == 2 and day_num == 29:
                if _is_leap_year(target_year) and f"{target_year:04d}-02-29" in date_to_idx:
                    lookup_iso = f"{target_year:04d}-02-29"
                else:
                    lookup_iso = f"{target_year:04d}-02-28"
            else:
                lookup_iso = f"{target_year:04d}-{m:02d}-{day_num:02d}"

            idx = date_to_idx.get(lookup_iso)
            if idx is not None:
                r = {k: daily[k][idx] for k in ("tmax", "tmin", "rh", "u2", "rs", "rain")}
            else:
                r = table.get(d.isoformat()[5:]) or synthetic_day(lat, d)

            t_min = r["tmin"] + d_t
            t_max = r["tmax"] + d_t
            rain = max(0.0, r["rain"] * (1 + d_p / 100.0))
            doy = d.timetuple().tm_yday
            et0_val = round(fao56_et0(t_min, t_max, r["rh"], r["u2"], r["rs"], lat, doy), 2)
            year_days.append(DayInput(d.isoformat(), et0_val, round(rain, 1), round(t_max, 1)))

        all_series.append(year_days)
        evaluated_years.append(anchor_year)

    return baseline, all_series, evaluated_years
