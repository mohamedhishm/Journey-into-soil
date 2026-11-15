"""Agricultural agent workflow.

The agent is a thin orchestration layer over the existing project components:

    farmer input -> validation (engine) -> rotation engine + simulation -> engine ranking
    -> demo-pack NASA evidence -> knowledge retrieval -> grounded explanation -> structured result

Responsibility split:
  * The **rotation engine and simulation** compute every metric, score and ranking. The agent never
    invents a number and never overrides the order the engine produced.
  * The **retriever** supplies general agricultural knowledge with citations.
  * The **demo pack / services.nasa** supplies site-specific NASA evidence.
  * The **LLM (optional)** only rephrases the facts it is given; with no key configured the
    deterministic templates below are used.
"""

from __future__ import annotations

from typing import Any

from ..db import store
from ..engine import pipeline
from ..rag import answer as rag_answer
from ..rag import retriever
from ..schemas.request import AnalysisRequest
from ..services import meteomatics
from . import llm

PRIORITIES = ("water", "soil_health", "income", "risk")
STRATEGY_WORDS = {
    "1": 0, "first": 0, "one": 0,
    "2": 1, "second": 1, "two": 1,
    "3": 2, "third": 2, "three": 2,
}


def rank_strategies(strategies: list[dict]) -> list[dict]:
    """Rank the engine's three strategies by the engine's own total score (descending)."""
    ordered = sorted(strategies, key=lambda s: (-float(s["scores"]["total"]), s["id"]))
    return [
        {
            "id": s["id"],
            "label_key": s["label_key"],
            "archetype": s["archetype"],
            "rank": index + 1,
            "total": s["scores"]["total"],
            "scores": s["scores"],
            "crops": [season["crop"] for season in s["seasons"]],
            "irrigation_mm": s["indicators"]["irrigation_mm"],
            "bare_days": s["indicators"]["bare_days"],
            "confidence": s["confidence"]["level"],
        }
        for index, s in enumerate(ordered)
    ]


def comparison_table(strategies: list[dict]) -> dict[str, dict[str, Any]]:
    """Engine metrics side by side, for the same assumptions (same climate, same field)."""
    metrics = ("irrigation_mm", "et_mm", "bare_days", "span_days")
    table: dict[str, dict[str, Any]] = {}
    for metric in metrics:
        table[metric] = {s["id"]: s["indicators"][metric] for s in strategies}
    for key in PRIORITIES + ("total",):
        table[f"score_{key}"] = {s["id"]: s["scores"][key] for s in strategies}
    return table


def missing_information(result: dict) -> list[dict]:
    """Everything the engine flagged as missing, estimated or needing local review."""
    out: list[dict] = []
    for flag in result.get("flags", []):
        out.append({"key": flag["key"], "params": flag.get("params", {}), "kind": flag.get("severity", "info")})
    for strategy in result.get("strategies", [])[:1]:
        for gap in strategy.get("gaps", []):
            out.append({"key": gap["key"], "params": gap.get("params", {}), "kind": "gap"})
    for key in result.get("needs_local_review", []):
        out.append({"key": key, "params": {}, "kind": "review"})
    seen, unique = set(), []
    for item in out:
        marker = (item["key"], tuple(sorted(item["params"].items())))
        if marker not in seen:
            seen.add(marker)
            unique.append(item)
    return unique


def _priority_question(req: AnalysisRequest) -> str:
    priority = max(PRIORITIES, key=lambda p: (getattr(req.priorities, p), -PRIORITIES.index(p)))
    return {
        "water": "irrigation water use and soil moisture",
        "soil_health": "crop rotation legumes organic matter soil health",
        "income": "crop rotation market return and risk",
        "risk": "salinity tolerance drought risk crop rotation",
    }[priority]


