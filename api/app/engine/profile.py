"""Build the four-layer soil profile from texture class + practices. Layer names come from the data (computed texture)."""
from __future__ import annotations

from .. import knowledge
from ..schemas.request import AnalysisRequest
from ..sim.pedotransfer import texture_class
from ..sim.types import SoilLayer


def estimate_ece(req: AnalysisRequest) -> float:
    """Root-zone ECe: measured if given, else ~1.5 x irrigation-water EC (typical for 15-20% leaching, FAO-29)."""
    return req.soil_ec if req.soil_ec is not None else round(1.5 * req.water_ec, 2)


def surface_om(req: AnalysisRequest, soil_om: float | None = None) -> float:
    if req.organic_matter is not None:
        return req.organic_matter
    if soil_om is not None:
        return round(min(3.5, soil_om), 2)
    om = 1.5
    om += {"none": -0.2, "some": 0.3, "regular": 0.6}[req.organic_input]
    om += {"retained": 0.3, "burned": -0.2, "unknown": 0.0}[req.residues]
    if req.texture in ("sand", "sandy_loam"):
        om *= 0.6
    return round(max(0.4, min(3.5, om)), 2)


def build_layers(req: AnalysisRequest, soil: dict | None = None) -> list[SoilLayer]:
    soils = knowledge.soils()
    base = soils["textures"][req.texture]
    soil_om = soil.get("om") if soil else None
    soil_ph = soil.get("ph") if soil else None
    om0 = surface_om(req, soil_om)
    ece0 = estimate_ece(req)
    ph0 = req.ph if req.ph is not None else (soil_ph if soil_ph is not None else 7.9)
    status_tex = "measured" if req.texture_confirmed else "estimated"
    layers: list[SoilLayer] = []
    for i, t in enumerate(soils["layers"]):
        clay = min(70.0, max(4.0, base["clay"] + t["clay_shift"]))
        sand = min(96.0 - clay, max(2.0, base["sand"] + t["sand_shift"]))
        silt = 100.0 - clay - sand
        layers.append(
            SoilLayer(
                top_cm=t["top"], bottom_cm=t["bottom"], sand=round(sand, 1), silt=round(silt, 1), clay=round(clay, 1),
                om=round(om0 * t["om_factor"], 2), ph=round(ph0 + 0.1 * i, 2), ec=round(ece0 * (1 + 0.2 * i), 2),
                source={
                    "texture": status_tex,
                    "om": "measured" if (req.organic_matter is not None and i == 0) else "estimated",
                    "ph": "measured" if req.ph is not None else "estimated",
                    "ec": "measured" if (req.soil_ec is not None and i == 0) else "estimated",
                },
            )
        )
    return layers


def layer_json(layer: SoilLayer) -> dict:
    measured = sum(1 for v in layer.source.values() if v == "measured")
    return {
        "name_key": f"texture.{texture_class(layer.sand, layer.clay)}",
        "top_cm": layer.top_cm, "bottom_cm": layer.bottom_cm,
        "sand": layer.sand, "silt": layer.silt, "clay": layer.clay, "om": layer.om, "ph": layer.ph, "ec": layer.ec,
        "wp": round(layer.wp, 3), "fc": round(layer.fc, 3), "sat": round(layer.sat, 3),
        "source": layer.source,
        "confidence": "high" if measured >= 3 else "medium" if measured >= 1 else "low",
    }
