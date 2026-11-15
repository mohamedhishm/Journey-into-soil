"""FAO-56 Penman-Monteith reference evapotranspiration (daily, G = 0)."""
from __future__ import annotations

import math


def svp(t: float) -> float:
    """Saturation vapour pressure (kPa) at air temperature t (deg C)."""
    return 0.6108 * math.exp(17.27 * t / (t + 237.3))


def extraterrestrial_radiation(lat_deg: float, doy: int) -> float:
    """Ra, MJ m-2 day-1 (FAO-56 eq. 21)."""
    phi = math.radians(lat_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi / 365 * doy)
    delta = 0.409 * math.sin(2 * math.pi / 365 * doy - 1.39)
    ws = math.acos(max(-1.0, min(1.0, -math.tan(phi) * math.tan(delta))))
    return (24 * 60 / math.pi) * 0.0820 * dr * (
        ws * math.sin(phi) * math.sin(delta) + math.cos(phi) * math.cos(delta) * math.sin(ws)
    )


def fao56_et0(
    tmin: float,
    tmax: float,
    rh_mean: float,
    u2: float,
    rs: float,
    lat: float,
    doy: int,
    elev: float = 10.0,
) -> float:
    """ET0 in mm/day. rs in MJ m-2 day-1, u2 in m/s at 2 m, rh_mean in %."""
    tmean = (tmin + tmax) / 2
    pressure = 101.3 * ((293 - 0.0065 * elev) / 293) ** 5.26
    gamma = 0.000665 * pressure
    es = (svp(tmax) + svp(tmin)) / 2
    ea = rh_mean / 100.0 * es
    delta = 4098 * svp(tmean) / (tmean + 237.3) ** 2
    ra = extraterrestrial_radiation(lat, doy)
    rso = (0.75 + 2e-5 * elev) * ra
    rns = 0.77 * rs
    ratio = min(1.0, rs / rso) if rso > 0 else 0.5
    rnl = (
        4.903e-9
        * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2)
        * (0.34 - 0.14 * math.sqrt(max(ea, 0.0)))
        * (1.35 * ratio - 0.35)
    )
    rn = rns - rnl
    num = 0.408 * delta * rn + gamma * 900.0 / (tmean + 273.0) * u2 * (es - ea)
    den = delta + gamma * (1 + 0.34 * u2)
    return max(0.0, num / den)