def _facts(result: dict, ranking: list[dict], comparison: dict, evidence: dict) -> str:
    lines = [
        "FIELD: lat %.2f lon %.2f, texture %s, irrigation %s, water availability %s, pest %s."
        % (
            result["field"]["lat"], result["field"]["lon"], result["input"]["texture"],
            result["input"]["irrigation"], result["input"]["water_availability"], result["input"]["pest"],
        ),
        "CLIMATE SOURCE: %s." % result["climate"]["source"],
        "STRATEGY RANKING (engine total score, 0-1, farmer priorities applied):",
    ]
    for item in ranking:
        lines.append(
            "  %d. %s (%s) crops=%s total=%.3f water=%.3f soil_health=%.3f income=%.3f risk=%.3f "
            "irrigation_mm=%s bare_days=%s confidence=%s"
            % (
                item["rank"], item["id"], item["archetype"], "/".join(str(c) for c in item["crops"]),
                item["total"], item["scores"]["water"], item["scores"]["soil_health"],
                item["scores"]["income"], item["scores"]["risk"],
                item["irrigation_mm"], item["bare_days"], item["confidence"],
            )
        )
    water = comparison["irrigation_mm"]
    lines.append("IRRIGATION mm by strategy: %s" % water)
    smap, ndvi = evidence.get("smap", {}), evidence.get("ndvi", {})
    if smap.get("status") == "pack":
        lines.append(
            "NASA SMAP surface soil moisture (top ~5 cm, 9 km): %s accepted observation(s); indicative only."
            % smap.get("n_accepted")
        )
    else:
        lines.append("NASA SMAP: not available for this location.")
    if ndvi.get("status") == "pack":
        summary = ndvi.get("timeline_check", {}).get("summary", {})
        lines.append(
            "NASA NDVI: %d composites, timeline check ok=%s check=%s uncertain=%s."
            % (len(ndvi.get("observations", [])), summary.get("n_ok"), summary.get("n_check"), summary.get("n_uncertain"))
        )
    else:
        lines.append("NASA NDVI: not available for this location.")
    mm = evidence.get("meteomatics", {})
    if mm and mm.get("parameters"):
        params = mm["parameters"]
        lines.append(
            "METEOMATICS TELEMETRY (NASA SRTM 90m downscaled): status=%s, temp=%.1fC, RH=%.0f%%, ET0=%.2f mm/day, "
            "surface_SMI=%.2f, root_zone_SMI=%.2f, deficit=%.1f mm."
            % (
                mm.get("status"),
                params.get("t_2m_c") or 0.0,
                params.get("relative_humidity_pct") or 0.0,
                params.get("evapotranspiration_24h_mm") or 0.0,
                params.get("soil_moisture_index_5cm") or 0.0,
                params.get("soil_moisture_index_50cm") or 0.0,
                params.get("soil_moisture_deficit_mm") or 0.0,
            )
        )
    return "\n".join(lines)


def _narrative(result: dict, ranking: list[dict], comparison: dict, evidence: dict) -> dict:
    """Deterministic explanation in i18n message form; the LLM may add prose on top."""
    sentences: list[dict] = [{"key": "agent.ranking", "params": {
        "s1": round(ranking[0]["total"] * 100),
        "s2": round(ranking[1]["total"] * 100),
        "s3": round(ranking[2]["total"] * 100),
    }}]
    rank_existing = next((item["rank"] for item in ranking if item["id"] == "existing"), None)
    if rank_existing:
        sentences.append({"key": "agent.existing_position", "params": {
            "rank": rank_existing, "n": len(ranking)}})
    water = comparison["irrigation_mm"]
    values = [v for v in water.values() if v is not None]
    if values:
        sentences.append({"key": "agent.water_range", "params": {
            "min": min(values), "max": max(values), "existing": water.get("existing", 0)}})
    smap, ndvi = evidence.get("smap", {}), evidence.get("ndvi", {})
    if smap.get("status") == "pack":
        sentences.append({"key": "agent.evidence_smap", "params": {"n": smap.get("n_accepted", 0)}})
    if ndvi.get("status") == "pack":
        summary = ndvi.get("timeline_check", {}).get("summary", {})
        sentences.append({"key": "agent.evidence_ndvi", "params": {
            "n": len(ndvi.get("observations", [])), "ok": summary.get("n_ok", 0),
            "checked": summary.get("n_ok", 0) + summary.get("n_check", 0)}})
    gaps = missing_information(result)
    if gaps:
        sentences.append({"key": "agent.missing_information", "params": {"n": len(gaps)}})
    if result["climate"]["source"] == "synthetic":
        sentences.append({"key": "gap.synthetic_climate", "params": {}})
    sentences.append({"key": "agent.scores_relative", "params": {}})
    sentences.append({"key": "disclaimer.support_not_replace", "params": {}})
    return {
        "sentences": sentences,
        "text": " ".join(f"[{s['key']}]" for s in sentences),
        "generated_by": "template",
    }


def recommend(farmer: AnalysisRequest, question: str | None = None, lang: str = "en") -> dict:
    """Run the full agent workflow for one farmer profile."""
    result = pipeline.run(farmer)
    store.save(result["request_id"], farmer.model_dump(mode="json"), result)
    ranking = rank_strategies(result["strategies"])
    comparison = comparison_table(result["strategies"])
    evidence = dict(result.get("nasa_evidence", {}))
    evidence["meteomatics"] = meteomatics.get_telemetry_sync(farmer.lat, farmer.lon)
    hits = retriever.search(question or _priority_question(farmer), k=5)
    knowledge = {
        "passages": [h.to_json() for h in hits],
        "grounded": retriever.is_grounded(hits),
        "citations": [
            {"source": source, "passage_id": hit.passage.id}
            for hit in hits[:2]
            for source in hit.passage.sources
        ],
    }
    narrative = _narrative(result, ranking, comparison, evidence)
    facts = _facts(result, ranking, comparison, evidence)
    if llm.available():
        reply = llm.explain(facts, question or "Explain the ranking and what to check locally.", lang=lang)
        narrative["llm"] = reply
        if reply["text"]:
            narrative["text"] = reply["text"]
            narrative["generated_by"] = "llm"
    return {
        "request_id": result["request_id"],
        "schema_version": result["schema_version"],
        "analysis": result,
        "ranking": ranking,
        "comparison": comparison,
        "narrative": narrative,
        "knowledge": knowledge,
        "missing_information": missing_information(result),
        "assumptions": {
            "climate_source": result["climate"]["source"],
            "sampling": "all strategies share the same field, climate series and simulation settings",
            "ranking_owner": "rotation engine (weighted 0-1 components); the agent only explains it",
        },
        "disclaimer": "disclaimer.main",
    }


