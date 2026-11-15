"""Indicative per-layer salt balance. ECe = salt store / (thickness * theta_sat). NOT a calibrated model.

Water leaving a layer carries the mixed soil-water concentration; evaporation and transpiration remove water but not salt,
so salt concentrates in the root zone unless drainage leaches it. Salt in = irrigation EC x infiltrated irrigation water.
"""
from __future__ import annotations

from .types import SoilLayer


def initial_salt(layers: list[SoilLayer]) -> list[float]:
    return [layer.ec * layer.thickness_mm * layer.sat for layer in layers]


def ece(layers: list[SoilLayer], salt: list[float]) -> list[float]:
    return [s / (layer.thickness_mm * layer.sat) for s, layer in zip(salt, layers)]


def step(
    layers: list[SoilLayer],
    salt: list[float],
    w_start: list[float],
    inflow: list[float],
    outflow: list[float],
    top_salt_in: float,
) -> float:
    """Update `salt` in place; return salt leaving the bottom layer (leached)."""
    carry = top_salt_in
    for i in range(len(layers)):
        water = w_start[i] + inflow[i]
        conc = (salt[i] + carry) / water if water > 1e-9 else 0.0
        out = min(conc * outflow[i], salt[i] + carry)
        salt[i] = salt[i] + carry - out
        carry = out
    return carry


def relative_yield(ece_rz: float, threshold: float, slope: float) -> float:
    """Maas-Hoffman: Yr(%) = 100 - slope * (ECe - threshold), clipped to 0..100."""
    return max(0.0, min(100.0, 100.0 - slope * max(0.0, ece_rz - threshold)))


def root_zone_ece(layers: list[SoilLayer], ece_values: list[float], root_cm: float) -> float:
    num = den = 0.0
    for layer, e in zip(layers, ece_values):
        ov = max(0.0, min(layer.bottom_cm, root_cm) - layer.top_cm)
        num += e * ov
        den += ov
    return num / den if den > 0 else ece_values[0]
