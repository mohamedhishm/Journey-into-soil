import time
from datetime import date
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from app.engine.pipeline import run
from app.schemas.request import AnalysisRequest

def main():
    t0 = time.perf_counter()
    res = run(AnalysisRequest(reference_date=date(2026, 11, 1)))
    dt = time.perf_counter() - t0
    print(f"Analysis completed in {dt:.3f} s")
    print(f"Candidates evaluated: {res['candidates_evaluated']}")
    print(f"Strategies: {len(res['strategies'])}")
    for s in res["strategies"]:
        u = s["uncertainty"]
        print(f"  Strategy {s['id']}: rank_stability={u['rank_stability']}, p50_score={u['p50']['total_score']}, p50_irr={u['p50']['irrigation_mm']}")

if __name__ == "__main__":
    main()
