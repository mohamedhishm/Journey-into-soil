"""Lightweight BM25 retriever over the repository knowledge corpus.

No embeddings service and no network call: the corpus is small (a few dozen passages), so a
deterministic lexical ranking is sufficient, reproducible and easy to audit. Every hit keeps the
passage id and its declared sources so answers can cite them.
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache

from . import corpus

K1 = 1.5
B = 0.75
MIN_SCORE = 1.0  # below this the corpus is treated as not covering the question
TITLE_WEIGHT = 3.0  # a term in the passage title is worth this many body occurrences


@dataclass
class Hit:
    passage: corpus.Passage
    score: float

    def to_json(self) -> dict:
        return {
            "id": self.passage.id,
            "title": self.passage.title,
            "text": self.passage.text,
            "sources": self.passage.sources,
            "kind": self.passage.kind,
            "score": round(self.score, 3),
        }


class Index:
    def __init__(self, passages: list[corpus.Passage]) -> None:
        self.passages = passages
        self.tf = []
        self.lengths = []
        for passage in passages:
            body = Counter(corpus.tokenize(passage.text))
            title = Counter(corpus.tokenize(passage.title))
            weighted = Counter({term: count for term, count in body.items()})
            for term, count in title.items():
                weighted[term] += TITLE_WEIGHT * count
            self.tf.append(weighted)
            self.lengths.append(sum(body.values()) + TITLE_WEIGHT * sum(title.values()))
        self.avg = sum(self.lengths) / max(len(self.lengths), 1)
        self.tokens = [set(counter) for counter in self.tf]
        df: Counter = Counter()
        for tokens in self.tokens:
            df.update(set(tokens))
        n = max(len(passages), 1)
        self.idf = {term: math.log(1 + (n - count + 0.5) / (count + 0.5)) for term, count in df.items()}

    def search(self, query: str, k: int = 5) -> list[Hit]:
        terms = corpus.tokenize(query)
        if not terms:
            return []
        scored: list[Hit] = []
        for i, passage in enumerate(self.passages):
            length = self.lengths[i] or 1
            score = 0.0
            for term in terms:
                freq = self.tf[i].get(term, 0)
                if not freq:
                    continue
                idf = self.idf.get(term, 0.0)
                score += idf * (freq * (K1 + 1)) / (freq + K1 * (1 - B + B * length / self.avg))
            if score > 0:
                scored.append(Hit(passage, score))
        scored.sort(key=lambda h: h.score, reverse=True)
        return scored[:k]


@lru_cache(maxsize=1)
def index() -> Index:
    return Index(corpus.build())


def search(query: str, k: int = 5) -> list[Hit]:
    return index().search(query, k)


def is_grounded(hits: list[Hit]) -> bool:
    """A question is only in scope when at least one passage clears the minimum score."""
    return bool(hits) and hits[0].score >= MIN_SCORE
