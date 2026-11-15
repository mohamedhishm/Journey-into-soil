"""End-to-end analysis, following FIELD.PUA section 9:
validate -> season filter -> soil/water filter -> rotation rules -> sim-informed ranking -> explain uncertainty."""
from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta, timezone

from .. import knowledge
from ..schemas.request import AnalysisRequest
from ..services import nasa
from ..services.climate import find_pack, get_historical_climate_series, pack_path_for
from ..sim.runner import run_timeline
from ..sim.types import CropSeason, DayInput
from . import explain, filters, profile, scoring, strategies, uncertainty
from . import plan as planner
from .generator import Cand, Ctx, enumerate_candidates, existing_candidate, select_pool
from .validate import in_delta_box, infer_region, validate

SCHEMA_VERSION = "1.1.0"
MAX_DAYS = 900

NEEDS_LOCAL_REVIEW = ["review.irrigation_schedule", "review.variety", "review.pest_diagnosis", "review.market",
                      "review.soil_test"]


def request_id(req: AnalysisRequest) -> str:
    payload = req.model_dump_json() + "|" + knowledge.version_tag() + "|" + SCHEMA_VERSION
    return hashlib.sha256(payload.encode()).hexdigest()[:10]


def _schedule(cand: Cand, start: date) -> list[CropSeason]:
    out = []
    for season, crop, slot in zip(cand.seasons, cand.crops, cand.plan):
        if crop is None or slot is None:
            continue
        sow, harvest = slot
        out.append(CropSeason(crop, season, (sow - start).days, (harvest - start).days))
    return out


def _bare_periods(cand: Cand, dates: list[str]) -> list[dict]:
    tl = cand.sim
    last = max((s.harvest_idx for s in tl.seasons), default=-1)
    out, i = [], 0
    while i <= last:
        if tl.crop_idx[i] == -1:
            j = i
            while j + 1 <= last and tl.crop_idx[j + 1] == -1:
                j += 1
            out.append({"start": dates[i], "end": dates[j], "days": j - i + 1})
            i = j + 1
        else:
            i += 1
    return out


def _strategy_json(item: dict, cand: Cand, ctx: Ctx, existing: Cand, climate, input_status, dates, req, outside_delta, hist_len, uncertainty_data: dict) -> dict:
    tl = cand.sim
    weights = scoring.weights_from(req.priorities)
    scores = dict(cand.scores)
    scores["total"] = round(scoring.total(cand.scores, weights), 3)
    seasons_json = []
    sched_i = 0
    for season, crop, slot in zip(cand.seasons, cand.crops, cand.plan):
        if crop is None or slot is None:
            seasons_json.append({"season": season, "crop": None, "sow_date": None, "harvest_date": None, "indicators": None})
            continue
        s = tl.seasons[sched_i]
        sched_i += 1
        seasons_json.append({
            "season": season, "crop": crop["id"], "sow_date": slot[0].isoformat(), "harvest_date": slot[1].isoformat(),
            "indicators": {"et_mm": s.et_mm, "rain_mm": s.rain_mm, "irrigation_mm": s.irrigation_mm,
                           "drainage_mm": s.drainage_mm, "water_stress": s.water_stress,
                           "salinity_stress": s.salinity_stress, "heat_days": s.heat_days},
        })
    text = explain.build(cand, item["id"], item["archetype"], existing, ctx, climate, input_status)
    return {
        "id": item["id"], "label_key": f"strategy.{item['id']}", "archetype": item["archetype"],
        "seasons": seasons_json,
        "bare_periods": _bare_periods(cand, dates),
        "scores": scores,
        "indicators": {"irrigation_mm": cand.metrics["irrigation_mm"], "et_mm": cand.metrics["et_mm"],
                       "bare_days": cand.metrics["bare_days"], "span_days": cand.metrics["span_days"]},
        **text,
        "confidence": uncertainty.confidence(cand, climate.source, climate.resolution_km, input_status, outside_delta, hist_len, uncertainty_data),
        "uncertainty": uncertainty_data,
        "sim": {"moisture": tl.moisture, "ece": tl.ece, "root_cm": tl.root_cm, "canopy": tl.canopy, "ks": tl.ks,
                "irrigation_mm": tl.irrigation_mm, "crop_idx": tl.crop_idx},
    }


