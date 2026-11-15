"""Season windows -> concrete sowing/harvest dates for a sequence of crops. Infeasible sequences return None."""
from __future__ import annotations

from datetime import date, timedelta

from .. import knowledge
from ..sim.crop_stage import cycle_length


def _md(s: str, year: int) -> date:
    m, d = s.split("-")
    return date(year, int(m), int(d))


def window(season: str, year: int) -> tuple[date, date, date]:
    """(earliest_sow, latest_sow, latest_harvest) of the window that opens in `year`."""
    w = knowledge.windows()["seasons"][season]
    earliest = _md(w["earliest_sow"], year)
    latest_sow = _md(w["latest_sow"], year)
    lh = _md(w["latest_harvest"], year)
    if lh <= earliest:
        lh = _md(w["latest_harvest"], year + 1)
    return earliest, latest_sow, lh


def first_sow(season: str, ref: date) -> tuple[date, date] | None:
    """First feasible sowing date at/after `ref` and the window's latest harvest."""
    for year in (ref.year - 1, ref.year, ref.year + 1):
        earliest, latest_sow, lh = window(season, year)
        if latest_sow >= ref:
            return max(earliest, ref), lh
    return None


def next_sow(season: str, after: date) -> tuple[date, date] | None:
    turnaround = int(knowledge.windows()["turnaround_days"])
    ready = after + timedelta(days=turnaround + 1)
    for year in (after.year - 1, after.year, after.year + 1):
        earliest, latest_sow, lh = window(season, year)
        if latest_sow >= ready:
            return max(earliest, ready), lh
    return None


def season_sequence(first: str, n: int = 3) -> list[str]:
    nxt = knowledge.windows()["next_season"]
    seq = [first]
    while len(seq) < n:
        seq.append(nxt[seq[-1]])
    return seq


def plan_sequence(seasons: list[str], crops: list[dict | None], ref: date) -> list[tuple[date, date] | None] | None:
    """Dates per season; None entries are fallow seasons. Returns None when any crop cannot fit its window."""
    plan: list[tuple[date, date] | None] = []
    prev_end: date | None = None
    for season, crop in zip(seasons, crops):
        slot = first_sow(season, ref) if prev_end is None else next_sow(season, prev_end)
        if slot is None:
            return None
        sow, latest_harvest = slot
        if crop is None:  # fallow: the whole window stays bare
            plan.append(None)
            prev_end = latest_harvest
            continue
        harvest = sow + timedelta(days=cycle_length(crop) - 1)
        if harvest > latest_harvest:
            return None
        plan.append((sow, harvest))
        prev_end = harvest
    return plan
