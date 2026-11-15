from __future__ import annotations

import time
from collections import defaultdict, deque
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ... import knowledge
from ...agent import workflow as agent
from ...db import store
from ...engine import pipeline
from ...engine.validate import in_delta_box, infer_region
from ...rag import retriever
from ...schemas.request import AnalysisRequest, Scenario
from ...services import climate as climate_service
from ...services import meteomatics as meteomatics_service
from ...services.soil import fetch_soilgrids

router = APIRouter()

_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(request: Request, limit: int = 40, window_s: int = 60) -> None:
    """Per-IP sliding window. In-memory, good enough for a single-container demo."""
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > window_s:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many analyses, wait a moment.")
    q.append(now)


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "schema_version": pipeline.SCHEMA_VERSION, "knowledge_version": knowledge.version_tag()}


@router.get("/crops")
def list_crops() -> list[dict]:
    keys = ("id", "name_en", "name_ar", "family", "seasons", "legume", "water", "root_cm", "perennial", "reviewed")
    return [{k: c.get(k) for k in keys} for c in knowledge.crops().values()]


@router.get("/knowledge/sources")
def list_sources() -> dict:
    return knowledge.sources()


@router.get("/demo-sites")
def list_demo_sites() -> list[dict]:
    return knowledge.demo_sites()


@router.post("/analyses", dependencies=[Depends(rate_limit)])
def create_analysis(req: AnalysisRequest) -> dict:
    result = pipeline.run(req)
    store.save(result["request_id"], req.model_dump(mode="json"), result)
    return result


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: str) -> dict:
    found = store.load(analysis_id)
    if not found:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return found[1]


@router.post("/analyses/{analysis_id}/scenario", dependencies=[Depends(rate_limit)])
def apply_scenario(analysis_id: str, scenario: Scenario) -> dict:
    """Re-run a saved analysis with a temperature/rainfall offset. Sensitivity exploration, not a forecast."""
    found = store.load(analysis_id)
    if not found:
        raise HTTPException(status_code=404, detail="Analysis not found")
    req = AnalysisRequest.model_validate(found[0])
    req.scenario = scenario
    result = pipeline.run(req)
    store.save(result["request_id"], req.model_dump(mode="json"), result)
    return result


@router.post("/agent/recommend", dependencies=[Depends(rate_limit)])
def agent_recommend(farmer: AnalysisRequest, question: str | None = Query(None), lang: str = Query("en")) -> dict:
    """Agent workflow: farmer input -> engine -> NASA evidence -> RAG -> grounded explanation."""
    return agent.recommend(farmer, question=question, lang=lang)


@router.post("/agent/ask", dependencies=[Depends(rate_limit)])
def agent_ask(payload: dict) -> dict:
    """Ask a question. Pass `farmer` (or `analysis_id`) for site-specific answers."""
    question = str(payload.get("question", "")).strip()
    if not question:
        raise HTTPException(status_code=422, detail="A question is required")
    farmer = AnalysisRequest.model_validate(payload["farmer"]) if payload.get("farmer") else None
    analysis_id = payload.get("analysis_id")
    if analysis_id and not store.load(analysis_id):
        raise HTTPException(status_code=404, detail="Analysis not found")
    return agent.ask(question, farmer=farmer, analysis_id=analysis_id, lang=str(payload.get("lang", "en")))


@router.get("/knowledge/search")
def knowledge_search(q: str = Query(..., min_length=2), k: int = Query(5, ge=1, le=20)) -> dict:
    """Retrieve passages from the bundled agricultural knowledge base, with citations."""
    hits = retriever.search(q, k=k)
    return {"query": q, "grounded": retriever.is_grounded(hits), "passages": [h.to_json() for h in hits]}


@router.get("/geo/lookup")
def geo_lookup(lat: float = Query(..., ge=22, le=32), lon: float = Query(..., ge=24, le=37), soilgrids: bool = False) -> dict:
    """Quick facts for a map click: region, which data would be used, a one-year climate summary."""
    probe = AnalysisRequest(lat=lat, lon=lon)
    start = date.today()
    dates = [start + timedelta(days=i) for i in range(365)]
    c = climate_service.get_climate(lat, lon, dates)
    out = {
        "lat": lat, "lon": lon, "region": infer_region(probe), "in_delta_area": in_delta_box(probe),
        "climate": {
            "source": c.source, "pack_id": c.pack_id, "resolution_km": c.resolution_km,
            "mean_tmax": round(sum(c.tmax) / len(c.tmax), 1), "mean_tmin": round(sum(c.tmin) / len(c.tmin), 1),
            "annual_rain_mm": round(sum(c.rain), 1), "annual_et0_mm": round(sum(c.et0), 0),
        },
        "soilgrids": None,
    }
    if soilgrids:
        out["soilgrids"] = fetch_soilgrids(lat, lon)
    return out


@router.get("/telemetry/meteomatics")
async def get_meteomatics_telemetry(lat: float = Query(..., ge=22, le=32), lon: float = Query(..., ge=24, le=37)) -> dict:
    """Fetch high-resolution downscaled meteorological and multi-depth soil moisture data from Meteomatics."""
    return await meteomatics_service.fetch_telemetry(lat, lon)