def _nasa_panel(climate, evidence: dict | None = None) -> list[dict]:
    pack_products = set(getattr(climate, "products", []))
    if climate.source == "pack" and not pack_products:
        pack_products = {"power"}
    evidence = evidence or {}
    smap_status = (evidence.get("smap") or {}).get("status", "pack" if "smap" in pack_products else "planned")
    ndvi_status = (evidence.get("ndvi") or {}).get("status", "pack" if "ndvi" in pack_products else "planned")
    has_soil = (climate.source == "pack" and bool(getattr(climate, "soil", None))) or ("soilgrids" in pack_products)
    return [
        {"id": "power", "name_key": "nasa.power", "role_key": "nasa.power_role",
         "status": "pack" if "power" in pack_products or climate.source == "pack" else ("placeholder" if climate.source == "synthetic" else "planned"),
         "resolution_km": 50},
        {"id": "gpm", "name_key": "nasa.gpm", "role_key": "nasa.gpm_role",
         "status": "pack" if "gpm" in pack_products else "planned", "resolution_km": 10},
        {"id": "smap", "name_key": "nasa.smap", "role_key": "nasa.smap_role",
         "status": smap_status, "resolution_km": 9},
        {"id": "ndvi", "name_key": "nasa.ndvi", "role_key": "nasa.ndvi_role",
         "status": ndvi_status, "resolution_km": 0.5},
        {"id": "soilgrids", "name_key": "nasa.soilgrids", "role_key": "nasa.soilgrids_role",
         "status": "pack" if has_soil else "planned", "resolution_km": 0.25},
    ]


