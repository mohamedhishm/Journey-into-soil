"""SMAP enhanced L3 soil moisture (SPL3SMP_E v006) extraction.

Authoritative facts used here (NSIDC, SPL3SMP_E Version 6 User Guide, verified 2026-11-13):
  * The product reports **surface soil moisture only** (approximately the top 5 cm) on the
    global 9 km EASE-Grid 2.0. It contains NO root-zone soil-moisture variable; root-zone
    estimates exist only in the model-derived Level 4 products (e.g. SPL4SMGP).
  * Units are cm3/cm3 (m3/m3); fill value -9999; documented valid range 0.02..0.5.
  * `retrieval_qual_flag` bit 0 = recommended quality (0 = recommended, 1 = not),
    bit 1 = retrieval attempted (0 = attempted, 1 = skipped),
    bit 2 = retrieval successful (0 = successful, 1 = failed), bit 3 = freeze/thaw success.
    NSIDC: values 0 or 8 indicate high-quality retrievals.
  * `surface_flag` bits (9 km) name ambient conditions (water, urban, precipitation, snow,
    frozen ground, dense vegetation, ...).

Only real granules are read; nothing is invented. Every observation keeps its grid cell,
quality bits and reject reasons so the API can show gaps and limitations honestly.

Reading strategy: the 1624x3856 grid is fixed and stored one row per chunk, and the
latitude arrays are constant along a row while longitude is constant down a column.
A single reference row therefore defines the whole EASE-Grid 2.0 mapping, which lets both
local files and remote HTTPS granules be sampled with a handful of small reads.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import h5py
import numpy as np

PRODUCT = "SPL3SMP_E"
PRODUCT_TITLE = "SMAP Enhanced L3 Radiometer Global Daily 9 km EASE-Grid Soil Moisture"
VERSION = "006"
DOI = "10.5067/M20OXIZHY3RJ"
RESOLUTION_KM = 9.0
FILL = -9999.0
QFILL = 65534
VALID_MIN, VALID_MAX = 0.02, 0.5

# EASE-Grid 2.0 global: spherical earth, standard parallel +-30 deg, 9 km cells.
R_EARTH = 6378137.0
STD_PARALLEL = 30.0
PIXEL_M = 9000.0
COS_STD = np.cos(np.radians(STD_PARALLEL))
# Cylindrical equal-area with standard parallel +-30 deg: y = R sin(lat) / cos(30),
# x = R cos(30) lon. Rows/columns are uniform in those projected metres.
R_ROW = R_EARTH / PIXEL_M  # y is already normalised by cos(30) in row_of()
R_COL = R_EARTH * COS_STD / PIXEL_M

SURFACE_FLAGS = (
    "9_km_static_water_body",
    "9_km_radar_water_body_detection",
    "9_km_coastal_proximity",
    "9_km_urban_area",
    "9_km_precipitation",
    "9_km_snow_or_ice",
    "9_km_permanent_snow_or_ice",
    "9_km_radiometer_frozen_ground",
    "9_km_model_frozen_ground",
    "9_km_mountainous_terrain",
    "9_km_dense_vegetation",
    "9_km_nadir_region",
)

# Dataset names per overpass. PM carries the dual-channel-algorithm (DCA) fields.
FIELDS = {
    "AM": {
        "lat": "latitude",
        "lon": "longitude",
        "sm": "soil_moisture",
        "err": "soil_moisture_error",
        "qf": "retrieval_qual_flag",
        "surface": "surface_flag",
        "status": "grid_surface_status",
        "time": "tb_time_utc",
        "veg": "vegetation_opacity",
    },
    "PM": {
        "lat": "latitude_pm",
        "lon": "longitude_pm",
        "sm": "soil_moisture_dca_pm",
        "err": "soil_moisture_error_pm",
        "qf": "retrieval_qual_flag_dca_pm",
        "surface": "surface_flag_pm",
        "status": "grid_surface_status_pm",
        "time": "tb_time_utc_pm",
        "veg": "vegetation_opacity_dca_pm",
    },
}


@dataclass
class SmapObservation:
    """One 9 km grid-cell soil-moisture retrieval associated with a demo site."""

    site_id: str
    overpass: str  # "AM" (descending, ~06:00 local solar) or "PM" (ascending)
    date: date
    time_utc: str
    soil_moisture: float | None  # m3/m3, None when the pixel holds no retrieval
    uncertainty: float | None
    quality_flag: int | None
    accepted: bool
    reject_reasons: list[str] = field(default_factory=list)
    surface_conditions: list[str] = field(default_factory=list)
    pixel_lat: float | None = None
    pixel_lon: float | None = None
    pixel_distance_km: float | None = None
    vegetation_opacity: float | None = None
    granule: str = ""

    def to_json(self) -> dict[str, Any]:
        return {
            "site_id": self.site_id,
            "date": self.date.isoformat(),
            "overpass": self.overpass,
            "time_utc": self.time_utc or None,
            "soil_moisture_m3m3": None if self.soil_moisture is None else round(self.soil_moisture, 4),
            "uncertainty_m3m3": None if self.uncertainty is None else round(self.uncertainty, 4),
            "accepted": self.accepted,
            "reject_reasons": self.reject_reasons,
            "quality": {
                "retrieval_qual_flag": self.quality_flag,
                "recommended": None if self.quality_flag is None else not bool(self.quality_flag & 1),
                "attempted": None if self.quality_flag is None else not bool(self.quality_flag & 2),
                "successful": None if self.quality_flag is None else not bool(self.quality_flag & 4),
                "surface_conditions": self.surface_conditions,
            },
            "pixel": {
                "lat": None if self.pixel_lat is None else round(self.pixel_lat, 4),
                "lon": None if self.pixel_lon is None else round(self.pixel_lon, 4),
                "distance_km": None if self.pixel_distance_km is None else round(self.pixel_distance_km, 1),
            },
            "vegetation_opacity": None if self.vegetation_opacity is None else round(self.vegetation_opacity, 4),
            "granule": self.granule,
        }


# --------------------------------------------------------------------------------------
# pure helpers (unit tested)
# --------------------------------------------------------------------------------------


def parse_quality(flag: int | None) -> dict[str, bool | None]:
    """Decode retrieval_qual_flag using the documented bit meanings (0 = good)."""
    if flag is None:
        return {"recommended": None, "attempted": None, "successful": None}
    return {
        "recommended": not bool(flag & 1),
        "attempted": not bool(flag & 2),
        "successful": not bool(flag & 4),
    }


def surface_conditions(flag: int | None) -> list[str]:
    """Names of the surface_flag conditions set for a cell (empty when unknown/fill)."""
    if flag is None or flag == QFILL:
        return []
    return [name for bit, name in enumerate(SURFACE_FLAGS) if flag & (1 << bit)]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp, dl = p2 - p1, np.radians(lon2 - lon1)
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return float(2 * r * np.arcsin(np.sqrt(a)))


def nearest_grid_index(lat_grid: np.ndarray, lon_grid: np.ndarray, lat: float, lon: float) -> tuple[int, int] | None:
    """Index of the grid cell closest to (lat, lon) using the full lat/lon arrays."""
    valid = np.isfinite(lat_grid) & np.isfinite(lon_grid) & (lat_grid > -90) & (lat_grid < 90)
    if not valid.any():
        return None
    dlat = (lat_grid - lat) ** 2
    dlon = ((lon_grid - lon) * np.cos(np.radians(lat))) ** 2
    dist = np.where(valid, dlat + dlon, np.inf)
    iy, ix = np.unravel_index(int(np.argmin(dist)), dist.shape)
    return int(iy), int(ix)


@dataclass
class EaseGrid:
    """EASE-Grid 2.0 global 9 km mapping calibrated on one reference row of the granule."""

    row_ref: int
    col_ref: int
    lat_ref: float
    lon_ref: float

    def row_of(self, lat: float) -> int:
        y = np.sin(np.radians(lat)) / COS_STD
        y_ref = np.sin(np.radians(self.lat_ref)) / COS_STD
        return int(round(self.row_ref - (y - y_ref) * R_ROW))

    def col_of(self, lon: float) -> int:
        delta = np.radians(lon) - np.radians(self.lon_ref)
        return int(round(self.col_ref + delta * R_COL))


def ease_grid_from_row(lat_row: np.ndarray, lon_row: np.ndarray, row_index: int) -> EaseGrid | None:
    """Calibrate the grid mapping from one row of latitude/longitude arrays (pure function)."""
    valid = np.isfinite(lat_row) & (lat_row != FILL) & np.isfinite(lon_row) & (lon_row != FILL)
    if not valid.any():
        return None
    col = int(np.flatnonzero(valid)[len(np.flatnonzero(valid)) // 2])
    return EaseGrid(row_ref=row_index, col_ref=col, lat_ref=float(lat_row[col]), lon_ref=float(lon_row[col]))


# --------------------------------------------------------------------------------------
# extraction
# --------------------------------------------------------------------------------------


def _decode(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace").strip().strip("\x00").strip()
    return str(value).strip().strip("\x00").strip()


def granule_date(path_or_name: str | Path) -> date:
    """SMAP_L3_SM_P_E_YYYYMMDD_Rxxxxx_00N[.h5] -> acquisition date."""
    name = Path(str(path_or_name)).stem.split("_1MM")[0]
    for part in name.split("_"):
        if len(part) == 8 and part.isdigit():
            return date(int(part[:4]), int(part[4:6]), int(part[6:8]))
    raise ValueError(f"cannot read acquisition date from {path_or_name}")


def _open(handle: h5py.File, overpass: str) -> h5py.Group | None:
    name = f"Soil_Moisture_Retrieval_Data_{overpass}"
    return handle[name] if name in handle else None


def reference_grid(handle: h5py.File, overpass: str, candidate_rows: tuple[int, ...] = (392, 812, 700, 1000, 400, 1200)) -> EaseGrid | None:
    """Read a single row (one HDF5 chunk) and calibrate the grid mapping."""
    fields = FIELDS[overpass]
    group = _open(handle, overpass)
    if group is None or fields["lat"] not in group or fields["lon"] not in group:
        return None
    for row in candidate_rows:
        lat_row = np.asarray(group[fields["lat"]][row, :])
        lon_row = np.asarray(group[fields["lon"]][row, :])
        grid = ease_grid_from_row(lat_row, lon_row, row)
        if grid is not None:
            return grid
    return None


def extract_site(handle: h5py.File, site: dict, granule_name: str, grid_am: EaseGrid | None = None) -> list[SmapObservation]:
    """AM and PM observations for the 9 km cell(s) closest to one demo site."""
    obs: list[SmapObservation] = []
    day = granule_date(granule_name)
    for overpass in ("AM", "PM"):
        group = _open(handle, overpass)
        if group is None:
            continue
        fields = FIELDS[overpass]
        grid = grid_am if (overpass == "AM" and grid_am) else reference_grid(handle, overpass)
        if grid is None:
            obs.append(
                SmapObservation(
                    site_id=site["id"], overpass=overpass, date=day, time_utc="", soil_moisture=None,
                    uncertainty=None, quality_flag=None, accepted=False, reject_reasons=["no_grid_reference"],
                    granule=granule_name,
                )
            )
            continue
        row, col = grid.row_of(site["lat"]), grid.col_of(site["lon"])
        chosen: tuple[int, int] | None = None
        for pad_rows, pad_cols in ((0, 0), (0, 1), (1, 1)):
            sm_all = group[fields["sm"]]
            y0, y1 = max(0, row - pad_rows), min(sm_all.shape[0], row + pad_rows + 1)
            x0, x1 = max(0, col - pad_cols), min(sm_all.shape[1], col + pad_cols + 1)
            sm_win = np.asarray(sm_all[y0:y1, x0:x1])
            candidate = np.isfinite(sm_win) & (sm_win != FILL) & (sm_win >= VALID_MIN) & (sm_win <= VALID_MAX)
            if candidate.any():
                yy, xx = np.nonzero(candidate)
                dist = np.sqrt((yy + y0 - row) ** 2 + (xx + x0 - col) ** 2)
                best = int(np.argmin(dist))
                chosen = (y0 + int(yy[best]), x0 + int(xx[best]))
                break
        if chosen is None:
            obs.append(
                SmapObservation(
                    site_id=site["id"], overpass=overpass, date=day, time_utc="", soil_moisture=None,
                    uncertainty=None, quality_flag=None, accepted=False, reject_reasons=["no_retrieval_near_site"],
                    granule=granule_name,
                )
            )
            continue

        iy, ix = chosen
        lat_val = float(np.asarray(group[fields["lat"]][iy, ix]))
        lon_val = float(np.asarray(group[fields["lon"]][iy, ix]))
        qf = np.asarray(group[fields["qf"]][iy, ix])
        qflag = int(qf) if np.isfinite(qf) and int(qf) != QFILL else None
        quality = parse_quality(qflag)
        sflag = np.asarray(group[fields["surface"]][iy, ix]) if fields["surface"] in group else None
        sflags = surface_conditions(int(sflag)) if sflag is not None and np.isfinite(sflag) else []
        status = np.asarray(group[fields["status"]][iy, ix]) if fields["status"] in group else None
        land = None if status is None or not np.isfinite(status) else int(status) == 0
        value = float(np.asarray(group[fields["sm"]][iy, ix]))
        err_raw = float(np.asarray(group[fields["err"]][iy, ix])) if fields["err"] in group else None
        error = None if err_raw is None or err_raw == FILL or not np.isfinite(err_raw) else err_raw
        veg_raw = float(np.asarray(group[fields["veg"]][iy, ix])) if fields["veg"] in group else None
        veg = None if veg_raw in (None, FILL) or (veg_raw is not None and not np.isfinite(veg_raw)) else veg_raw
        obs_time = _decode(np.asarray(group[fields["time"]][iy, ix])) if fields["time"] in group else ""

        reasons: list[str] = []
        if quality["recommended"] is False:
            reasons.append("not_recommended_quality")
        if quality["attempted"] is False:
            reasons.append("retrieval_skipped")
        if quality["successful"] is False:
            reasons.append("retrieval_failed")
        if land is False:
            reasons.append("water_cell")

        obs.append(
            SmapObservation(
                site_id=site["id"], overpass=overpass, date=day, time_utc=obs_time,
                soil_moisture=value, uncertainty=error, quality_flag=qflag, accepted=not reasons,
                reject_reasons=reasons, surface_conditions=sflags, pixel_lat=lat_val, pixel_lon=lon_val,
                pixel_distance_km=haversine_km(site["lat"], site["lon"], lat_val, lon_val),
                vegetation_opacity=veg, granule=granule_name,
            )
        )
    return obs


def extract_file(path: str | Path, sites: list[dict]) -> list[SmapObservation]:
    """Extract all sites from one local granule file."""
    path = Path(path)
    out: list[SmapObservation] = []
    with h5py.File(path, "r") as handle:
        grid_am = reference_grid(handle, "AM")
        for site in sites:
            out.extend(extract_site(handle, site, path.name, grid_am))
    return out


# --------------------------------------------------------------------------------------
# serialization helpers used by the demo-pack builder
# --------------------------------------------------------------------------------------


def daily_values(observations: list[dict]) -> list[dict]:
    """Average accepted AM/PM retrievals per day so they can be compared with a daily model."""
    by_day: dict[str, list[dict]] = {}
    for obs in observations:
        if obs.get("accepted") and obs.get("soil_moisture_m3m3") is not None:
            by_day.setdefault(obs["date"], []).append(obs)
    days = []
    for day in sorted(by_day):
        items = by_day[day]
        values = [i["soil_moisture_m3m3"] for i in items]
        errors = [i["uncertainty_m3m3"] for i in items if i["uncertainty_m3m3"] is not None]
        days.append(
            {
                "date": day,
                "soil_moisture_m3m3": round(sum(values) / len(values), 4),
                "n_overpasses": len(values),
                "overpasses": [i["overpass"] for i in items],
                "uncertainty_m3m3": round(sum(errors) / len(errors), 4) if errors else None,
            }
        )
    return days


def site_section(site_id: str, observations: list[SmapObservation]) -> dict[str, Any]:
    """Demo-pack section for one site: real observations, gaps and limitations preserved."""
    obs_json = [o.to_json() for o in observations]
    obs_json.sort(key=lambda o: (o["date"], 0 if o["overpass"] == "AM" else 1))
    accepted = [o for o in obs_json if o["accepted"]]
    days = daily_values(obs_json)
    values = [d["soil_moisture_m3m3"] for d in days]
    return {
        "status": "pack" if accepted else "planned",
        "product": PRODUCT,
        "product_title": PRODUCT_TITLE,
        "version": VERSION,
        "doi": DOI,
        "variable": "soil_moisture (passive radiometer retrieval)",
        "depth": "surface, approximately the top 5 cm",
        "depth_cm": [0, 5],
        "root_zone_available": False,
        "units": "m3/m3",
        "resolution_km": RESOLUTION_KM,
        "grid": "global 9 km EASE-Grid 2.0",
        "site_id": site_id,
        "period": {"start": obs_json[0]["date"], "end": obs_json[-1]["date"]} if obs_json else None,
        "observations": obs_json,
        "daily": days,
        "summary": {
            "n_observations": len(obs_json),
            "n_accepted": len(accepted),
            "n_days_with_data": len(days),
            "mean_m3m3": round(sum(values) / len(values), 4) if values else None,
            "min_m3m3": round(min(values), 4) if values else None,
            "max_m3m3": round(max(values), 4) if values else None,
        },
        "notes": [
            "SMAP L3 enhanced measures SURFACE soil moisture (top ~5 cm) only; it contains no "
            "root-zone soil moisture. Root-zone values would require a model-derived Level 4 product.",
            "Each 9 km cell mixes many fields, roads, channels and urban patches: treat every value "
            "as a regional indication, not a field measurement.",
            "Only retrievals flagged recommended quality (retrieval_qual_flag 0 or 8) and located on "
            "land are accepted; rejected observations are kept with their reason codes.",
        ],
    }
