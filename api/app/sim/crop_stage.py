"""Crop development curves from the knowledge-base entry (FAO-56 single crop coefficient approach)."""
from __future__ import annotations


def cycle_length(crop: dict) -> int:
    return int(sum(crop["cycle_days"]))


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * max(0.0, min(1.0, t))


def kc_at(crop: dict, d: int) -> float:
    ini, dev, mid, late = crop["cycle_days"]
    k_ini, k_mid, k_end = crop["kc"]
    if d < ini:
        return k_ini
    if d < ini + dev:
        return _lerp(k_ini, k_mid, (d - ini) / dev)
    if d < ini + dev + mid:
        return k_mid
    return _lerp(k_mid, k_end, (d - ini - dev - mid) / max(late, 1))


def canopy_at(crop: dict, d: int) -> float:
    """Fraction of ground covered by canopy, 0..1 (indicative)."""
    ini, dev, mid, late = crop["cycle_days"]
    if d < ini:
        return 0.10
    if d < ini + dev:
        return _lerp(0.10, 1.0, (d - ini) / dev)
    if d < ini + dev + mid:
        return 1.0
    return _lerp(1.0, 0.5, (d - ini - dev - mid) / max(late, 1))


def root_depth_at(crop: dict, d: int) -> float:
    """Rooting depth in cm: 10 cm at sowing, linear to the crop maximum by the end of development."""
    ini, dev, _, _ = crop["cycle_days"]
    return _lerp(10.0, float(crop["root_cm"]), d / max(ini + dev, 1))


def depletion_fraction(crop: dict) -> float:
    """Allowable depletion p (FAO-56 Table 22 style): high-demand crops tolerate less depletion."""
    return {1: 0.6, 2: 0.5, 3: 0.3}.get(int(crop["water"]), 0.5)
