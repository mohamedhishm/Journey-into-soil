from datetime import date, timedelta

from app.engine import uncertainty
from app.engine.pipeline import run
from app.schemas.request import AnalysisRequest
from app.services.climate import _is_leap_year, get_historical_climate_series


def test_percentile_calculations():
    data = [10.0, 20.0, 30.0, 40.0, 50.0]
    assert uncertainty.percentile(data, 0.0) == 10.0
    assert uncertainty.percentile(data, 50.0) == 30.0
    assert uncertainty.percentile(data, 100.0) == 50.0
    assert uncertainty.percentile(data, 10.0) == 14.0
    assert uncertainty.percentile(data, 90.0) == 46.0


def test_summarize_metric_distribution():
    records = [
        {"irrigation_mm": 100.0 + i * 10, "water_stress": 0.1 * i, "salinity_stress": 0.05 * i,
         "heat_days": i, "total_score": 0.5 + 0.02 * i}
        for i in range(15)
    ]
    dist = uncertainty.summarize_metric_distribution(records)
    for p in ("p10", "p50", "p90"):
        assert set(dist[p].keys()) == {"irrigation_mm", "water_stress", "salinity_stress", "heat_days", "total_score"}
    assert dist["p10"]["irrigation_mm"] <= dist["p50"]["irrigation_mm"] <= dist["p90"]["irrigation_mm"]
    assert dist["p10"]["total_score"] <= dist["p50"]["total_score"] <= dist["p90"]["total_score"]


def test_leap_year_handling_in_climate_series():
    assert _is_leap_year(2024) is True
    assert _is_leap_year(2023) is False
    assert _is_leap_year(2000) is True
    assert _is_leap_year(1900) is False

    # Span including Feb 29
    leap_dates = [date(2028, 2, 27) + timedelta(days=i) for i in range(5)]  # Feb 27, 28, 29, Mar 1, Mar 2
    climate, series, evaluated_years = get_historical_climate_series(
        30.79, 31.0, leap_dates, years=[2023, 2024]
    )
    assert len(series) == 2
    for s in series:
        assert len(s) == 5  # Exactly 5 days matching leap_dates length


def test_strategy_uncertainty_contract_and_structure():
    result = run(AnalysisRequest(reference_date=date(2026, 11, 12)))
    assert result["schema_version"] == "1.1.0"
    for s in result["strategies"]:
        u = s["uncertainty"]
        assert 0.0 <= u["rank_stability"] <= 1.0
        assert u["years_evaluated"] == 15
        for p in ("p10", "p50", "p90"):
            metrics = u[p]
            for key in ("irrigation_mm", "water_stress", "salinity_stress", "heat_days", "total_score"):
                assert key in metrics
                assert isinstance(metrics[key], (int, float))
            assert metrics["irrigation_mm"] >= 0.0
            assert 0.0 <= metrics["total_score"] <= 1.0
        assert u["p10"]["total_score"] <= u["p50"]["total_score"] + 1e-6
        assert u["p50"]["total_score"] <= u["p90"]["total_score"] + 1e-6
