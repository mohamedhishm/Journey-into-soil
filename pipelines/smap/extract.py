"""Extract a real SMAP surface soil-moisture series for every demo site.

Each SPL3SMP_E granule is a 600 MB global HDF5 file, but the grid is fixed and stored
one row per chunk, so only a handful of small HTTPS range reads are needed per granule.
This script therefore streams the needed rows from NSIDC instead of downloading whole
files (network throughput to the DAACs measured at 0.2-0.6 MB/s on the demo machine).

Local granules already in data/raw/smap/granules/ are used when present.

Usage:
    python pipelines/smap/extract.py --start 2026-10-25 --end 2026-11-11
    python pipelines/smap/extract.py --start 2026-10-25 --end 2026-11-11 --workers 4 --force

Output: data/raw/smap/observations.json (git-ignored raw extraction, consumed by
build_demo_packs.py).
"""

from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipelines.smap.fetch import GRANULE_DIR, load_token, search_daily_granules  # noqa: E402
from pipelines.smap.process import extract_file, extract_site, reference_grid  # noqa: E402

RAW_DIR = ROOT / "data" / "raw" / "smap"
CACHE_DIR = RAW_DIR / "extracted"
OUTPUT = RAW_DIR / "observations.json"


def demo_sites() -> list[dict]:
    with (ROOT / "knowledge" / "demo_sites.yaml").open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)["sites"]


def cached(granule_name: str) -> list[dict] | None:
    path = CACHE_DIR / f"{granule_name}.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except ValueError:
            return None
    return None


def process_granule(entry: dict, sites: list[dict], token: str, force: bool, attempts: int = 3) -> list[dict]:
    """Return observations for one granule, retrying transient DAAC errors."""
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            return _process_granule_once(entry, sites, token, force)
        except Exception as error:  # noqa: BLE001 - retried below
            last = error
            if attempt + 1 < attempts:
                import time as _time

                _time.sleep(5 * (attempt + 1))
    raise last  # type: ignore[misc]


def _process_granule_once(entry: dict, sites: list[dict], token: str, force: bool) -> list[dict]:
    """Return observations for one granule, reading locally when possible."""
    name = entry["title"].split("_1MM")[0]
    stem = name[:-3] if name.endswith(".h5") else name
    if not force:
        hit = cached(stem)
        if hit is not None:
            return hit

    local = GRANULE_DIR / f"{stem}.h5"
    if local.exists() and local.stat().st_size > 100_000_000:
        observations = [o.to_json() for o in extract_file(local, sites)]
    else:
        import fsspec
        import h5py

        # A fresh filesystem per worker: fsspec caches instances per protocol+options, and a
        # cached aiohttp session shared across threads stalls in practice.
        fs = fsspec.filesystem(
            "http", headers={"Authorization": f"Bearer {token}"}, skip_instance_cache=True
        )
        handle = fs.open(entry["url"], "rb", block_size=256 * 1024)
        try:
            with h5py.File(handle, "r") as h5:
                grid_am = reference_grid(h5, "AM")
                observations = []
                for site in sites:
                    observations.extend(o.to_json() for o in extract_site(h5, site, stem, grid_am))
        finally:
            handle.close()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / f"{stem}.json").write_text(json.dumps(observations), encoding="utf-8")
    return observations


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract SMAP surface soil moisture for demo sites.")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--force", action="store_true", help="ignore the local extraction cache")
    args = parser.parse_args()

    token = load_token()
    session = requests.Session()
    session.headers.update({"Accept": "application/json", "Client-Id": "journey-into-soil"})
    granules = search_daily_granules(session, args.start, args.end)
    if not granules:
        print("No SMAP granules matched the requested period.")
        return 1
    sites = demo_sites()
    print(f"{len(granules)} daily granule(s) x {len(sites)} site(s), {args.workers} workers")

    per_granule: dict[str, list[dict]] = {}
    # Processes, not threads: fsspec's aiohttp HTTP filesystem stalls when its event loop is
    # driven from several threads at once.
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_granule, g, sites, token, args.force): g for g in granules}
        for future in as_completed(futures):
            entry = futures[future]
            try:
                per_granule[entry["title"]] = future.result()
                accepted = sum(1 for o in per_granule[entry["title"]] if o["accepted"])
                print(f"  ok {entry['day']}  {accepted} accepted retrieval(s)")
            except Exception as error:  # noqa: BLE001 - report and continue with other days
                print(f"  FAILED {entry['day']}: {type(error).__name__}: {error}")

    by_site: dict[str, list[dict]] = {site["id"]: [] for site in sites}
    for observations in per_granule.values():
        for obs in observations:
            by_site[obs["site_id"]].append(obs)

    payload = {
        "product": "SPL3SMP_E",
        "version": "006",
        "requested": {"start": args.start, "end": args.end},
        "extracted_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "granules": [{"title": g["title"], "day": g["day"], "url": g["url"]} for g in granules],
        "sites": by_site,
    }
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    for site_id, observations in by_site.items():
        accepted = sum(1 for o in observations if o["accepted"])
        days = len({o["date"] for o in observations if o["accepted"]})
        print(f"{site_id:16s} {len(observations):4d} observations, {accepted:3d} accepted, {days:3d} day(s)")
    print(f"\nwrote {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
