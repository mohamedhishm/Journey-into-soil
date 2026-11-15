"""Plain data types for the simulation. No I/O in app/sim."""
from __future__ import annotations

from dataclasses import dataclass, field

from .pedotransfer import hydraulic_properties


@dataclass
class SoilLayer:
    top_cm: float
    bottom_cm: float
    sand: float  # %
    silt: float  # %
    clay: float  # %
    om: float  # % organic matter
    ph: float
    ec: float  # ECe, dS/m
    source: dict = field(default_factory=dict)  # property -> measured|dataset|estimated
    wp: float = 0.0
    fc: float = 0.0
    sat: float = 0.0
    ksat_mm_h: float = 0.0

    def __post_init__(self) -> None:
        h = hydraulic_properties(self.sand, self.clay, self.om)
        self.wp, self.fc, self.sat, self.ksat_mm_h = h["wp"], h["fc"], h["sat"], h["ksat_mm_h"]

    @property
    def thickness_mm(self) -> float:
        return (self.bottom_cm - self.top_cm) * 10.0


@dataclass
class DayInput:
    date: str  # ISO
    et0: float  # mm/day
    rain: float  # mm/day
    tmax: float  # deg C


@dataclass
class CropSeason:
    crop: dict  # entry from knowledge/crops.yaml
    season: str  # winter|summer|nili
    sow_idx: int  # index into the day list
    harvest_idx: int  # inclusive last day
