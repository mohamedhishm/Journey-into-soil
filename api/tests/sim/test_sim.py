import math

from app.sim import salinity, water_balance
from app.sim.crop_stage import canopy_at, kc_at, root_depth_at
from app.sim.et0 import fao56_et0
from app.sim.pedotransfer import hydraulic_properties, texture_class
from app.sim.runner import run_timeline
from app.sim.types import CropSeason, DayInput, SoilLayer

CROP = {"id": "t", "cycle_days": [10, 20, 30, 10], "kc": [0.4, 1.1, 0.5], "root_cm": 100, "water": 2,
        "salt_thr": 3.0, "salt_slope": 10.0}


def make_layers(sand=40, clay=20, om=1.5, ec=1.0):
    spans = [(0, 20), (20, 50), (50, 90), (90, 150)]
    return [SoilLayer(a, b, sand, 100 - sand - clay, clay, om, 7.8, ec) for a, b in spans]


def test_et0_cairo_july_in_plausible_range():
    et0 = fao56_et0(tmin=22, tmax=36, rh_mean=45, u2=2.5, rs=29, lat=30.0, doy=196)
    assert 6.0 <= et0 <= 9.0


def test_et0_winter_lower_than_summer():
    summer = fao56_et0(22, 36, 45, 2.5, 29, 30.0, 196)
    winter = fao56_et0(8, 19, 65, 2.0, 11, 30.0, 15)
    assert winter < summer / 2


def test_pedotransfer_ordering():
    sand = hydraulic_properties(88, 6, 1.0)
    clay = hydraulic_properties(20, 55, 1.0)
    assert sand["fc"] < clay["fc"]
    assert sand["ksat_mm_h"] > clay["ksat_mm_h"]
    for h in (sand, clay):
        assert 0 < h["wp"] < h["fc"] < h["sat"] <= 0.65


def test_pedotransfer_loam_is_sane():
    h = hydraulic_properties(40, 20, 2.0)
    assert 0.07 < h["wp"] < 0.16 and 0.22 < h["fc"] < 0.33


def test_texture_class_roundtrip():
    assert texture_class(88, 6) == "sand"
    assert texture_class(20, 55) == "clay"
    assert texture_class(40, 20) == "loam"


def test_crop_curves():
    assert kc_at(CROP, 0) == 0.4
    assert kc_at(CROP, 40) == 1.1
    assert kc_at(CROP, 69) < 1.1
    assert canopy_at(CROP, 0) < canopy_at(CROP, 40) == 1.0
    assert root_depth_at(CROP, 0) == 10 and root_depth_at(CROP, 60) == 100


def test_relative_yield():
    assert salinity.relative_yield(2.0, 3.0, 10.0) == 100.0
    assert salinity.relative_yield(5.0, 3.0, 10.0) == 80.0
    assert salinity.relative_yield(50.0, 3.0, 10.0) == 0.0


def _days(n=200, rain_every=25, rain=15.0, et0=5.0):
    return [DayInput(f"2026-01-{(i % 28) + 1:02d}", et0, rain if i % rain_every == 0 else 0.0, 30.0) for i in range(n)]


def test_water_balance_closes_exactly():
    layers = make_layers()
    days = _days()
    sched = [CropSeason(CROP, "winter", 10, 89)]
    tl = run_timeline(layers, days, sched, "flood", 1.5)
    b = tl.balance
    expected = b["rain"] + b["irrigation_net"] - b["runoff"] - b["evaporation"] - b["transpiration"] - b["drainage"]
    assert math.isclose(b["storage_change"], expected, abs_tol=1e-6)


def test_salt_balance_closes_exactly():
    layers = make_layers(ec=2.0)
    tl = run_timeline(layers, _days(), [CropSeason(CROP, "winter", 5, 104)], "sprinkler", 2.5)
    b = tl.balance
    assert math.isclose(b["salt_change"], b["salt_in"] - b["salt_out"], abs_tol=1e-6)


def test_rainfed_has_no_irrigation_and_more_stress():
    layers = make_layers(sand=88, clay=6)
    irrigated = run_timeline(layers, _days(rain=0), [CropSeason(CROP, "summer", 5, 74)], "drip", 1.0)
    rainfed = run_timeline(make_layers(sand=88, clay=6), _days(rain=0), [CropSeason(CROP, "summer", 5, 74)], "none", 1.0)
    assert rainfed.totals["irrigation_mm"] == 0
    assert irrigated.totals["irrigation_mm"] > 0
    assert rainfed.seasons[0].water_stress > irrigated.seasons[0].water_stress


def test_flood_uses_more_gross_water_than_drip():
    flood = run_timeline(make_layers(), _days(rain=0), [CropSeason(CROP, "summer", 5, 74)], "flood", 1.0)
    drip = run_timeline(make_layers(), _days(rain=0), [CropSeason(CROP, "summer", 5, 74)], "drip", 1.0)
    assert flood.totals["irrigation_mm"] > drip.totals["irrigation_mm"]


def test_salinity_rises_with_saline_irrigation_water():
    fresh = run_timeline(make_layers(ec=0.5), _days(rain=0), [CropSeason(CROP, "summer", 5, 99)], "flood", 0.4)
    salty = run_timeline(make_layers(ec=0.5), _days(rain=0), [CropSeason(CROP, "summer", 5, 99)], "flood", 4.0)
    assert salty.ece[0][-1] > fresh.ece[0][-1]
    assert salty.seasons[0].salinity_stress >= fresh.seasons[0].salinity_stress


def test_moisture_never_negative_and_bare_days_marked():
    tl = run_timeline(make_layers(), _days(), [CropSeason(CROP, "winter", 50, 109)], "flood", 1.0)
    assert min(min(row) for row in tl.moisture) >= 0.0
    assert tl.crop_idx[0] == -1 and tl.crop_idx[60] == 0 and tl.crop_idx[150] == -1


def test_extreme_rain_runs_off_but_irrigation_never_does():
    layers = make_layers()
    theta = water_balance.initial_theta(layers, 1.0)
    rain = water_balance.step(layers, theta, rain=900.0, irrigation_net=0, et0=0, kc=0, canopy=0, root_cm=0, p=0.5)
    assert rain.runoff > 0
    irr = water_balance.step(layers, theta, rain=0.0, irrigation_net=300.0, et0=0, kc=0, canopy=0, root_cm=0, p=0.5)
    assert irr.runoff == 0.0
    assert irr.outflow[-1] > 0  # surplus is deep drainage, not vanished


def test_irrigated_season_has_no_runoff_and_realistic_gross_water():
    tl = run_timeline(make_layers(), _days(rain=0, et0=3.0), [CropSeason(CROP, "winter", 5, 74)], "flood", 1.0)
    assert tl.balance["runoff"] == 0.0
    s = tl.seasons[0]
    assert s.irrigation_net_mm <= 1.6 * s.et_mm  # not wildly more than crop demand
    assert s.irrigation_mm > s.irrigation_net_mm  # flood efficiency < 1
