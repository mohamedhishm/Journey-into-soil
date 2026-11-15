#!/usr/bin/env python3
"""Generate contracts/mock_result.json from the REAL engine + sim (not hand-written), and validate it against the schema.

Usage: python scripts/make_mock_result.py            (from the repo root, venv active)
Frontend work can then start from fixtures without waiting for the API.
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from app.engine.pipeline import run
from app.schemas.request import AnalysisRequest
from jsonschema import validate


def main() -> None:
    result = run(AnalysisRequest(reference_date=date(2026, 11, 1)))
    schema = json.loads((ROOT / "contracts" / "result.schema.json").read_text(encoding="utf-8"))
    validate(result, schema)
    out = ROOT / "contracts" / "mock_result.json"
    out.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.0f} KB, {len(result['strategies'])} strategies)")


if __name__ == "__main__":
    main()
