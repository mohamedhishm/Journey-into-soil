"""Step 6: rank by the farmer's priorities. Components are 0..1 (higher is better) and fully explainable.

Income is a QUALITATIVE market-return class from the knowledge base, not a price or a profit; the gap is always reported.
"""
from __future__ import annotations

from .. import knowledge
from .generator import Cand

PRIORITIES = ("water", "soil_health", "income", "risk")


def clip(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def sim_metrics(c: Cand, tl=None) -> dict:
    tl = tl or c.sim
    seasons = tl.seasons
    last = max((s.harvest_idx for s in seasons), default=0)
    bare = sum(1 for i in range(0, last + 1) if tl.crop_idx[i] == -1)
    n = max(len(seasons), 1)
    crop_days = sum(s.days for s in seasons)
    return {
        "crop_days": crop_days,
        "irr_per_crop_day": tl.totals["irrigation_mm"] / crop_days if crop_days else 0.0,
        "irrigation_mm": tl.totals["irrigation_mm"],
        "et_mm": tl.totals["et_mm"],
        "bare_days": bare,
        "span_days": last + 1,
        "water_stress": sum(s.water_stress for s in seasons) / n,
        "salinity_stress": sum(s.salinity_stress for s in seasons) / n,
        "heat_frac": sum(s.heat_days / s.days for s in seasons if s.days) / n,
    }


def _minmax_inv(x: float, lo: float, hi: float) -> float:
    return 1.0 - (x - lo) / (hi - lo) if hi > lo else 0.5


def components(c: Cand, stats: dict[str, float], metrics: dict | None = None) -> dict[str, float]:
    m = metrics if metrics is not None else c.metrics
    # Water: half total applied water, half water per day of actual crop growth, so leaving land bare is not "saving water".
    water = 0.5 * _minmax_inv(m["irrigation_mm"], stats["irr_min"], stats["irr_max"]) + 0.5 * _minmax_inv(
        m["irr_per_crop_day"], stats["ipd_min"], stats["ipd_max"]
    )

    crops = [x for x in c.crops if x]
    div = len({x["family"] for x in crops}) / 3.0
    n_total = sum(x["n_effect"] for x in crops)
    n_score = clip((n_total + 4) / 7.0)
    cover = 1.0 - m["bare_days"] / max(m["span_days"], 1)
    penalties = 0.0
    for notes in c.rot_notes:
        for n in notes:
            if n["type"] == "risk" and n["rule"] in ("same_family_as_previous", "same_family_in_two_of_last_three", "continuous_maize"):
                penalties += {"same_family_as_previous": 25, "same_family_in_two_of_last_three": 10, "continuous_maize": 20}[n["rule"]]
    rot_ok = 1.0 - min(1.0, penalties / 50.0)
    health = clip(0.3 * div + 0.3 * n_score + 0.2 * cover + 0.2 * rot_ok)

    inc = sum(x["income"] for x in crops) / 3.0
    income = clip(inc * (1.0 - 0.5 * m["water_stress"] - 0.5 * m["salinity_stress"]))

    soil_risk = sum(1 for s in c.soil_status if s != "ok") / 3.0
    heat = clip(m["heat_frac"] / 0.3)
    risk = 1.0 - clip(0.35 * m["water_stress"] + 0.25 * m["salinity_stress"] + 0.15 * heat + 0.25 * soil_risk)
    return {"water": clip(water), "soil_health": health, "income": income, "risk": risk}


def weights_from(priorities, focus: str | None = None) -> dict[str, float]:
    w = {p: float(getattr(priorities, p)) for p in PRIORITIES}
    if sum(w.values()) <= 0:
        w = {p: 1.0 for p in PRIORITIES}
    if focus:
        w[focus] *= float(knowledge.strategies()["archetype_focus_multiplier"])
    return w


def total(comp: dict[str, float], weights: dict[str, float]) -> float:
    s = sum(weights.values())
    return sum(comp[p] * weights[p] for p in PRIORITIES) / s


def score_pool(pool: list[Cand]) -> None:
    for c in pool:
        c.metrics.update(sim_metrics(c))
    irr = [c.metrics["irrigation_mm"] for c in pool]
    ipd = [c.metrics["irr_per_crop_day"] for c in pool]
    stats = {"irr_min": min(irr), "irr_max": max(irr), "ipd_min": min(ipd), "ipd_max": max(ipd)}
    for c in pool:
        c.scores = {k: round(v, 3) for k, v in components(c, stats).items()}
