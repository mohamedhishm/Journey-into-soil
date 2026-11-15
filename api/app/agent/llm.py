"""Optional language-model phrasing layer.

The LLM is only ever asked to *rephrase* facts that the rotation engine, the simulation and the
retriever already produced. It never ranks strategies, never computes a metric, and never supplies
a citation. If no key is configured (or the call fails) the deterministic templates in the workflow
are used, so the agent works offline and in the demo.

Configuration (optional, never committed):
    OPENAI_API_KEY   - any OpenAI-compatible chat-completions key
    OPENAI_BASE_URL  - defaults to https://api.openai.com/v1
    OPENAI_MODEL     - defaults to gpt-4o-mini
"""

from __future__ import annotations

import os

import httpx

SYSTEM_PROMPT = (
    "You are an agricultural decision-support assistant for Egyptian farmers. "
    "You receive facts computed by a crop-rotation engine and a water-balance simulation, plus "
    "retrieved passages with ids. Rules you must never break:\n"
    "1. Use ONLY the numbers given in the facts. Never invent, recompute or round a score, a "
    "millimetre value or a date.\n"
    "2. Never create a citation. Refer only to the passage ids and source ids provided.\n"
    "3. Do not tell the farmer what they must do. Explain, compare and point to what needs local "
    "checking by the farmer or an agronomist.\n"
    "4. Distinguish clearly between general agricultural knowledge (retrieved) and evidence about "
    "this specific field (NASA observations or simulation).\n"
    "5. If the facts are insufficient to answer, say so plainly.\n"
    "Write 3-6 short sentences in plain language, in the requested language."
)


def available() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


def model() -> str:
    return os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


def base_url() -> str:
    return os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")


def explain(facts: str, question: str, lang: str = "en", timeout: float = 30.0) -> dict:
    """Return {"text": str|None, "model": str, "status": ...}. Never raises."""
    if not available():
        return {"text": None, "model": None, "status": "not_configured"}
    payload = {
        "model": model(),
        "temperature": 0.2,
        "max_tokens": 400,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Language: {'Arabic (MSA)' if lang == 'ar' else 'English'}\n"
                    f"Question: {question}\n\nFACTS (authoritative, use only these):\n{facts}"
                ),
            },
        ],
    }
    try:
        response = httpx.post(
            f"{base_url()}/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
            timeout=timeout,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()
        return {"text": content, "model": model(), "status": "ok"}
    except Exception as error:  # noqa: BLE001 - the agent must degrade to templates
        return {"text": None, "model": model(), "status": f"error: {type(error).__name__}"}
