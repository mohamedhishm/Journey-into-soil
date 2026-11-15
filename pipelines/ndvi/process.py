"""NDVI extraction from VIIRS VNP13A1 v002 (500 m, 16-day composites).

Why this product (see docs/ndvi-source.md for the full comparison):
  * MOD13Q1 v061 (250 m) is stored as HDF4, which needs pyhdf/HDF4 system libraries that are
    not available for this Windows + Python 3.14 environment; granules are also ~129 MB each.
  * HLS (HLSS30/HLSL30 v2.0, 30 m) is preferable on resolution but is ~7 GB of tiles per year
    at the 0.2-0.6 MB/s DAAC throughput measured here.
  * VNP13A1 v002 is HDF5 (readable with h5py), 56 MB per granule, 500 m, 16-day, and carries a
    documented pixel-reliability layer. It is the practical choice for a demo-sized series.

Authoritative facts read from the product files themselves (verified 2026-11-13):
  * `NDVI`: int16, scale_factor 0.0001, add_offset 0, valid_range -10000..10000, fill -15000/-13000.
  * `pixel reliability`: rank 0 excellent, 1 good, 2 acceptable, 3 marginal, 4 pass,
    5 questionable, 6 poor, 7 cloud shadow, 8 snow/ice, 9 cloud, 10 estimated, 11 LTAVG,
    -1 no data, -4 water.
  * `VI Quality`: bit field with MODLAND_QA (bits 0-1; 00 = VI produced, good quality)
    and VI usefulness (bits 2-5; 0000 highest quality ... 1101 not useful).

NDVI measures vegetation greenness / canopy condition. It is NOT a measurement of soil health,
crop identity or fertility, and a 500 m pixel mixes many fields. Nothing here is invented: every
composite keeps its raw QA layers so the UI can show what was accepted and what was rejected.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import h5py
import numpy as np

PRODUCT = "VNP13A1"
PRODUCT_TITLE = "VIIRS/NPP Vegetation Indices 16-Day L3 Global 500 m SIN Grid"
VERSION = "002"
RESOLUTION_KM = 0.5
SCALE = 0.0001
FILL_VALUES = (-15000, -13000)
VALID_RANGE = (-10000, 10000)
GRID = "HDFEOS/GRIDS/VIIRS_Grid_16Day_VI_500m"
FIELDS = {
    "ndvi": "500 m 16 days NDVI",
    "evi": "500 m 16 days EVI",
    "qa": "500 m 16 days VI Quality",
    "reliability": "500 m 16 days pixel reliability",
    "doy": "500 m 16 days composite day of the year",
}
R_SPHERE = 6371007.181  # sinusoidal sphere radius used by the SIN grid (from StructMetadata)

RELIABILITY_MEANING = {
    0: "excellent", 1: "good", 2: "acceptable", 3: "marginal", 4: "pass", 5: "questionable",
    6: "poor", 7: "cloud_shadow", 8: "snow_ice", 9: "cloud", 10: "estimated", 11: "long_term_average",
    -1: "no_data", -4: "water",
}
# Only these reliability ranks are accepted for the demo series.
ACCEPTED_RELIABILITY = (0, 1, 2)
# A 500 m pixel centred within ~1 km of the site is the closest thing to "this field" the product offers.
MAX_PIXEL_DISTANCE_KM = 1.0
# Regional context box half-width in pixels (16 x 463 m ~ 7.4 km -> a ~15 km box).
NEIGHBORHOOD_PIXELS = 16
NEIGHBORHOOD_RADIUS_KM = round(NEIGHBORHOOD_PIXELS * 0.463 * 1.0, 1)
VEGETATED_NDVI = 0.3


@dataclass
class NdviObservation:
    site_id: str
    start: date
    end: date
    midpoint: date
    ndvi: float | None
    accepted: bool
    reject_reasons: list[str] = field(default_factory=list)
    raw_ndvi: int | None = None
    reliability: int | None = None
    modland_qa: int | None = None
    usefulness: int | None = None
    composite_doy: int | None = None
    pixel_lat: float | None = None
    pixel_lon: float | None = None
    pixel_distance_km: float | None = None
    granule: str = ""
    # Regional context: a 15 km box around the site, because one 500 m pixel cannot represent a field.
    box_median: float | None = None
    box_p25: float | None = None
    box_p75: float | None = None
    box_n: int | None = None
    box_vegetated_fraction: float | None = None

    def to_json(self) -> dict[str, Any]:
        return {
            "site_id": self.site_id,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "midpoint": self.midpoint.isoformat(),
            "ndvi": None if self.ndvi is None else round(self.ndvi, 3),
            "accepted": self.accepted,
            "reject_reasons": self.reject_reasons,
            "quality": {
                "pixel_reliability": self.reliability,
                "pixel_reliability_meaning": RELIABILITY_MEANING.get(self.reliability) if self.reliability is not None else None,
                "modland_qa": self.modland_qa,
                "vi_usefulness": self.usefulness,
            },
            "composite_doy": self.composite_doy,
            "pixel": {
                "lat": None if self.pixel_lat is None else round(self.pixel_lat, 4),
                "lon": None if self.pixel_lon is None else round(self.pixel_lon, 4),
                "distance_km": None if self.pixel_distance_km is None else round(self.pixel_distance_km, 2),
            },
            "granule": self.granule,
            "neighborhood": None if self.box_median is None else {
                "radius_km": NEIGHBORHOOD_RADIUS_KM,
                "median_ndvi": round(self.box_median, 3),
                "p25_ndvi": None if self.box_p25 is None else round(self.box_p25, 3),
                "p75_ndvi": None if self.box_p75 is None else round(self.box_p75, 3),
                "n_pixels": self.box_n,
                "vegetated_fraction": None if self.box_vegetated_fraction is None else round(self.box_vegetated_fraction, 2),
                "basis": "median of accepted 500 m pixels in the surrounding box, not the field",
            },
        }


# --------------------------------------------------------------------------------------
# pure helpers
# --------------------------------------------------------------------------------------


def scale_ndvi(raw: int) -> float:
    """Apply the documented scale factor."""
    return raw * SCALE


def is_fill(raw: int) -> bool:
    return raw in FILL_VALUES


def decode_qa(qa: int | None) -> dict[str, int | None]:
    """Split the documented VI Quality bit field into its named components."""
    if qa is None or qa == 65535:
        return {"modland_qa": None, "usefulness": None, "aerosol": None, "adjacent_cloud": None,
                "brdf_corrected": None, "mixed_clouds": None, "land_water": None, "snow_ice": None, "shadow": None}
    return {
        "modland_qa": qa & 0b11,
        "usefulness": (qa >> 2) & 0b1111,
        "aerosol": (qa >> 6) & 0b11,
        "adjacent_cloud": (qa >> 8) & 0b1,
        "brdf_corrected": (qa >> 9) & 0b1,
        "mixed_clouds": (qa >> 10) & 0b1,
        "land_water": (qa >> 11) & 0b111,
        "snow_ice": (qa >> 14) & 0b1,
        "shadow": (qa >> 15) & 0b1,
    }


def quality_decision(raw: int | None, reliability: int | None, qa: int | None) -> tuple[bool, list[str]]:
    """Apply the documented masks. Returns (accepted, reasons) for a single pixel."""
    reasons: list[str] = []
    if raw is None or is_fill(raw):
        reasons.append("no_observation")
    elif not (VALID_RANGE[0] <= raw <= VALID_RANGE[1]):
        reasons.append("outside_valid_range")
    if reliability is None or reliability not in ACCEPTED_RELIABILITY:
        reasons.append(f"pixel_reliability_{RELIABILITY_MEANING.get(reliability, 'unknown')}")
    decoded = decode_qa(qa)
    if decoded["modland_qa"] not in (None, 0):
        reasons.append("modland_qa_not_good")
    if decoded["usefulness"] is not None and decoded["usefulness"] > 0b1100:
        reasons.append("vi_not_useful")
    if decoded["snow_ice"]:
        reasons.append("snow_ice")
    return (not reasons, reasons)


def sinusoidal_xy(lat: float, lon: float) -> tuple[float, float]:
    """Latitude/longitude -> sinusoidal (SIN) projection metres.

    This is the GCTP sinusoidal used by the HDF-EOS grid: x = R*lon*cos(lat), y = R*lat, with
    lon/lat in radians. The file's own StructMetadata confirms it: tile h20v06 has
    UpperLeftPointMtrs y = 3,335,851, which is R*radians(30.0) — the tile's documented north
    bounding coordinate — not R*sin(30 deg) = 3,185,504. Getting this wrong shifts every sample
    to a neighbouring tile (~130 km away), so a test pins it.
    """
    return (
        R_SPHERE * np.radians(lon) * np.cos(np.radians(lat)),
        R_SPHERE * np.radians(lat),
    )


def nearest_index(axis: np.ndarray, value: float) -> int:
    return int(np.argmin(np.abs(axis - value)))


def granule_start(name: str) -> date:
    """VNP13A1.AYYYYDDD.hxxvyy.vvv... -> start date of the 16-day composite."""
    for part in Path(name).name.split("."):
        if len(part) == 8 and part[0] == "A" and part[1:].isdigit():
            year, doy = int(part[1:5]), int(part[5:])
            return date(year, 1, 1) + timedelta(days=doy - 1)
    raise ValueError(f"cannot read composite date from {name}")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp, dl = p2 - p1, np.radians(lon2 - lon1)
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return float(2 * r * np.arcsin(np.sqrt(a)))


def _pixel_latlon(x: float, y: float) -> tuple[float, float]:
    """Inverse of sinusoidal_xy (y = R*lat, x = R*lon*cos(lat))."""
    lat = float(np.degrees(y / R_SPHERE))
    lon = float(np.degrees(x / (R_SPHERE * np.cos(np.radians(lat)))))
    return lat, lon


# --------------------------------------------------------------------------------------
# extraction
# --------------------------------------------------------------------------------------


def extract_site(handle: h5py.File, site: dict, granule_name: str) -> NdviObservation:
    start = granule_start(granule_name)
    end = start + timedelta(days=15)
    grid = handle[GRID]
    try:
        x_axis = np.asarray(grid["XDim"][()])
        y_axis = np.asarray(grid["YDim"][()])
    except KeyError:
        return NdviObservation(site["id"], start, end, start + timedelta(days=7), None, False, ["no_geolocation"], granule=granule_name)

    x, y = sinusoidal_xy(site["lat"], site["lon"])
    ix, iy = nearest_index(x_axis, x), nearest_index(y_axis, y)

    fields = grid["Data Fields"]
    ndvi_ds = fields[FIELDS["ndvi"]]
    chosen: tuple[int, int, float] | None = None
    for pad in (0, 1, 2):
        y0, y1 = max(0, iy - pad), min(ndvi_ds.shape[0], iy + pad + 1)
        x0, x1 = max(0, ix - pad), min(ndvi_ds.shape[1], ix + pad + 1)
        window = np.asarray(ndvi_ds[y0:y1, x0:x1])
        valid = np.isfinite(window) & ~np.isin(window, FILL_VALUES)
        if valid.any():
            yy, xx = np.nonzero(valid)
            dist = np.sqrt((yy + y0 - iy) ** 2 + (xx + x0 - ix) ** 2)
            best = int(np.argmin(dist))
            r, c = y0 + int(yy[best]), x0 + int(xx[best])
            chosen = (r, c, float(dist[best]) * RESOLUTION_KM)
            break
    if chosen is None:
        return NdviObservation(site["id"], start, end, start + timedelta(days=7), None, False, ["no_observation"], granule=granule_name)

    iy, ix, offset_km = chosen
    raw = int(np.asarray(ndvi_ds[iy, ix]))
    reliability = int(np.asarray(fields[FIELDS["reliability"]][iy, ix]))
    qa = int(np.asarray(fields[FIELDS["qa"]][iy, ix]))
    doy_raw = int(np.asarray(fields[FIELDS["doy"]][iy, ix]))
    composite_doy = doy_raw if 1 <= doy_raw <= 366 else None
    midpoint = start + timedelta(days=7)
    if composite_doy is not None:
        year = start.year if composite_doy >= start.timetuple().tm_yday else start.year + 1
        midpoint = date(year, 1, 1) + timedelta(days=composite_doy - 1)
    decoded = decode_qa(qa)
    accepted, reasons = quality_decision(raw, reliability, qa)
    pix_lat, pix_lon = _pixel_latlon(float(x_axis[ix]), float(y_axis[iy]))
    distance_km = haversine_km(site["lat"], site["lon"], pix_lat, pix_lon)
    if distance_km > MAX_PIXEL_DISTANCE_KM:
        # A guard against geolocation mistakes: the nearest valid pixel must still be this field.
        accepted = False
        reasons.append("nearest_pixel_too_far")
    box = _neighborhood_stats(grid, iy, ix, reliability)
    return NdviObservation(
        site_id=site["id"], start=start, end=end, midpoint=midpoint,
        ndvi=scale_ndvi(raw) if not is_fill(raw) else None, accepted=accepted, reject_reasons=reasons,
        raw_ndvi=raw, reliability=reliability, modland_qa=decoded["modland_qa"],
        usefulness=decoded["usefulness"], composite_doy=composite_doy, pixel_lat=pix_lat, pixel_lon=pix_lon,
        pixel_distance_km=distance_km, granule=granule_name,
        box_median=box.get("median"), box_p25=box.get("p25"), box_p75=box.get("p75"),
        box_n=box.get("n"), box_vegetated_fraction=box.get("vegetated_fraction"),
    )


def _neighborhood_stats(grid: h5py.Group, iy: int, ix: int, reliability: int | None) -> dict[str, Any]:
    """Median NDVI of usable pixels in the box around the site.

    A 500 m pixel is not a field, and for the demo sites the exact coordinate is often the town
    centre; the regional median is what the bare-field/crop check can actually use, and it is
    labelled as regional everywhere it is shown.
    """
    try:
        fields = grid["Data Fields"]
        ndvi = fields[FIELDS["ndvi"]]
        rel = fields[FIELDS["reliability"]]
        r0, r1 = max(0, iy - NEIGHBORHOOD_PIXELS), min(ndvi.shape[0], iy + NEIGHBORHOOD_PIXELS + 1)
        c0, c1 = max(0, ix - NEIGHBORHOOD_PIXELS), min(ndvi.shape[1], ix + NEIGHBORHOOD_PIXELS + 1)
        # Read the full rows once: h5py on a remote file issues one range request per row slice,
        # so 33 narrow column windows cost 33 round trips while 33 full rows cost about one.
        window = np.asarray(ndvi[r0:r1, :]).astype(int)[:, c0:c1]
        rel_window = np.asarray(rel[r0:r1, :]).astype(int)[:, c0:c1]
    except Exception:  # noqa: BLE001 - regional context is optional
        return {}
    usable = (
        (window >= VALID_RANGE[0]) & (window <= VALID_RANGE[1]) & ~np.isin(window, FILL_VALUES)
        & (np.isin(rel_window, ACCEPTED_RELIABILITY))
    )
    if not usable.any():
        return {}
    values = window[usable] * SCALE
    return {
        "median": float(np.median(values)),
        "p25": float(np.percentile(values, 25)),
        "p75": float(np.percentile(values, 75)),
        "n": int(values.size),
        "vegetated_fraction": float((values >= VEGETATED_NDVI).mean()),
    }


def extract_file(path: str | Path, sites: list[dict]) -> list[NdviObservation]:
    path = Path(path)
    with h5py.File(path, "r") as handle:
        return [extract_site(handle, site, path.name) for site in sites]


def _quality_rank(item: dict[str, Any]) -> tuple[int, float, int]:
    """Sort key for choosing between duplicate records of the same composite (lower is better).

    Distance comes before pixel reliability: a perfectly clean pixel 100 km away is not this field.
    """
    quality = item.get("quality") or {}
    reliability = quality.get("pixel_reliability")
    reliability = 50 if reliability is None or reliability < 0 else reliability
    distance = (item.get("pixel") or {}).get("distance_km")
    return (0 if item.get("accepted") else 1, 999.0 if distance is None else distance, reliability)


def dedupe_by_composite(obs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep one record per 16-day composite period.

    CMR returns every granule whose bounding box touches the point, so neighbouring SIN tiles
    (h20v05/h20v06, ...) report the same composite for the same site. Those records describe one
    observation, not several, and counting them twice would bias the medians and the timeline check;
    the best-quality copy is kept.
    """
    best: dict[str, dict[str, Any]] = {}
    for item in obs:
        key = item["start"]
        if key not in best or _quality_rank(item) < _quality_rank(best[key]):
            best[key] = item
    return [best[key] for key in sorted(best)]


