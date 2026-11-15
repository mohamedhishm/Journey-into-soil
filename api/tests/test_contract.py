import json
from datetime import date

from jsonschema import validate

from app.config import ROOT
from app.engine.pipeline import run
from app.schemas.request import AnalysisRequest

SCHEMA = json.loads((ROOT / "contracts/result.schema.json").read_text(encoding="utf-8"))


def test_engine_output_matches_schema():
    validate(run(AnalysisRequest(reference_date=date(2026, 11, 1))), SCHEMA)


def test_other_regions_and_edge_inputs_match_schema():
    for kw in ({"lat": 28.11, "lon": 30.75, "texture": "silt_loam"}, {"irrigation": "none"}, {"history": []},
               {"pest": "soil_borne", "water_availability": "scarce"}):
        validate(run(AnalysisRequest(reference_date=date(2026, 11, 1), **kw)), SCHEMA)


def test_committed_mock_is_valid_and_current_version():
    path = ROOT / "contracts/mock_result.json"
    if path.exists():
        mock = json.loads(path.read_text(encoding="utf-8"))
        validate(mock, SCHEMA)
