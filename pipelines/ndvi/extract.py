"""Extract real NDVI series for every demo site from VNP13A1 v002 granules.

Remote granules are streamed with HTTPS range reads (only the needed rows of the
500 m grid), because full downloads run at 0.2-0.6 MB/s on the demo machine.

Usage:
    python pipelines/ndvi/extract.py --start 2025-11-01 --end 2026-11-10
    python pipelines/ndvi/extract.py --start 2025-11-01 --end 2026-11-10 --workers 4 --force

Output: data/raw/ndvi/observations.json
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

from pipelines.ndvi.process import extract_site  # noqa: E402
from pipelines.smap.fetch import load_token  # noqa: E402

CMR_URL = "https://cmr.earthdata.nasa.gov/search"
SHORT_NAME = "VNP13A1"
VERSION = "002"  # only version served for this collection (verified via CMR, 2026-11-13)
RAW_DIR = ROOT / "data" / "raw" / "ndvi"
GRANULE_DIR = RAW_DIR / "granules"
CACHE_DIR = RAW_DIR / "extracted"
OUTPUT = RAW_DIR / "observations.json"


def demo_sites() -> list[dict]:
    with (ROOT / "knowledge" / "demo_sites.yaml").open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)["sites"]


def search_granules(session: requests.Session, sites: list[dict], start: str, end: str) -> list[dict]:
    """All granules needed by any demo site in the period, one entry per granule title."""
    found: dict[str, dict] = {}
    for site in sites:
        response = session.get(
            f"{CMR_URL}/granules.json",
            params={
                "short_name": SHORT_NAME,
                "version": VERSION,
                "point": f"{site['lon']},{site['lat']}",
                "temporal": (f"{start}T00:00:00Z", f"{end}T23:59:59Z"),
                "page_size": 200,
                "sort_key[]": "start_date",
            },
            timeout=120,
        )
        response.raise_for_status()
        for entry in response.json().get("feed", {}).get("entry", []):
            title = entry.get("title")
            urls = [
                link["href"]
                for link in entry.get("links", [])
                if str(link.get("rel", "")).endswith("data#") and link.get("href", "").startswith("https")
            ]
            if not title or title in found or not urls:
                continue
            found[title] = {
                "title": title,
                "day": (entry.get("time_start") or "")[:10],
                "url": urls[0],
                "size_mb": entry.get("granule_size"),
            }
    return [found[title] for title in sorted(found)]


def process_granule(entry: dict, sites: list[dict], token: str, force: bool, attempts: int = 3) -> list[dict]:
    """Extract one granule, retrying transient DAAC gateway errors."""
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
    name = entry["title"]
    if not force:
        cache = CACHE_DIR / f"{name}.json"
        if cache.exists():
            try:
                return json.loads(cache.read_text(encoding="utf-8"))
            except ValueError:
                pass

    import fsspec
    import h5py

    local = GRANULE_DIR / f"{name}.h5"
    if local.exists() and local.stat().st_size > 1_000_000:
        with h5py.File(local, "r") as handle:
            observations = [extract_site(handle, s, name).to_json() for s in sites]
    else:
        # Fresh filesystem per worker (see pipelines/smap/extract.py for why).
        fs = fsspec.filesystem(
            "http", headers={"Authorization": f"Bearer {token}"}, skip_instance_cache=True
        )
        handle = fs.open(entry["url"], "rb", block_size=256 * 1024)
        try:
            with h5py.File(handle, "r") as h5:
                observations = [extract_site(h5, s, name).to_json() for s in sites]
        finally:
            handle.close()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / f"{name}.json").write_text(json.dumps(observations), encoding="utf-8")
    return observations


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract NDVI for the demo sites.")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="only the first N granules (smoke test)")
    args = parser.parse_args()

    token = load_token()
    session = requests.Session()
    session.headers.update({"Accept": "application/json", "Client-Id": "journey-into-soil"})
    sites = demo_sites()
    granules = search_granules(session, sites, args.start, args.end)
    if args.limit:
        granules = granules[: args.limit]
    if not granules:
        print("No NDVI granules matched.")
        return 1
    print(f"{len(granules)} granule(s) x {len(sites)} site(s), {args.workers} workers")

    results: list[dict] = []
    # Processes, not threads: fsspec's aiohttp HTTP filesystem stalls when its event loop is
    # driven from several threads at once.
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_granule, g, sites, token, args.force): g for g in granules}
        for future in as_completed(futures):
            entry = futures[future]
            try:
                observations = future.result()
                results.extend(observations)
                ok = sum(1 for o in observations if o["accepted"])
                print(f"  ok {entry['day']} {ok}/{len(observations)} accepted")
            except Exception as error:  # noqa: BLE001 - report and continue
                print(f"  FAILED {entry['day']}: {type(error).__name__}: {error}")

    by_site: dict[str, list[dict]] = {site["id"]: [] for site in sites}
    for obs in results:
        by_site[obs["site_id"]].append(obs)

    payload = {
        "product": SHORT_NAME,
        "version": VERSION,
        "requested": {"start": args.start, "end": args.end},
        "extracted_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "granules": [{"title": g["title"], "day": g["day"], "url": g["url"]} for g in granules],
        "sites": by_site,
    }
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    for site_id, observations in by_site.items():
        accepted = [o for o in observations if o["accepted"]]
        print(f"{site_id:16s} {len(observations):3d} composites, {len(accepted):3d} accepted")
    print(f"\nwrote {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
