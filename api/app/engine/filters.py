"""Steps 2-3 of the guide's ranking logic: season, soil and water constraints, plus the hard pest rule."""
from __future__ import annotations

from .. import knowledge
from ..schemas.request import AnalysisRequest
from ..sim.salinity import relative_yield


def msg(key: str, **params) -> dict:
    return {"key": key, "params": params}


def season_ok(crop: dict, season: str) -> bool:
    return season in crop["seasons"]


def pest_excluded(crop: dict, req: AnalysisRequest) -> bool:
    hosts = knowledge.rotation_rules()["pest"]["host_families"].get(req.pest, [])
    return crop["family"] in hosts


def soil_water_status(crop: dict, req: AnalysisRequest, ece_est: float, effective_depth_cm: float | None = None) -> tuple[str, list[dict]]:
    """Return ("ok" | "risk" | "excluded", risk/exclusion messages)."""
    status = "ok"
    notes: list[dict] = []

    def bump(new: str) -> None:
        nonlocal status
        order = {"ok": 0, "risk": 1, "excluded": 2}
        if order[new] > order[status]:
            status = new

    cid = crop["id"]
    if crop.get("perennial"):
        return "excluded", [msg("risk.perennial", crop=cid)]

    tex = crop["texture"]
    if req.texture in tex.get("unsuitable", []):
        bump("excluded")
        notes.append(msg("risk.texture_unsuitable", crop=cid, texture=req.texture))
    elif req.texture in tex.get("poor", []):
        bump("risk")
        notes.append(msg("risk.texture_poor", crop=cid, texture=req.texture))

    if req.drainage == "poor" and crop.get("waterlog_sensitive"):
        bump("risk")
        notes.append(msg("risk.waterlog", crop=cid))

    depth = effective_depth_cm if effective_depth_cm is not None else req.effective_depth_cm
    if depth < 0.6 * crop["root_cm"]:
        bump("risk")
        notes.append(msg("risk.shallow_soil", crop=cid, depth=int(depth)))

    yr = relative_yield(ece_est, crop["salt_thr"], crop["salt_slope"])
    # Guide s7: use measured salinity and crop tolerance; only tolerant crops on saline fields.
    if yr < 65:
        bump("excluded")
        notes.append(msg("risk.salinity", crop=cid, yr=int(yr)))
    elif yr < 85:
        bump("risk")
        notes.append(msg("risk.salinity", crop=cid, yr=int(yr)))

    if crop["water"] == 3:
        if req.water_availability == "scarce":
            bump("excluded")
            notes.append(msg("risk.water_scarce", crop=cid))
        elif req.water_availability == "limited":
            bump("risk")
            notes.append(msg("risk.water_scarce", crop=cid))
    elif crop["water"] == 2 and req.water_availability == "scarce":
        bump("risk")
        notes.append(msg("risk.water_scarce", crop=cid))

    if cid == "rice":
        notes.append(msg("risk.rice_restricted"))
        notes.append(msg("risk.paddy_not_modeled"))
        bump("risk")
    return status, notes
