from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Season = Literal["winter", "summer", "nili"]
Texture = Literal["sand", "sandy_loam", "loam", "silt_loam", "clay_loam", "clay"]


class HistoryItem(BaseModel):
    crop: str
    season: Season


class Priorities(BaseModel):
    """Relative importance 0..5. Only the ratios matter."""

    water: float = Field(1.0, ge=0, le=5)
    soil_health: float = Field(1.0, ge=0, le=5)
    income: float = Field(1.0, ge=0, le=5)
    risk: float = Field(1.0, ge=0, le=5)


class Scenario(BaseModel):
    """Sensitivity exploration applied to the climate series. Not a forecast."""

    dT: float = Field(0.0, ge=-3, le=6, description="temperature offset, deg C")
    dP: float = Field(0.0, ge=-60, le=60, description="rainfall change, percent")


class AnalysisRequest(BaseModel):
    lat: float = Field(30.79, ge=22.0, le=32.0)
    lon: float = Field(31.0, ge=24.0, le=37.0)
    area_feddan: float | None = Field(None, gt=0, le=10000)
    region: Literal["auto", "delta", "upper_egypt", "new_lands"] = "auto"

    texture: Texture = "loam"
    texture_confirmed: bool = False  # True only if confirmed by lab analysis (guide: feel is screening-level)
    effective_depth_cm: float = Field(150, ge=20, le=300)
    drainage: Literal["good", "moderate", "poor"] = "good"
    ph: float | None = Field(None, ge=4, le=10)
    soil_ec: float | None = Field(None, ge=0, le=40, description="measured ECe, dS/m")
    organic_matter: float | None = Field(None, ge=0, le=15, description="measured topsoil OM, %")
    organic_input: Literal["none", "some", "regular"] = "some"
    residues: Literal["retained", "burned", "unknown"] = "unknown"

    irrigation: Literal["flood", "sprinkler", "drip", "none"] = "flood"
    water_ec: float = Field(1.0, ge=0, le=15)
    water_ec_measured: bool = False
    water_availability: Literal["ample", "limited", "scarce"] = "ample"
    pest: Literal["none", "nematodes", "soil_borne", "unknown"] = "none"

    history: list[HistoryItem] = Field(
        default_factory=lambda: [
            HistoryItem(crop="maize", season="summer"),
            HistoryItem(crop="wheat", season="winter"),
            HistoryItem(crop="maize", season="summer"),
        ],
        max_length=3,
    )
    next_season: Season = "winter"
    priorities: Priorities = Field(default_factory=Priorities)
    scenario: Scenario = Field(default_factory=Scenario)
    use_live_weather: bool = Field(True, description="Ground initial soil profile and stress in live weather/soil telemetry")
    reference_date: date | None = Field(None, description="planning start; defaults to today")
