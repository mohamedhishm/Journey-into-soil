"""Neighbourhood search for SoilGrids topsoil data around null demo sites."""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parents[1]

SOIL_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
SOIL_PROPS = ["sand", "silt", "clay", "soc", "phh2o", "bdod", "wv0033", "wv1500"]
SOIL_DEPTHS = ["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm"]

# Search order: 0.025 deg N, S, E, W, then 0.05 deg N, S, E, W, then 0.075 deg N, S, E, W
SEARCH_OFFSETS = [
    (0.025, 0.0),   # 0.025 N
    (-0.025, 0.0),  # 0.025 S
    (0.0, 0.025),   # 0.025 E
    (0.0, -0.025),  # 0.025 W
    (0.050, 0.0),   # 0.050 N
    (-0.050, 0.0),  # 0.050 S
    (0.0, 0.050),   # 0.050 E
    (0.0, -0.050),  # 0.050 W
    (0.075, 0.0),   # 0.075 N
    (-0.075, 0.0),  # 0.075 S
    (0.0, 0.075),   # 0.075 E
    (0.0, -0.075),  # 0.075 W
]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate haversine distance in kilometres between two coordinates."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)


def is_soil_complete(payload: dict[str, Any]) -> bool:
    """Check if 0-5 cm depth has non-null mean values for sand, clay, soc, and phh2o."""
    try:
        layers = payload.get("properties", {}).get("layers", [])
        found: set[str] = set()
        for layer in layers:
            name = layer.get("name")
            depths = layer.get("depths", [])
            if depths:
                mean = depths[0].get("values", {}).get("mean")
                if mean is not None:
                    found.add(name)
        return {"sand", "clay", "soc", "phh2o"}.issubset(found)
    except (KeyError, IndexError, TypeError):
        return False


def build_soilgrids_params(lat: float, lon: float) -> list[tuple[str, Any]]:
    params: list[tuple[str, Any]] = [("lon", lon), ("lat", lat)]
    params += [("property", p) for p in SOIL_PROPS]
    params += [("depth", d) for d in SOIL_DEPTHS]
    params += [("value", v) for v in ("mean", "Q0.05", "Q0.95")]
    return params


def search_nearby_soil(
    client: Any,
    site_lat: float,
    site_lon: float,
    offsets: list[tuple[float, float]] | None = None,
    logger: Any = None,
) -> tuple[dict[str, Any] | None, float, float, float]:
    """Search nearby offsets for the first point with complete 0-5 cm soil data.

    Returns: (payload, sample_lat, sample_lon, offset_km) or (None, site_lat, site_lon, 0.0)
    """
    candidate_offsets = offsets if offsets is not None else SEARCH_OFFSETS
    for d_lat, d_lon in candidate_offsets:
        s_lat = round(site_lat + d_lat, 4)
        s_lon = round(site_lon + d_lon, 4)
        dist = haversine_km(site_lat, site_lon, s_lat, s_lon)
        params = build_soilgrids_params(s_lat, s_lon)
        if logger:
            logger(f"querying ({s_lat}, {s_lon}) offset={dist}km")
        try:
            resp = client.get(SOIL_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            if is_soil_complete(data):
                if logger:
                    logger(f"found valid soil at ({s_lat}, {s_lon}) dist={dist}km")
                return data, s_lat, s_lon, dist
        except (httpx.HTTPError, OSError) as exc:
            if logger:
                logger(f"request failed: {exc}")
    return None, site_lat, site_lon, 0.0