def run(req: AnalysisRequest) -> dict:
    ref = req.reference_date or date.today()
    flags, input_status, hist = validate(req)
    pack = find_pack(req.lat, req.lon)
    pack_soil = pack.get("soil") if pack else None
    crops = knowledge.crops()
    hist_crops = [crops[h["crop"]] for h in hist]
    layers = profile.build_layers(req, soil=pack_soil)
    ece_est = profile.estimate_ece(req)
    status = {cid: filters.soil_water_status(c, req, ece_est) for cid, c in crops.items()}
    pest_ex = {cid for cid, c in crops.items() if filters.pest_excluded(c, req)}
    seasons = planner.season_sequence(req.next_season, 3)
    ctx = Ctx(req=req, ref=ref, seasons=seasons, crops=crops, history=hist_crops, req_history=hist, status=status,
              pest_excluded=pest_ex, ece_est=ece_est)

    cands = enumerate_candidates(ctx)
    existing = existing_candidate(ctx)
    if not cands:
        flags.append({"field": "engine", "key": "flag.no_feasible_rotation", "severity": "error", "params": {}})
    pool = select_pool(cands, existing) if cands else [existing]

    first = planner.first_sow(req.next_season, ref)
    start = first[0]
    # If the demo pack holds NASA observations from before the first sowing, start the simulation
    # earlier so the observation and model windows actually share days. Those leading days are
    # bare (crop_idx -1) for every strategy, so the comparison stays like-for-like.
    observed_start = nasa.earliest_observation_date(pack_path_for(req.lat, req.lon))
    if observed_start is not None and observed_start < start:
        start = observed_start
    end = start + timedelta(days=30)
    for c in pool:
        for slot in c.plan:
            if slot:
                end = max(end, slot[1])
    end = min(end + timedelta(days=1), start + timedelta(days=MAX_DAYS))
    all_dates = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    climate, hist_series, hist_years = get_historical_climate_series(
        req.lat, req.lon, all_dates, req.scenario.dT, req.scenario.dP
    )
    days = [DayInput(d, e, r, t) for d, e, r, t in zip(climate.dates, climate.et0, climate.rain, climate.tmax)]

    init_fractions = None
    mm_telemetry = None
    if getattr(req, "use_live_weather", True):
        from ..services import meteomatics
        mm_telemetry = meteomatics.get_telemetry_sync(req.lat, req.lon)
        params = mm_telemetry.get("parameters", {})
        smi_5 = params.get("soil_moisture_index_5cm")
        smi_50 = params.get("soil_moisture_index_50cm")
        smd = params.get("soil_moisture_deficit_mm")

        if smi_5 is not None and smi_50 is not None:
            f0 = max(0.05, min(1.0, float(smi_5)))
            f2 = max(0.05, min(1.0, float(smi_50)))
            f1 = max(0.05, min(1.0, 0.7 * f0 + 0.3 * f2))
            f3 = f2
            init_fractions = [f0, f1, f2, f3]

        if smd is not None and float(smd) > 50.0:
            flags.append({
                "field": "soil_moisture",
                "key": "flag.pre_sowing_deficit",
                "severity": "warn",
                "params": {"smd": round(float(smd), 1)},
            })

    sched_map = {c.key: _schedule(c, start) for c in pool}
    for c in pool:
        c.sim = run_timeline(layers, days, sched_map[c.key], req.irrigation, req.water_ec, init_fractions=init_fractions)
    scoring.score_pool(pool)

    picked = strategies.select(pool, existing, req.priorities)
    rank = strategies.existing_rank(pool, existing, req.priorities)
    outside = not in_delta_box(req)

    weights = scoring.weights_from(req.priorities)
    ranked_baseline = sorted(pool, key=lambda c: scoring.total(c.scores, weights), reverse=True)
    # Historical multi-year uncertainty: evaluate picked strategies + top contenders for rank stability under time budget
    picked_cands = [item["cand"] for item in picked]
    top_contenders = ranked_baseline[:4]
    eval_cands_dict = {c.key: c for c in picked_cands + top_contenders}
    eval_pool = list(eval_cands_dict.values())
    ranked_eval_base = sorted(eval_pool, key=lambda c: scoring.total(c.scores, weights), reverse=True)
    base_rank_map = {c.key: 1 + i for i, c in enumerate(ranked_eval_base)}

    yearly_records: dict[str, list[dict[str, float]]] = {item["id"]: [] for item in picked}
    rank_matches: dict[str, int] = {item["id"]: 0 for item in picked}

    for year_days in hist_series:
        sims_y = {}
        metrics_y = {}
        for c in eval_pool:
            sim = run_timeline(layers, year_days, sched_map[c.key], req.irrigation, req.water_ec, init_fractions=init_fractions, record_daily=False)
            sims_y[c.key] = sim
            metrics_y[c.key] = scoring.sim_metrics(c, sim)
        irr_list = [metrics_y[c.key]["irrigation_mm"] for c in eval_pool]
        ipd_list = [metrics_y[c.key]["irr_per_crop_day"] for c in eval_pool]
        stats_y = {
            "irr_min": min(irr_list),
            "irr_max": max(irr_list),
            "ipd_min": min(ipd_list),
            "ipd_max": max(ipd_list),
        }
        tot_scores_y = {}
        for c in eval_pool:
            comp_y = scoring.components(c, stats_y, metrics_y[c.key])
            tot_scores_y[c.key] = scoring.total(comp_y, weights)
        ranked_y = sorted(eval_pool, key=lambda c: tot_scores_y[c.key], reverse=True)
        year_rank_map = {c.key: 1 + i for i, c in enumerate(ranked_y)}

        for item in picked:
            sid = item["id"]
            cand = item["cand"]
            tl_y = sims_y[cand.key]
            seasons = tl_y.seasons
            n_s = max(len(seasons), 1)
            tot_irr = tl_y.totals.get("irrigation_mm", sum(s.irrigation_mm for s in seasons))
            w_stress = sum(s.water_stress for s in seasons) / n_s
            s_stress = sum(s.salinity_stress for s in seasons) / n_s
            heat_d = sum(s.heat_days for s in seasons)
            t_score = round(tot_scores_y[cand.key], 3)
            yearly_records[sid].append({
                "irrigation_mm": round(tot_irr, 1),
                "water_stress": round(w_stress, 3),
                "salinity_stress": round(s_stress, 3),
                "heat_days": heat_d,
                "total_score": t_score,
            })
            if year_rank_map[cand.key] == base_rank_map[cand.key]:
                rank_matches[sid] += 1

    uncertainty_by_id = {}
    n_years = len(hist_years)
    for item in picked:
        sid = item["id"]
        stability = round(rank_matches[sid] / n_years, 2) if n_years else 1.0
        pcts = uncertainty.summarize_metric_distribution(yearly_records[sid])
        uncertainty_by_id[sid] = {
            "rank_stability": stability,
            "years_evaluated": n_years,
            "p10": pcts["p10"],
            "p50": pcts["p50"],
            "p90": pcts["p90"],
        }

    strategies_json = [
        _strategy_json(item, item["cand"], ctx, existing, climate, input_status, climate.dates, req, outside, len(hist), uncertainty_by_id[item["id"]])
        for item in picked
    ]
    layers_json = [profile.layer_json(layer) for layer in layers]
    nasa_evidence = nasa.build(climate.pack_path, strategies_json, climate.dates, layers_json)
    if mm_telemetry:
        nasa_evidence["meteomatics"] = mm_telemetry
    disclaimers = ["disclaimer.main"] + (["disclaimer.preview_data"] if climate.source == "synthetic" else [])
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "request_id": request_id(req),
        "knowledge_version": knowledge.version_tag(),
        "input": req.model_dump(mode="json"),
        "field": {"lat": req.lat, "lon": req.lon, "area_feddan": req.area_feddan, "region": infer_region(req)},
        "flags": flags,
        "input_status": input_status,
        "nasa_data": _nasa_panel(climate, nasa_evidence),
        "nasa_evidence": nasa_evidence,
        "layers": layers_json,
        "climate": {"dates": climate.dates, "tmax": climate.tmax, "tmin": climate.tmin, "rain": climate.rain,
                    "et0": climate.et0, "source": climate.source, "pack_id": climate.pack_id,
                    "scenario": {"dT": req.scenario.dT, "dP": req.scenario.dP}},
        "timeline": {"start": climate.dates[0], "end": climate.dates[-1], "days": len(climate.dates)},
        "candidates_evaluated": len(pool),
        "existing_rank": rank,
        "strategies": strategies_json,
        "needs_local_review": NEEDS_LOCAL_REVIEW,
        "disclaimers": disclaimers,
    }
