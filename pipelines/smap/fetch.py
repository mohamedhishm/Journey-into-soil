"""Download SMAP enhanced L3 soil moisture (SPL3SMP_E, v006) granules for the demo area.

The product is a *global daily* 9 km EASE-Grid 2.0 composite, so one granule per
day covers every Egyptian demo site. We search CMR over the Egypt bounding box and
download one granule per day (highest revision when a day was reprocessed).

Usage:
    python pipelines/smap/fetch.py --start 2026-11-01 --end 2026-11-11
    python pipelines/smap/fetch.py --start 2026-11-01 --end 2026-11-11 --force

Token: EARTHDATA_TOKEN from the environment or the repo .env (never committed).
Raw granules land in data/raw/smap/granules/ which is git-ignored.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw" / "smap"
GRANULE_DIR = RAW_DIR / "granules"
MANIFEST = RAW_DIR / "smap_fetch_manifest.json"

CMR_URL = "https://cmr.earthdata.nasa.gov/search"
SHORT_NAME = "SPL3SMP_E"
VERSION = "006"  # only version served for this collection (verified via CMR, 2026-11-13)
# Egypt demo area: lon_min, lat_min, lon_max, lat_max
EGYPT_BBOX = "24,22,37,32"


def load_token() -> str:
    """Earthdata bearer token from the environment or .env. Raises if missing."""
    token = os.environ.get("EARTHDATA_TOKEN")
    if token:
        return token.strip().strip('"').strip("'")
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("EARTHDATA_TOKEN="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                if value:
                    return value
    raise RuntimeError("EARTHDATA_TOKEN was not found in the environment or .env")


def search_daily_granules(session: requests.Session, start: str, end: str) -> list[dict]:
    """One granule per day (highest revision) for the demo bounding box."""
    params = {
        "short_name": SHORT_NAME,
        "version": VERSION,
        "bounding_box": EGYPT_BBOX,
        "temporal": (f"{start}T00:00:00Z", f"{end}T23:59:59Z"),
        "page_size": 2000,
        "sort_key[]": "start_date",
    }
    response = session.get(f"{CMR_URL}/granules.json", params=params, timeout=120)
    response.raise_for_status()
    entries = response.json().get("feed", {}).get("entry", [])

    by_day: dict[str, dict] = {}
    for entry in entries:
        title = entry.get("title", "")
        try:
            day = entry["time_start"][:10]
        except (KeyError, TypeError):
            continue
        urls = [
            link["href"]
            for link in entry.get("links", [])
            if str(link.get("rel", "")).endswith("data#") and link.get("href", "").startswith("https")
        ]
        if not urls:
            continue
        revision = title.rsplit("_", 1)[-1]
        candidate = {
            "day": day,
            "title": title,
            "granule_id": entry.get("id"),
            "time_start": entry.get("time_start"),
            "time_end": entry.get("time_end"),
            "size_mb": entry.get("granule_size"),
            "revision": revision,
            "url": urls[0],
        }
        previous = by_day.get(day)
        if previous is None or revision > previous["revision"]:
            by_day[day] = candidate
    return [by_day[day] for day in sorted(by_day)]


def download(session: requests.Session, token: str, url: str, dest: Path) -> bool:
    """Stream one granule to dest. Returns True when the file is present and non-empty."""
    if dest.exists() and dest.stat().st_size > 1_000_000:
        print(f"  cached {dest.name}")
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with session.get(url, headers={"Authorization": f"Bearer {token}"}, stream=True, timeout=600) as response:
        response.raise_for_status()
        with tmp.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1 << 20):
                handle.write(chunk)
    tmp.replace(dest)
    print(f"  saved  {dest.name} ({dest.stat().st_size / 1e6:.0f} MB)")
    return dest.stat().st_size > 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Download SMAP SPL3SMP_E daily granules for Egypt.")
    parser.add_argument("--start", required=True, help="first day, YYYY-MM-DD")
    parser.add_argument("--end", required=True, help="last day, YYYY-MM-DD")
    parser.add_argument("--force", action="store_true", help="re-download granules that already exist")
    args = parser.parse_args()

    token = load_token()
    session = requests.Session()
    session.headers.update({"Accept": "application/json", "Client-Id": "journey-into-soil"})

    print(f"CMR search: {SHORT_NAME} v{VERSION} {args.start}..{args.end} bbox={EGYPT_BBOX}")
    granules = search_daily_granules(session, args.start, args.end)
    if not granules:
        print("No granules matched.")
        return 1
    print(f"{len(granules)} daily granule(s) found")

    downloaded = 0
    for entry in granules:
        dest = GRANULE_DIR / f"{entry['title'].split('_1MM')[0]}.h5"
        if args.force and dest.exists():
            dest.unlink()
        if download(session, token, entry["url"], dest):
            downloaded += 1
            entry["local_file"] = str(dest.relative_to(ROOT)).replace("\\", "/")
            entry["bytes"] = dest.stat().st_size

    manifest = {
        "product": SHORT_NAME,
        "version": VERSION,
        "bbox": EGYPT_BBOX,
        "requested": {"start": args.start, "end": args.end},
        "fetched_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "daily_granules": granules,
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\n{downloaded}/{len(granules)} granules available; manifest -> {MANIFEST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
