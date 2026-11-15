"""Run a multi-season timeline day by day: bare periods between crops are simulated explicitly."""
from __future__ import annotations

from dataclasses import dataclass, field

from . import crop_stage, salinity, water_balance
from .types import CropSeason, DayInput, SoilLayer

HEAT_TMAX = 35.0  # generic threshold; crop-specific thresholds need expert input


@dataclass
class SeasonSummary:
    season: str
    crop_id: str
    sow_idx: int
    harvest_idx: int
    days: int
    et_mm: float = 0.0
    rain_mm: float = 0.0
    irrigation_mm: float = 0.0  # gross applied water
    irrigation_net_mm: float = 0.0
    drainage_mm: float = 0.0
    water_stress: float = 0.0  # mean(1 - Ks) over crop days, 0..1
    salinity_stress: float = 0.0  # 1 - mean(relative yield)/100, 0..1
    heat_days: int = 0


@dataclass
class Timeline:
    n: int
    moisture: list[list[float]]  # [layer][day], 0 = wilting point, 1 = field capacity
    ece: list[list[float]]  # [layer][day] dS/m
    root_cm: list[float]
    canopy: list[float]
    ks: list[float]
    irrigation_mm: list[float]
    crop_idx: list[int]  # season index or -1 when bare
    seasons: list[SeasonSummary]
    totals: dict = field(default_factory=dict)
    balance: dict = field(default_factory=dict)  # closure check terms


def run_timeline(
    layers: list[SoilLayer],
    days: list[DayInput],
    schedule: list[CropSeason],
    irrigation_system: str,
    ec_water: float,
    init_fraction: float = 0.7,
    init_fractions: list[float] | None = None,
    record_daily: bool = True,
) -> Timeline:
    n_layers = len(layers)
    theta = water_balance.initial_theta(layers, init_fraction, layer_fractions=init_fractions)
    salt = salinity.initial_salt(layers)
    system = water_balance.IRRIGATION_SYSTEMS.get(irrigation_system)

    owner = [-1] * len(days)
    for si, cs in enumerate(schedule):
        for i in range(cs.sow_idx, min(cs.harvest_idx, len(days) - 1) + 1):
            owner[i] = si

    summaries = [
        SeasonSummary(cs.season, cs.crop["id"], cs.sow_idx, cs.harvest_idx, cs.harvest_idx - cs.sow_idx + 1)
        for cs in schedule
    ]
    yr_sum = [0.0] * len(schedule)
    ks_sum = [0.0] * len(schedule)

    if record_daily:
        moisture = [[0.0] * len(days) for _ in range(n_layers)]
        ece_out = [[0.0] * len(days) for _ in range(n_layers)]
        root_out = [0.0] * len(days)
        canopy_out = [0.0] * len(days)
        ks_out = [1.0] * len(days)
        irr_out = [0.0] * len(days)
    else:
        moisture = ece_out = []
        root_out = canopy_out = ks_out = irr_out = []

    storage_start = sum(t * layer.thickness_mm for t, layer in zip(theta, layers))
    bal = {"rain": 0.0, "irrigation_net": 0.0, "runoff": 0.0, "evaporation": 0.0, "transpiration": 0.0,
           "drainage": 0.0, "salt_in": 0.0, "salt_out": 0.0}
    salt_start = sum(salt)

    for idx, day in enumerate(days):
        si = owner[idx]
        if si >= 0:
            crop = schedule[si].crop
            d = idx - schedule[si].sow_idx
            kc = crop_stage.kc_at(crop, d)
            canopy = crop_stage.canopy_at(crop, d)
            root = crop_stage.root_depth_at(crop, d)
            p = crop_stage.depletion_fraction(crop)
        else:
            crop = None
            kc = canopy = root = 0.0
            p = 0.5

        irr_net = 0.0
        if crop is not None and system is not None:
            probe_root = max(root, 30.0) if d == 0 else root
            taw, dr = water_balance.root_zone_stats(layers, theta, probe_root)
            if d == 0:
                irr_net = dr  # pre-sowing irrigation to field capacity
            elif taw > 0 and dr > system["trigger"] * p * taw:
                irr_net = system["refill"] * dr
        irr_gross = irr_net / system["eff"] if system and irr_net > 0 else 0.0

        res = water_balance.step(layers, theta, day.rain, irr_net, day.et0, kc, canopy, root, p)
        theta = res.theta
        top_salt_in = irr_net * ec_water  # irrigation always infiltrates; rain carries no salt
        salt_out = salinity.step(layers, salt, res.w_start, res.inflow, res.outflow, top_salt_in)

        ece_now = salinity.ece(layers, salt)
        if record_daily:
            for li, layer in enumerate(layers):
                span = layer.fc - layer.wp
                # 0 = wilting point (or drier), 1 = field capacity, >1 = wetter than field capacity
                moisture[li][idx] = round(max(0.0, (theta[li] - layer.wp) / span), 3)
                ece_out[li][idx] = round(ece_now[li], 2)
            root_out[idx] = round(root, 1)
            canopy_out[idx] = round(canopy, 3)
            ks_out[idx] = round(res.ks, 3)
            irr_out[idx] = round(irr_gross, 1)

        bal["rain"] += day.rain
        bal["irrigation_net"] += irr_net
        bal["runoff"] += res.runoff
        bal["evaporation"] += res.evaporation
        bal["transpiration"] += res.transpiration
        bal["drainage"] += res.outflow[-1]
        bal["salt_in"] += top_salt_in
        bal["salt_out"] += salt_out

        if si >= 0:
            s = summaries[si]
            s.et_mm += res.evaporation + res.transpiration
            s.rain_mm += day.rain
            s.irrigation_mm += irr_gross
            s.irrigation_net_mm += irr_net
            s.drainage_mm += res.outflow[-1]
            ks_sum[si] += 1.0 - res.ks
            rz = salinity.root_zone_ece(layers, ece_now, root if root > 0 else 30.0)
            yr_sum[si] += salinity.relative_yield(rz, crop["salt_thr"], crop["salt_slope"])
            if day.tmax >= HEAT_TMAX:
                s.heat_days += 1

    for si, s in enumerate(summaries):
        s.water_stress = ks_sum[si] / s.days if s.days else 0.0
        s.salinity_stress = 1.0 - (yr_sum[si] / s.days) / 100.0 if s.days else 0.0
        for attr in ("et_mm", "rain_mm", "irrigation_mm", "irrigation_net_mm", "drainage_mm"):
            setattr(s, attr, round(getattr(s, attr), 1))
        s.water_stress = round(s.water_stress, 3)
        s.salinity_stress = round(s.salinity_stress, 3)

    storage_end = sum(t * layer.thickness_mm for t, layer in zip(theta, layers))
    bal["storage_change"] = storage_end - storage_start
    bal["salt_change"] = sum(salt) - salt_start
    return Timeline(
        n=len(days), moisture=moisture, ece=ece_out, root_cm=root_out, canopy=canopy_out, ks=ks_out,
        irrigation_mm=irr_out, crop_idx=owner, seasons=summaries,
        totals={
            "irrigation_mm": round(sum(s.irrigation_mm for s in summaries), 1),
            "et_mm": round(sum(s.et_mm for s in summaries), 1),
        },
        balance=bal,
    )