def site_section(site_id: str, observations: list[NdviObservation]) -> dict[str, Any]:
    """Demo-pack section for one site."""
    records = sorted((o.to_json() for o in observations), key=lambda o: o["start"])
    obs = dedupe_by_composite(records)
    accepted = [o for o in obs if o["accepted"]]
    series = [{"start": o["start"], "end": o["end"], "ndvi": o["ndvi"]} for o in accepted]
    regional = [
        {
            "start": o["start"],
            "end": o["end"],
            "ndvi": o["neighborhood"]["median_ndvi"],
            "p25": o["neighborhood"]["p25_ndvi"],
            "p75": o["neighborhood"]["p75_ndvi"],
            "vegetated_fraction": o["neighborhood"]["vegetated_fraction"],
        }
        for o in accepted
        if o.get("neighborhood")
    ]
    values = [o["ndvi"] for o in accepted]
    return {
        "status": "pack" if accepted else "planned",
        "product": PRODUCT,
        "product_title": PRODUCT_TITLE,
        "version": VERSION,
        "short_name": PRODUCT,
        "variable": "NDVI (normalized difference vegetation index)",
        "resolution_km": RESOLUTION_KM,
        "grid": "sinusoidal (SIN) grid, 500 m",
        "compositing_period_days": 16,
        "scale_factor": SCALE,
        "units": "NDVI (dimensionless, -1..1)",
        "site_id": site_id,
        "period": {"start": obs[0]["start"], "end": obs[-1]["end"]} if obs else None,
        "observations": obs,
        "series": series,
        "regional_series": regional,
        "summary": {
            "n_composites": len(obs),
            "n_accepted": len(accepted),
            "n_records_read": len(records),
            "n_duplicate_records_dropped": len(records) - len(obs),
            "mean_ndvi": round(sum(values) / len(values), 3) if values else None,
            "min_ndvi": round(min(values), 3) if values else None,
            "max_ndvi": round(max(values), 3) if values else None,
        },
        "notes": [
            "NDVI indicates vegetation greenness and canopy condition; it is not a measurement of "
            "soil health, crop identity or soil fertility.",
            "A 500 m pixel covers about 25 hectares and mixes many small fields, so a single value "
            "is not a field measurement.",
            "16-day composites trade temporal detail for fewer cloudy/missing observations; each "
            "composite keeps its pixel reliability and VI quality bits.",
            "Overlapping sinusoidal tiles report the same composite more than once; only the "
            "best-quality record per composite period is kept (see summary.n_duplicate_records_dropped).",
            "`series` is the single pixel at the site (often the town centre); `regional_series` is "
            "the median of usable pixels in a ~15 km box and is what the timeline check uses.",
        ],
    }
