
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]

CMR_URL = "https://cmr.earthdata.nasa.gov/search"
PRODUCT = "SPL3SMP_E"
VERSION = "006"

DEFAULT_LAT = 31.11
DEFAULT_LON = 30.94
DEFAULT_OUTPUT = ROOT / "data" / "raw" / "smap" / "search_results.json"


def search_collection(session: requests.Session) -> dict:
    response = session.get(
        f"{CMR_URL}/collections.json",
        params={
            "short_name": PRODUCT,
            "version": VERSION,
            "page_size": 20,
        },
        timeout=30,
    )
    response.raise_for_status()

    entries = response.json().get("feed", {}).get("entry", [])

    if not entries:
        raise RuntimeError(
            f"Collection {PRODUCT}, version {VERSION} was not found."
        )

    return entries[0]


def search_granules(
    session: requests.Session,
    lat: float,
    lon: float,
    limit: int,
) -> list[dict]:
    response = session.get(
        f"{CMR_URL}/granules.json",
        params={
            "short_name": PRODUCT,
            "version": VERSION,
            "point": f"{lon},{lat}",
            "sort_key[]": "-start_date",
            "page_size": min(limit, 2000),
            "page_num": 1,
        },
        timeout=60,
    )
    response.raise_for_status()

    entries = response.json().get("feed", {}).get("entry", [])

    granules = []

    for item in entries:
        links = []

        for link in item.get("links", []):
            href = link.get("href", "")

            if not href:
                continue

            links.append({
                "href": href,
                "rel": link.get("rel"),
                "title": link.get("title"),
                "type": link.get("type"),
            })

        granules.append({
            "granule_id": item.get("id"),
            "title": item.get("title"),
            "producer_granule_id": item.get(
                "producer_granule_id"
            ),
            "start_time": item.get("time_start"),
            "end_time": item.get("time_end"),
            "collection_concept_id": item.get(
                "collection_concept_id"
            ),
            "size_mb": item.get("granule_size"),
            "links": links,
        })

    return granules


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Search NASA SMAP SPL3SMP_E granules."
    )

    parser.add_argument("--lat", type=float, default=DEFAULT_LAT)
    parser.add_argument("--lon", type=float, default=DEFAULT_LON)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
    )

    args = parser.parse_args()

    if not -90 <= args.lat <= 90:
        parser.error("Latitude must be between -90 and 90.")

    if not -180 <= args.lon <= 180:
        parser.error("Longitude must be between -180 and 180.")

    if args.limit < 1:
        parser.error("Limit must be at least 1.")

    print("=" * 55)
    print("Journey Into the Soil - NASA SMAP Search")
    print("=" * 55)

    print(f"Product: {PRODUCT}")
    print(f"Version: {VERSION}")
    print(f"Location: {args.lat}, {args.lon}")

    session = requests.Session()
    session.headers.update({
        "Accept": "application/json",
        "Client-Id": "journey-into-soil",
    })

    try:
        print("\n[1/2] Searching NASA Collection...")

        collection = search_collection(session)

        print("Collection found!")
        print(f"Title: {collection.get('entry_title')}")
        print(f"Concept ID: {collection.get('id')}")

        print("\n[2/2] Searching matching Granules...")

        granules = search_granules(
            session,
            args.lat,
            args.lon,
            args.limit,
        )

        print(f"\nMatching granules: {len(granules)}")

        for index, granule in enumerate(granules, start=1):
            print(f"\n{index}. {granule['title']}")
            print(f"   Start: {granule['start_time']}")
            print(f"   End: {granule['end_time']}")
            print(f"   Size: {granule['size_mb']} MB")

        result = {
            "product": PRODUCT,
            "version": VERSION,
            "collection_concept_id": collection.get("id"),
            "location": {
                "latitude": args.lat,
                "longitude": args.lon,
            },
            "search_time_utc": datetime.now(
                timezone.utc
            ).isoformat(),
            "granule_count": len(granules),
            "granules": granules,
        }

        args.output.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        args.output.write_text(
            json.dumps(result, indent=2),
            encoding="utf-8",
        )

        print("\n" + "=" * 55)
        print("Search completed.")
        print(f"Results saved to: {args.output}")
        print("=" * 55)

        if not granules:
            print(
                "WARNING: No matching granules were found."
            )

        return 0

    except requests.RequestException as exc:
        print(f"\nNETWORK ERROR: {exc}")
        return 1

    except (RuntimeError, ValueError, KeyError) as exc:
        print(f"\nDATA ERROR: {exc}")
        return 1

    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
