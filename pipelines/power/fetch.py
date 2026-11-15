"""Fetch daily agroclimatology from NASA POWER API for demo sites.

No authentication required.
Output raw responses to data/raw/power/<site_id>.json.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

import requests
import yaml

logger = logging.getLogger(__name__)

POWER_DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
DEFAULT_PARAMETERS = ["T2M_MAX", "T2M_MIN", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "RH2M", "WS2M"]
ROOT_DIR = Path(__file__).resolve().parents[2]
DEMO_SITES_PATH = ROOT_DIR / "knowledge" / "demo_sites.yaml"
DEFAULT_OUT_DIR = ROOT_DIR / "data" / "raw" / "power"


def load_demo_sites(path: Path = DEMO_SITES_PATH) -> list[dict[str, Any]]:
    """Load demo site definitions from knowledge base."""
    if not path.exists():
        raise FileNotFoundError(f"Demo sites file not found: {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data.get("sites", [])


def fetch_site_power(
    lat: float,
    lon: float,
    start: str = "20000101",
    end: str = "20251231",
    parameters: list[str] | None = None,
    session: requests.Session | None = None,
    timeout: int = 60,
    max_retries: int = 3,
) -> dict[str, Any]:
    """Fetch daily POWER data for a single coordinate."""
    params_list = parameters or DEFAULT_PARAMETERS
    query = {
        "parameters": ",".join(params_list),
        "community": "AG",
        "longitude": round(lon, 4),
        "latitude": round(lat, 4),
        "start": start,
        "end": end,
        "format": "JSON",
    }
    http = session or requests.Session()

    for attempt in range(1, max_retries + 1):
        try:
            logger.info("Requesting NASA POWER for lat=%.4f, lon=%.4f (attempt %d/%d)", lat, lon, attempt, max_retries)
            resp = http.get(POWER_DAILY_URL, params=query, timeout=timeout)
            if resp.status_code == 200:
                payload = resp.json()
                if "properties" in payload and "parameter" in payload["properties"]:
                    return payload
                raise ValueError(f"Incomplete POWER payload received for ({lat}, {lon})")
            if resp.status_code in (429, 500, 502, 503, 504):
                logger.warning("NASA POWER returned HTTP %d, retrying after backoff...", resp.status_code)
                time.sleep(2 * attempt)
                continue
            resp.raise_for_status()
        except (requests.RequestException, ValueError) as err:
            if attempt == max_retries:
                logger.error("Failed to fetch POWER data for (%.4f, %.4f): %s", lat, lon, err)
                raise
            time.sleep(2 * attempt)

    raise RuntimeError(f"Exhausted retries fetching POWER data for ({lat}, {lon})")


def fetch_all_sites(
    sites: list[dict[str, Any]],
    out_dir: Path = DEFAULT_OUT_DIR,
    start: str = "20000101",
    end: str = "20251231",
    force: bool = False,
    pause_sec: float = 1.0,
) -> dict[str, Path]:
    """Fetch and cache POWER data for all specified sites."""
    out_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, Path] = {}
    session = requests.Session()

    for site in sites:
        site_id = site["id"]
        out_file = out_dir / f"{site_id}.json"
        if out_file.exists() and not force:
            logger.info("Site '%s' already cached at %s, skipping", site_id, out_file)
            results[site_id] = out_file
            continue

        lat, lon = float(site["lat"]), float(site["lon"])
        data = fetch_site_power(lat=lat, lon=lon, start=start, end=end, session=session)
        out_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
        logger.info("Saved %s to %s", site_id, out_file)
        results[site_id] = out_file

        if pause_sec > 0:
            time.sleep(pause_sec)

    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch daily NASA POWER agroclimatology for demo sites")
    parser.add_argument("--start", default="20000101", help="Start date in YYYYMMDD (default: 20000101)")
    parser.add_argument("--end", default="20251231", help="End date in YYYYMMDD (default: 20251231)")
    parser.add_argument("--site", action="append", help="Specific site ID(s) to fetch (default: all)")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Output directory for raw JSON")
    parser.add_argument("--force", action="store_true", help="Overwrite existing cached files")
    parser.add_argument("--pause", type=float, default=1.0, help="Pause in seconds between requests")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    sites = load_demo_sites()
    if args.site:
        selected_ids = set(args.site)
        sites = [s for s in sites if s["id"] in selected_ids]
        if not sites:
            logger.error("No matching sites found for: %s", args.site)
            return 1

    logger.info("Fetching NASA POWER data for %d site(s)...", len(sites))
    fetch_all_sites(
        sites=sites,
        out_dir=args.out_dir,
        start=args.start,
        end=args.end,
        force=args.force,
        pause_sec=args.pause,
    )
    logger.info("Finished fetching NASA POWER data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
