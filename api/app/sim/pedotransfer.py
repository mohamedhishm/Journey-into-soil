"""Saxton and Rawls (2006) pedotransfer functions: texture + organic matter -> soil water limits."""
from __future__ import annotations

import math


def hydraulic_properties(sand_pct: float, clay_pct: float, om_pct: float) -> dict:
    """Return wp (1500 kPa), fc (33 kPa), sat (volumetric, m3/m3) and ksat (mm/h)."""
    s = sand_pct / 100.0
    c = clay_pct / 100.0
    om = om_pct

    t1500t = -0.024 * s + 0.487 * c + 0.006 * om + 0.005 * s * om - 0.013 * c * om + 0.068 * s * c + 0.031
    wp = t1500t + (0.14 * t1500t - 0.02)

    t33t = -0.251 * s + 0.195 * c + 0.011 * om + 0.006 * s * om - 0.027 * c * om + 0.452 * s * c + 0.299
    fc = t33t + (1.283 * t33t**2 - 0.374 * t33t - 0.015)

    ts33t = 0.278 * s + 0.034 * c + 0.022 * om - 0.018 * s * om - 0.027 * c * om - 0.584 * s * c + 0.078
    ts33 = ts33t + (0.636 * ts33t - 0.107)
    sat = fc + ts33 - 0.097 * s + 0.043

    wp = max(0.02, wp)
    fc = max(wp + 0.03, fc)
    sat = max(fc + 0.03, min(0.65, sat))

    lam = (math.log(fc) - math.log(wp)) / (math.log(1500) - math.log(33))
    ksat = 1930.0 * max(sat - fc, 1e-4) ** (3 - lam)
    return {"wp": wp, "fc": fc, "sat": sat, "ksat_mm_h": max(0.05, ksat)}


def texture_class(sand: float, clay: float) -> str:
    """Map sand/clay % to one of the six knowledge-base texture ids (simplified USDA triangle)."""
    silt = 100 - sand - clay
    if clay >= 40:
        return "clay"
    if clay >= 27:
        return "clay_loam"
    if sand >= 80:
        return "sand"
    if sand >= 52 and clay < 20:
        return "sandy_loam"
    if silt >= 50 and clay < 27:
        return "silt_loam"
    return "loam"
