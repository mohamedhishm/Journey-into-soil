"""Pick the three strategies: existing, best for the top priority, and the most contrasting archetype."""
from __future__ import annotations

from .generator import Cand
from .scoring import PRIORITIES, total, weights_from


def top_priority(priorities) -> str:
    w = {p: float(getattr(priorities, p)) for p in PRIORITIES}
    return max(PRIORITIES, key=lambda p: (w[p], -PRIORITIES.index(p)))


def _best(pool: list[Cand], weights: dict[str, float], exclude: set[tuple]) -> Cand | None:
    ranked = sorted((c for c in pool if c.key not in exclude), key=lambda c: total(c.scores, weights), reverse=True)
    return ranked[0] if ranked else None


def distance(a: Cand, b: Cand) -> int:
    return sum(1 for x, y in zip(a.key, b.key) if x != y)


def select(pool: list[Cand], existing: Cand, priorities) -> list[dict]:
    top = top_priority(priorities)
    primary = _best(pool, weights_from(priorities, top), {existing.key})
    picked = [{"id": "existing", "archetype": "existing", "cand": existing}]
    if primary is None:
        return picked
    picked.append({"id": "primary", "archetype": top, "cand": primary})

    others = [p for p in PRIORITIES if p != top]
    options = []
    for arch in others:
        c = _best(pool, weights_from(priorities, arch), {existing.key, primary.key})
        if c is not None:
            options.append((distance(c, primary), float(getattr(priorities, arch)), arch, c))
    if options:
        options.sort(key=lambda o: (o[0], o[1]), reverse=True)
        _, _, arch, cand = options[0]
        picked.append({"id": "contrast", "archetype": arch, "cand": cand})
    return picked


def existing_rank(pool: list[Cand], existing: Cand, priorities) -> int:
    w = weights_from(priorities)
    ranked = sorted(pool, key=lambda c: total(c.scores, w), reverse=True)
    return 1 + next(i for i, c in enumerate(ranked) if c is existing)
