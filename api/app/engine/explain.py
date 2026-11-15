"""Build structured, translatable explanations: why / evidence / benefits / gaps / risks.

Every message is {"key": "...", "params": {...}}. Text lives in contracts/i18n/{en,ar}.json so both languages stay in sync.
"""
from __future__ import annotations

from .filters import msg


def _dedupe(items: list[dict]) -> list[dict]:
    seen, out = set(), []
    for m in items:
        k = (m["key"], tuple(sorted((a, str(b)) for a, b in m["params"].items())))
        if k not in seen:
            seen.add(k)
            out.append(m)
    return out


def build(cand, sid: str, archetype: str, existing, ctx, climate, input_status: dict[str, str]) -> dict:
    req = ctx.req
    crops = [c for c in cand.crops if c]
    m, em = cand.metrics, existing.metrics

    # ---- why
    why: list[dict] = []
    if sid == "existing":
        why.append(msg("why.existing_pattern"))
    else:
        why.append(msg("why.focus", priority=archetype))
    for notes in cand.rot_notes:
        for n in notes:
            if n["type"] == "why":
                why.append(msg(n["key"], **n["params"]))
    if sid != "existing":
        if em["irrigation_mm"] > 0 and m["irrigation_mm"] <= 0.95 * em["irrigation_mm"]:
            why.append(msg("why.water_vs_existing", pct=int(round(100 * (1 - m["irrigation_mm"] / em["irrigation_mm"])))))
        if em["bare_days"] - m["bare_days"] >= 10:
            why.append(msg("why.cover_vs_existing", days=em["bare_days"] - m["bare_days"]))
        salty = [c for c in crops if ctx.ece_est >= 2.0 and c["salt_thr"] >= ctx.ece_est + 1.0]
        if salty:
            why.append(msg("why.salt_ok", crop=salty[0]["id"], thr=salty[0]["salt_thr"]))
        if archetype == "income" and crops:
            best = max(crops, key=lambda c: c["income"])
            why.append(msg("why.income_class", crop=best["id"]))

    # ---- evidence (each tied to a source id from knowledge/sources.yaml)
    evidence: list[dict] = []
    for notes in cand.rot_notes:
        for n in notes:
            if n.get("ref"):
                evidence.append({"source": "guide", "key": "ev.guide_rule", "params": {"rule": n["rule"], "ref": n["ref"]}})
    evidence.append({"source": "fao56", "key": "ev.sim_irrigation", "params": {"mm": m["irrigation_mm"], "et": m["et_mm"]}})
    if climate.source == "pack":
        evidence.append({"source": "power", "key": "ev.climate_power", "params": {}})
    else:
        evidence.append({"source": "synthetic", "key": "ev.climate_synthetic", "params": {}})
    evidence.append({"source": "saxton", "key": "ev.soil_limits", "params": {"texture": req.texture}})
    for c in crops[:3]:
        evidence.append({"source": "fao_salt", "key": "ev.salt_tolerance", "params": {"crop": c["id"], "thr": c["salt_thr"]}})
    if ctx.req_history:
        evidence.append({"source": "user", "key": "ev.user_history", "params": {"n": len(ctx.req_history)}})

    # ---- benefits
    benefits: list[dict] = []
    for c in crops:
        if c["legume"]:
            benefits.append(msg("benefit.legume_n", crop=c["id"]))
        if c["root_cm"] >= 120:
            benefits.append(msg("benefit.deep_roots", crop=c["id"], cm=c["root_cm"]))
        if c["water"] == 1:
            benefits.append(msg("benefit.low_water", crop=c["id"]))
        if c["id"] == "berseem":
            benefits.append(msg("benefit.fodder", crop=c["id"]))
    if len({c["family"] for c in crops}) >= 3:
        benefits.append(msg("benefit.diversity"))
    if m["span_days"] and m["bare_days"] / m["span_days"] <= 0.12:
        benefits.append(msg("benefit.cover", pct=int(round(100 * (1 - m["bare_days"] / m["span_days"])))))

    # ---- gaps (information we do not have)
    gaps = [msg("gap.no_prices"), msg("gap.variety"), msg("gap.nitrogen_qualitative"), msg("gap.erosion_not_modelled")]
    if climate.source == "synthetic":
        gaps.insert(0, msg("gap.synthetic_climate"))
        gaps.insert(1, msg("gap.nasa_not_loaded"))
    else:
        gaps.append(msg("gap.smap_coarse"))
    if input_status.get("texture") == "estimated" or input_status.get("organic_matter") == "estimated":
        gaps.append(msg("gap.soil_estimated"))
    if input_status.get("soil_ec") == "estimated":
        gaps.append(msg("gap.salinity_unmeasured"))
    if req.pest in ("nematodes", "soil_borne", "unknown"):
        gaps.append(msg("gap.pest_diagnosis"))
    if any(not c.get("reviewed", False) for c in crops):
        gaps.append(msg("gap.crop_params_unreviewed"))

    # ---- risks needing local review
    risks: list[dict] = []
    for notes in cand.soil_notes:
        risks.extend(notes)
    for notes in cand.rot_notes:
        for n in notes:
            if n["type"] == "risk":
                risks.append(msg(n["key"], **n["params"]))
    for s, crop in zip(cand.seasons, cand.crops):
        if crop is None:
            risks.append(msg("risk.fallow_season", season=s))
    if cand.sim is not None:
        for s in cand.sim.seasons:
            if s.water_stress > 0.15:
                risks.append(msg("risk.water_stress", crop=s.crop_id, pct=int(round(100 * s.water_stress))))
            if s.salinity_stress > 0.1:
                risks.append(msg("risk.salinity_loss", crop=s.crop_id, pct=int(round(100 * s.salinity_stress))))
            if s.heat_days >= 10:
                risks.append(msg("risk.heat_days", crop=s.crop_id, days=s.heat_days))
    for crop in crops:
        if crop["id"] in ctx.pest_excluded:
            risks.append(msg("risk.pest_host", crop=crop["id"]))

    return {
        "why": _dedupe(why)[:7],
        "evidence": _dedupe(evidence),
        "benefits": _dedupe(benefits)[:7],
        "gaps": _dedupe(gaps),
        "risks": _dedupe(risks),
    }
