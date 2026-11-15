"""Step 7: explain uncertainty. Confidence is derived from data provenance and historical climate variance."""
from __future__ import annotations

import math
from typing import Sequence

from .filters import msg


def percentile(values: Sequence[float], p: float) -> float:
    """Empirical percentile (0..100) using linear interpolation."""
    if not values:
        return 0.0
    s = sorted(values)
    if len(s) == 1:
        return round(float(s[0]), 3)
    k = (len(s) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return round(float(s[int(k)]), 3)
    d = k - f
    return round(float(s[f] * (1.0 - d) + s[c] * d), 3)


def summarize_metric_distribution(yearly_records: list[dict[str, float]]) -> dict[str, dict[str, float]]:
    """Compute p10, p50, p90 for irrigation_mm, water_stress, salinity_stress, heat_days, total_score."""
    keys = ("irrigation_mm", "water_stress", "salinity_stress", "heat_days", "total_score")
    by_key = {k: [rec[k] for rec in yearly_records] for k in keys}
    return {
        pct: {k: percentile(by_key[k], p) for k in keys}
        for pct, p in (("p10", 10.0), ("p50", 50.0), ("p90", 90.0))
    }


def confidence(
    cand,
    climate_source: str,
    resolution_km: float | None,
    input_status: dict[str, str],
    outside_delta: bool,
    history_len: int,
    uncertainty: dict | None = None,
) -> dict:
    score = 1.0
    factors: list[dict] = []

    def hit(delta: float, key: str, **params) -> None:
        nonlocal score
        score -= delta
        factors.append(msg(key, **params))

    if climate_source == "synthetic":
        hit(0.35, "conf.synthetic_climate")
    elif resolution_km and resolution_km > 5:
        hit(0.10, "conf.coarse_resolution", km=int(resolution_km))
    if input_status.get("texture") == "estimated":
        hit(0.10, "conf.texture_by_feel")
    if input_status.get("soil_ec") == "estimated":
        hit(0.10, "conf.ec_estimated")
    if input_status.get("organic_matter") == "estimated" or input_status.get("ph") == "estimated":
        hit(0.05, "conf.soil_estimated")
    if any(c and not c.get("reviewed", False) for c in cand.crops):
        hit(0.10, "conf.unreviewed_params")
    if history_len < 3:
        hit(0.05, "conf.history_short")
    if outside_delta:
        hit(0.10, "conf.outside_delta")
    if any(s != "ok" for s in cand.soil_status):
        hit(0.05, "conf.soil_flags")

    if uncertainty:
        spread = round(uncertainty["p90"]["total_score"] - uncertainty["p10"]["total_score"], 2)
        stability = uncertainty["rank_stability"]
        if spread >= 0.20 or stability < 0.60:
            hit(0.10, "conf.high_climate_variance", spread=spread, stability=int(round(stability * 100)))

    score = max(0.05, round(score, 2))
    level = "high" if score >= 0.7 else "medium" if score >= 0.5 else "low"
    return {"level": level, "score": score, "factors": factors}
