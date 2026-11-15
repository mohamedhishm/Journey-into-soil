"""Grounded answers built from retrieved passages only.

The answer text is *extractive*: it is assembled from sentences that already exist in the cited
repository sources, so a language model cannot introduce facts or references. When retrieval
finds nothing relevant the answer says so instead of guessing.
"""

from __future__ import annotations

import re

from . import corpus, retriever

MAX_ANSWER_SENTENCES = 4


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 30]


def _overlap(sentence: str, terms: set[str]) -> int:
    return len(set(corpus.tokenize(sentence)) & terms)


def compose(question: str, hits: list[retriever.Hit]) -> str:
    """Pick the sentences most relevant to the question from the top passages."""
    terms = set(corpus.tokenize(question))
    scored: list[tuple[int, int, str]] = []
    for rank, hit in enumerate(hits):
        for sentence in _sentences(hit.passage.text):
            scored.append((_overlap(sentence, terms), -rank, sentence))
    scored.sort(reverse=True)
    picked: list[str] = []
    for _score, _rank, sentence in scored:
        if sentence in picked:
            continue
        picked.append(sentence)
        if len(picked) >= MAX_ANSWER_SENTENCES:
            break
    return " ".join(picked)


def ask(question: str, k: int = 5) -> dict:
    """Answer a knowledge question, citing the passages used, or refuse safely."""
    hits = retriever.search(question, k)
    if not retriever.is_grounded(hits):
        return {
            "grounded": False,
            "scope": "insufficient",
            "answer": {
                "text": (
                    "I do not have enough relevant information in the available agricultural sources to "
                    "answer that. This assistant only answers from the crop-rotation, soil, water and "
                    "satellite-vegetation sources bundled with this project."
                ),
                "sentences": [{"key": "rag.insufficient", "params": {}}],
                "generated_by": "template",
            },
            "citations": [],
            "passages": [h.to_json() for h in hits],
            "notes": ["rag.sources_insufficient"],
        }

    best = hits[0].score
    used = [h for h in hits if h.score >= max(best * 0.45, retriever.MIN_SCORE)][:3]
    text = compose(question, used)
    citations = []
    seen: set[str] = set()
    for hit in used:
        for source in hit.passage.sources:
            if source in seen:
                continue
            seen.add(source)
            citations.append({"source": source, "passage_id": hit.passage.id, "title": hit.passage.title})
    return {
        "grounded": True,
        "scope": "general",
        "answer": {"text": text, "sentences": [], "generated_by": "template-extractive"},
        "citations": citations,
        "passages": [h.to_json() for h in used],
        "notes": ["rag.general_not_site"],
    }
