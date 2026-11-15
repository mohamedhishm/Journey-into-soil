"""Layered tipping-bucket water balance (daily) with root-weighted uptake and demand-based irrigation.

Closure identity (tested): storage_end - storage_start = rain + irrigation_net - runoff - E - T - deep_drainage
Rice paddy ponding is NOT modelled; rice is treated as a high-demand irrigated crop.
"""
from __future__ import annotations

from dataclasses import dataclass

from .types import SoilLayer

IRRIGATION_SYSTEMS = {
    # eff = application efficiency, trigger = fraction of allowable depletion that starts an irrigation,
    # refill = fraction of the current depletion applied per event.
    "flood": {"eff": 0.55, "trigger": 1.0, "refill": 1.0},
    "sprinkler": {"eff": 0.75, "trigger": 0.8, "refill": 0.9},
    "drip": {"eff": 0.90, "trigger": 0.5, "refill": 0.6},
}


@dataclass
class StepResult:
    theta: list[float]
    inflow: list[float]
    outflow: list[float]
    runoff: float
    evaporation: float
    transpiration: float
    ks: float
    w_start: list[float]


def overlap_mm(layer: SoilLayer, root_cm: float) -> float:
    return max(0.0, min(layer.bottom_cm, root_cm) - layer.top_cm) * 10.0


def root_zone_stats(layers: list[SoilLayer], theta: list[float], root_cm: float) -> tuple[float, float]:
    """Return (TAW, Dr) in mm for the current root zone."""
    taw = 0.0
    dr = 0.0
    for layer, th in zip(layers, theta):
        ov = overlap_mm(layer, root_cm)
        taw += (layer.fc - layer.wp) * ov
        dr += max(0.0, layer.fc - th) * ov
    return taw, dr


def initial_theta(
    layers: list[SoilLayer],
    fraction: float = 0.7,
    layer_fractions: list[float] | None = None,
) -> list[float]:
    if layer_fractions is not None:
        return [
            layer.wp + max(0.05, min(1.0, frac)) * (layer.fc - layer.wp)
            for layer, frac in zip(layers, layer_fractions)
        ]
    return [layer.wp + fraction * (layer.fc - layer.wp) for layer in layers]


def step(
    layers: list[SoilLayer],
    theta: list[float],
    rain: float,
    irrigation_net: float,
    et0: float,
    kc: float,
    canopy: float,
    root_cm: float,
    p: float,
) -> StepResult:
    n = len(layers)
    w_start = [theta[i] * layers[i].thickness_mm for i in range(n)]
    w = list(w_start)
    inflow = [0.0] * n
    outflow = [0.0] * n

    # Only rain can run off (intensity above the top layer's daily infiltration capacity). Irrigation is by definition
    # the net water that infiltrates, so surplus passes down the profile and ends up as deep drainage.
    rain_infiltrating = min(rain, layers[0].ksat_mm_h * 24.0)
    runoff = rain - rain_infiltrating
    carry = rain_infiltrating + irrigation_net
    for i, layer in enumerate(layers):
        w[i] += carry
        inflow[i] = carry
        sat_mm = layer.sat * layer.thickness_mm
        fc_mm = layer.fc * layer.thickness_mm
        drain = 0.0
        if w[i] > fc_mm:
            drain = min(w[i] - fc_mm, layer.ksat_mm_h * 24.0)
        if w[i] - drain > sat_mm:  # pass-through water that cannot be stored
            drain = w[i] - sat_mm
        w[i] -= drain
        outflow[i] = drain
        carry = drain

    # Soil evaporation from the top layer, reduced as it dries and as the canopy closes.
    top = layers[0]
    th0 = w[0] / top.thickness_mm
    kr = max(0.0, min(1.0, (th0 - 0.5 * top.wp) / (top.fc - 0.5 * top.wp)))
    e_pot = 0.8 * (1.0 - canopy) * et0 * kr
    e_avail = max(0.0, w[0] - 0.5 * top.wp * top.thickness_mm)
    evap = min(e_pot, e_avail)
    w[0] -= evap

    # Transpiration, water-stress limited, taken from root-weighted layers with one compensation pass.
    transp = 0.0
    ks = 1.0
    if kc > 0 and root_cm > 0:
        th_now = [w[i] / layers[i].thickness_mm for i in range(n)]
        taw, dr = root_zone_stats(layers, th_now, root_cm)
        raw = p * taw
        if taw > 0 and dr > raw:
            ks = max(0.0, (taw - dr) / max(taw - raw, 1e-9))
        t_demand = kc * et0 * canopy * ks
        weights = []
        for layer in layers:
            ov = overlap_mm(layer, root_cm)
            mid = (layer.top_cm + min(layer.bottom_cm, root_cm)) / 2
            weights.append(ov * max(0.2, 1.0 - 0.6 * mid / max(root_cm, 1.0)) if ov > 0 else 0.0)
        for _ in range(2):
            wsum = sum(weights)
            if wsum <= 0 or t_demand - transp <= 1e-9:
                break
            remaining = t_demand - transp
            for i, layer in enumerate(layers):
                if weights[i] <= 0:
                    continue
                want = remaining * weights[i] / wsum
                avail = max(0.0, w[i] - layer.wp * layer.thickness_mm)
                take = min(want, avail)
                w[i] -= take
                transp += take
                if avail - take <= 1e-9:
                    weights[i] = 0.0

    new_theta = [w[i] / layers[i].thickness_mm for i in range(n)]
    return StepResult(new_theta, inflow, outflow, runoff, evap, transp, ks, w_start)
