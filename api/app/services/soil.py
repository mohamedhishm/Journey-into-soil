"""Optional ISRIC SoilGrids lookup (modelled, 250 m). Never required: the app works without it and marks it lower confidence."""
from __future__ import annotations

import httpx

SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"


def parse_soilgrids(payload: dict) -> dict | None:
    """Extract topsoil (0-5 cm) sand, clay (%), organic matter (%) and pH from a SoilGrids v2 response."""
    try:
        vals: dict[str, float] = {}
        for layer in payload["properties"]["layers"]:
            factor = layer["unit_measure"].get("d_factor", 1) or 1
            mean = layer["depths"][0]["values"]["mean"]
            if mean is None:
                continue
            vals[layer["name"]] = mean / factor
        if "sand" not in vals or "clay" not in vals:
            return None
        # sand/clay are mapped in g/kg; dividing by d_factor (10) already gives % (g per 100 g)
        out = {"sand": round(vals["sand"], 1), "clay": round(vals["clay"], 1)}
        if "soc" in vals:  # g/kg organic carbon -> % organic matter (x1.724 / 10)
            out["om"] = round(vals["soc"] * 1.724 / 10.0, 2)
        if "phh2o" in vals:
            out["ph"] = round(vals["phh2o"], 1)
        return out
    except (KeyError, IndexError, TypeError):
        return None


def fetch_soilgrids(lat: float, lon: float, timeout: float = 6.0) -> dict | None:
    params = [("lon", lon), ("lat", lat), ("depth", "0-5cm"), ("value", "mean")]
    params += [("property", p) for p in ("sand", "clay", "soc", "phh2o")]
    try:
        r = httpx.get(SOILGRIDS_URL, params=params, timeout=timeout)
        r.raise_for_status()
        return parse_soilgrids(r.json())
    except (httpx.HTTPError, ValueError):
        return None
