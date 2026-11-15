"""Enumerate feasible 3-season crop sequences under the hard rules and build the existing-rotation candidate."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from ..sim.runner import Timeline
from . import plan as planner
from . import rotation


@dataclass
class Ctx:
    """Everything the engine needs, built once per request."""
    req: object
    ref: date
    seasons: list[str]
    crops: dict[str, dict]
    history: list[dict]  # newest first, crop dicts
    req_history: list[dict]  # newest first, {"crop": id, "season": s}
    status: dict[str, tuple[str, list[dict]]]  # crop id -> (ok|risk|excluded, notes)
    pest_excluded: set[str]
    ece_est: float


@dataclass
class Cand:
    seasons: list[str]
    crops: list[dict | None]
    plan: list
    rot_total: float
    rot_notes: list[list[dict]]
    soil_notes: list[list[dict]]
    soil_status: list[str]
    sim: Timeline | None = None
    scores: dict = field(default_factory=dict)
    metrics: dict = field(default_factory=dict)

    @property
    def key(self) -> tuple:
        return tuple(c["id"] if c else None for c in self.crops)

    @property
    def suitability(self) -> float:
        return self.rot_total - 6.0 * sum(1 for s in self.soil_status if s != "ok")

    @property
    def cheap_water(self) -> float:
        return -sum(c["water"] for c in self.crops if c)

    @property
    def cheap_income(self) -> float:
        return sum(c["income"] for c in self.crops if c)

    @property
    def cheap_health(self) -> float:
        fams = {c["family"] for c in self.crops if c}
        return len(fams) + 0.5 * sum(c["n_effect"] for c in self.crops if c)


def _build(ctx: Ctx, crops: list[dict | None], plan: list) -> Cand:
    rot_total = 0.0
    rot_notes: list[list[dict]] = []
    soil_notes: list[list[dict]] = []
    soil_status: list[str] = []
    prior: list[dict] = list(ctx.history)
    for crop in crops:
        if crop is None:
            rot_notes.append([])
            soil_notes.append([])
            soil_status.append("ok")
            continue
        sc, notes = rotation.transition(prior, crop)
        rot_total += sc
        rot_notes.append(notes)
        status, snotes = ctx.status[crop["id"]]
        soil_notes.append(snotes)
        soil_status.append(status)
        prior = [crop] + prior
    return Cand(list(ctx.seasons), crops, plan, rot_total, rot_notes, soil_notes, soil_status)


def enumerate_candidates(ctx: Ctx) -> list[Cand]:
    options: dict[str, list[dict]] = {}
    for season in set(ctx.seasons):
        options[season] = [
            c for c in ctx.crops.values()
            if season in c["seasons"] and ctx.status[c["id"]][0] != "excluded" and c["id"] not in ctx.pest_excluded
        ]
    out: list[Cand] = []

    def rec(k: int, chosen: list[dict | None]) -> None:
        if k == len(ctx.seasons):
            plan = planner.plan_sequence(ctx.seasons, chosen, ctx.ref)
            if plan is not None:
                out.append(_build(ctx, chosen, plan))
            return
        for crop in options[ctx.seasons[k]]:
            trial = chosen + [crop]
            if planner.plan_sequence(ctx.seasons[: k + 1], trial, ctx.ref) is None:
                continue
            rec(k + 1, trial)

    rec(0, [])
    return out


def existing_candidate(ctx: Ctx) -> Cand:
    """Repeat what was grown in the same season type last time (most recent match); fallow if nothing fits."""
    hist_by_season: dict[str, dict] = {}
    for item in ctx.req_history:  # newest first
        hist_by_season.setdefault(item["season"], ctx.crops[item["crop"]])
    wanted: list[dict | None] = []
    for season in ctx.seasons:
        crop = hist_by_season.get(season)
        if crop is None:
            crop = next((h for h in ctx.history if season in h["seasons"]), None)
        wanted.append(crop)
    final: list[dict | None] = []
    for k, crop in enumerate(wanted):
        if crop is None or planner.plan_sequence(ctx.seasons[: k + 1], final + [crop], ctx.ref) is None:
            final.append(None)
        else:
            final.append(crop)
    plan = planner.plan_sequence(ctx.seasons, final, ctx.ref)
    if plan is None:
        final = [None] * len(ctx.seasons)
        plan = planner.plan_sequence(ctx.seasons, final, ctx.ref) or [None] * len(ctx.seasons)
    cand = _build(ctx, final, plan)
    cand.metrics["fallow_seasons"] = [s for s, c in zip(ctx.seasons, final) if c is None]
    return cand


def select_pool(cands: list[Cand], existing: Cand, max_pool: int = 60) -> list[Cand]:
    """Top candidates by suitability plus the best by each cheap priority, so every archetype has options."""
    chosen: dict[tuple, Cand] = {existing.key: existing}
    for keyfn, n in (
        (lambda c: c.suitability, 18),
        (lambda c: (c.cheap_water, c.suitability), 12),
        (lambda c: (c.cheap_health, c.suitability), 12),
        (lambda c: (c.cheap_income, c.suitability), 12),
    ):
        for c in sorted(cands, key=keyfn, reverse=True)[:n]:
            chosen.setdefault(c.key, c)
    return list(chosen.values())[:max_pool]