def _ordinal(question: str) -> int | None:
    lowered = question.lower()
    for word, index in STRATEGY_WORDS.items():
        if f"strategy {word}" in lowered:
            return index
    for word, index in STRATEGY_WORDS.items():
        if lowered.strip().startswith(f"why {word}") or f" {word} " in f" {lowered} " and word in ("second", "third", "first"):
            return index
    return None


def _site_answer(result: dict, index: int | None, question: str) -> dict:
    strategies = result["strategies"]
    ranking = rank_strategies(strategies)
    comparison = comparison_table(strategies)
    target = strategies[index] if index is not None and index < len(strategies) else strategies[0]
    rank = next(item["rank"] for item in ranking if item["id"] == target["id"])
    crops = [season["crop"] for season in target["seasons"]]
    reasons = [f"[{m['key']}]" for m in target["why"][:3]]
    benefits = [f"[{m['key']}]" for m in target["benefits"][:2]]
    risks = [f"[{m['key']}]" for m in target["risks"][:2]]
    water = comparison["irrigation_mm"]
    base = water.get("existing") or 0
    delta = ""
    if base and water.get(target["id"]) is not None:
        pct = round(100 * (water[target["id"]] / base - 1))
        delta = f"Its simulated irrigation is {abs(pct)}% {'more' if pct > 0 else 'less'} than your existing rotation."
    text = (
        f"Strategy {index + 1 if index is not None else 1} ({target['label_key']}) is rank {rank} of "
        f"{len(strategies)} for your priorities, with an engine total score of {target['scores']['total']:.2f}. "
        f"It plans {' / '.join(str(c) for c in crops)}. "
        f"Why: {' '.join(reasons)}. "
        + (f"Benefits: {' '.join(benefits)}. " if benefits else "")
        + (f"Risks to check: {' '.join(risks)}. " if risks else "")
        + delta
    )
    citations = [{"source": item["source"], "key": item["key"]} for item in target.get("evidence", [])]
    site_evidence = dict(result.get("nasa_evidence", {}))
    site_evidence["meteomatics"] = meteomatics.get_telemetry_sync(result["field"]["lat"], result["field"]["lon"])
    return {
        "grounded": True,
        "scope": "site_specific",
        "answer": {"text": text, "sentences": [], "generated_by": "engine-derived"},
        "citations": citations,
        "evidence": {
            "strategy_id": target["id"],
            "rank": rank,
            "total": target["scores"]["total"],
            "scores": target["scores"],
            "irrigation_mm": comparison["irrigation_mm"],
            "nasa_evidence": site_evidence,
        },
        "passages": [],
        "notes": ["rag.general_not_site"],
    }


SITE_HINTS = ("strategy", "this farm", "my farm", "my field", "this field", "rotation for", "recommend")


def ask(question: str, farmer: AnalysisRequest | None = None, analysis_id: str | None = None, lang: str = "en") -> dict:
    """Answer a question: site-specific when farm context exists, otherwise grounded knowledge."""
    result = None
    if analysis_id:
        found = store.load(analysis_id)
        result = found[1] if found else None
    if result is None and farmer is not None:
        result = pipeline.run(farmer)
        store.save(result["request_id"], farmer.model_dump(mode="json"), result)

    site_question = any(hint in question.lower() for hint in SITE_HINTS)
    if result is not None and site_question:
        answer = _site_answer(result, _ordinal(question), question)
        hits = retriever.search(question, k=3)
        answer["knowledge"] = {"passages": [h.to_json() for h in hits], "grounded": retriever.is_grounded(hits)}
        return {"question": question, "request_id": result["request_id"], **answer}

    general = rag_answer.ask(question)
    if result is not None and general["scope"] == "insufficient":
        general["notes"].append("rag.site_context_available")
    if llm.available() and general["grounded"]:
        facts = "\n".join(f"[{p['id']}] {p['text']}" for p in general["passages"])
        reply = llm.explain(facts, question, lang=lang)
        general["llm"] = reply
        if reply["text"]:
            general["answer"]["text"] = reply["text"]
            general["answer"]["generated_by"] = "llm"
    return {"question": question, **general}
