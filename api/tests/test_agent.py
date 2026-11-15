"""Agent workflow and RAG tests, covering the six required RAG questions."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app import knowledge
from app.agent import workflow
from app.config import ROOT
from app.main import app
from app.schemas.request import AnalysisRequest

client = TestClient(app)
BODY = {"reference_date": "2026-11-01"}
EN = json.loads((ROOT / "contracts/i18n/en.json").read_text(encoding="utf-8"))
AR = json.loads((ROOT / "contracts/i18n/ar.json").read_text(encoding="utf-8"))


def test_agent_recommend_ranks_with_the_engine_and_keeps_three_strategies():
    response = client.post("/api/v1/agent/recommend", json=BODY)
    assert response.status_code == 200
    body = response.json()
    assert len(body["analysis"]["strategies"]) == 3
    assert len(body["ranking"]) == 3
    totals = [item["total"] for item in body["ranking"]]
    assert totals == sorted(totals, reverse=True)
    assert [item["rank"] for item in body["ranking"]] == [1, 2, 3]
    # the ranking must equal the engine's own scores, not a model-invented order
    engine = {s["id"]: s["scores"]["total"] for s in body["analysis"]["strategies"]}
    assert all(engine[item["id"]] == item["total"] for item in body["ranking"])
    assert body["assumptions"]["ranking_owner"].startswith("rotation engine")
    assert body["analysis"]["nasa_evidence"]["smap"]["status"] in ("pack", "planned")


def test_agent_narrative_keys_exist_in_both_languages():
    body = client.post("/api/v1/agent/recommend", json=BODY).json()
    keys = [s["key"] for s in body["narrative"]["sentences"]]
    assert keys
    for key in keys:
        assert key in EN, key
        assert key in AR, key


def test_missing_information_is_reported():
    body = client.post("/api/v1/agent/recommend", json=BODY).json()
    assert body["missing_information"]
    assert all({"key", "params", "kind"} <= set(item) for item in body["missing_information"])


@pytest.mark.parametrize(
    "question,expected_source",
    [
        ("What is crop rotation?", "sare_rotation"),
        ("How do legumes improve soil?", "sare_cover_crops"),
        ("What is NDVI?", "nasa_ndvi_eo"),
        ("Why is soil moisture important?", "fao56"),
    ],
)
def test_rag_answers_are_grounded_with_real_citations(question, expected_source):
    response = client.post("/api/v1/agent/ask", json={"question": question})
    assert response.status_code == 200
    body = response.json()
    assert body["grounded"] is True
    assert body["answer"]["text"].strip()
    sources = {c["source"] for c in body["citations"]}
    known_sources = set(knowledge.sources())
    assert sources <= known_sources  # never invent a citation id
    assert expected_source in sources


def test_rag_answers_site_question_from_the_engine():
    response = client.post(
        "/api/v1/agent/ask",
        json={"question": "Why was Strategy 2 recommended for this farm?", "farmer": BODY},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["scope"] == "site_specific"
    assert body["request_id"]
    assert "rank" in body["answer"]["text"].lower()
    assert body["evidence"]["strategy_id"] in {"existing", "primary", "contrast"}
    assert body["citations"]


def test_rag_refuses_out_of_scope_questions():
    response = client.post("/api/v1/agent/ask", json={"question": "Who won the 2018 FIFA World Cup?"})
    assert response.status_code == 200
    body = response.json()
    assert body["grounded"] is False
    assert body["scope"] == "insufficient"
    assert body["citations"] == []
    assert "not have enough relevant information" in body["answer"]["text"]


def test_site_questions_without_context_do_not_invent_farm_evidence():
    body = client.post("/api/v1/agent/ask", json={"question": "Why is this rotation best for my farm?"}).json()
    assert body["scope"] != "site_specific"
    assert "evidence" not in body


def test_knowledge_search_endpoint():
    response = client.get("/api/v1/knowledge/search", params={"q": "nitrogen fixation legumes"})
    assert response.status_code == 200
    body = response.json()
    assert body["grounded"] is True
    assert body["passages"][0]["sources"]


def test_agent_ask_requires_a_question():
    assert client.post("/api/v1/agent/ask", json={}).status_code == 422


def test_agent_ask_unknown_analysis_is_404():
    assert client.post("/api/v1/agent/ask", json={"question": "Why strategy 2?", "analysis_id": "nope"}).status_code == 404


def test_workflow_does_not_call_an_llm_when_no_key_is_configured(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    body = workflow.recommend(AnalysisRequest(**BODY))
    assert body["narrative"]["generated_by"] == "template"
