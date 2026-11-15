"""Step 1 of the guide's ranking logic: validate inputs and flag what is measured vs estimated."""
from __future__ import annotations

from .. import knowledge
from ..schemas.request import AnalysisRequest

DELTA_BOX = {"lat": (30.0, 31.7), "lon": (29.8, 32.7)}


def infer_region(req: AnalysisRequest) -> str:
    if req.region != "auto":
        return req.region
    if DELTA_BOX["lat"][0] <= req.lat <= DELTA_BOX["lat"][1] and 30.0 <= req.lon <= DELTA_BOX["lon"][1]:
        return "delta"
    if req.lon < 30.0 and req.lat >= 29.5:
        return "new_lands"
    return "upper_egypt"


def in_delta_box(req: AnalysisRequest) -> bool:
    return DELTA_BOX["lat"][0] <= req.lat <= DELTA_BOX["lat"][1] and DELTA_BOX["lon"][0] <= req.lon <= DELTA_BOX["lon"][1]


def validate(req: AnalysisRequest) -> tuple[list[dict], dict[str, str], list[dict]]:
    """Return (flags, input_status, clean_history). Unknown crops are dropped and flagged."""
    known = knowledge.crops()
    flags: list[dict] = []
    status: dict[str, str] = {}

    history = []
    for item in req.history:
        if item.crop in known:
            history.append({"crop": item.crop, "season": item.season})
        else:
            flags.append({"field": "history", "key": "flag.unknown_crop", "severity": "warn", "params": {"crop": item.crop}})
    if len(history) < 3:
        flags.append({"field": "history", "key": "flag.history_short", "severity": "warn", "params": {"n": len(history)}})

    status["texture"] = "measured" if req.texture_confirmed else "estimated"
    if not req.texture_confirmed:
        flags.append({"field": "texture", "key": "flag.texture_by_feel", "severity": "info", "params": {}})
    status["ph"] = "measured" if req.ph is not None else "estimated"
    if req.ph is None:
        flags.append({"field": "ph", "key": "flag.ph_default", "severity": "info", "params": {}})
    status["soil_ec"] = "measured" if req.soil_ec is not None else "estimated"
    if req.soil_ec is None:
        flags.append({"field": "soil_ec", "key": "flag.ec_estimated", "severity": "warn", "params": {}})
    status["organic_matter"] = "measured" if req.organic_matter is not None else "estimated"
    status["water_ec"] = "measured" if req.water_ec_measured else "estimated"
    if req.pest == "unknown":
        flags.append({"field": "pest", "key": "flag.pest_unknown", "severity": "warn", "params": {}})
    if not in_delta_box(req):
        flags.append({"field": "location", "key": "flag.outside_delta", "severity": "warn", "params": {}})
    return flags, status, history
