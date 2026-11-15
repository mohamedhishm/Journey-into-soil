
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / ".env"

CMR_URL = "https://cmr.earthdata.nasa.gov/search"
PRODUCTS = ["SPL3SMP_E", "GPM_3IMERGDF"]


def load_token() -> str | None:
    """Read EARTHDATA_TOKEN from environment or the local .env file."""
    token = os.environ.get("EARTHDATA_TOKEN")

    if token:
        return token.strip().strip('"').strip("'")

    if not ENV_FILE.exists():
        return None

    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()

        if line.startswith("EARTHDATA_TOKEN="):
            value = line.split("=", 1)[1].strip()
            return value.strip('"').strip("'") or None

    return None





def cmr_get(endpoint: str, params: dict) -> requests.Response:
    headers = {
        "Accept": "application/json",
        "Client-Id": "journey-into-soil",
    }

    response = requests.get(
        f"{CMR_URL}/{endpoint}.json",
        headers=headers,
        params=params,
        timeout=30,
    )

    if response.status_code in (401, 403):
        raise PermissionError(
            f"CMR rejected the request (HTTP {response.status_code}). "
            "Check the token and Earthdata permissions."
        )

    response.raise_for_status()
    return response


def version_key(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in re.findall(r"\d+", version))


def search_product(
    short_name: str,
    lat: float,
    lon: float,
) -> None:
    print(f"\nProduct: {short_name}")

    collection_response = cmr_get(
        "collections",
        {
            "short_name": short_name,
            "page_size": 200,
        },
    )

    collections = collection_response.json().get("feed", {}).get("entry", [])

    if not collections:
        print("  No matching collections found.")
        return

    versions = sorted(
        {
            item.get("version_id", "")
            for item in collections
            if item.get("version_id")
        },
        key=version_key,
    )
    if not versions:
        print("  No version information found.")
        return

    print(f"  Available versions: {', '.join(versions)}")

    latest_version = versions[-1]
    print(f"  Searching latest listed version: {latest_version}")

    granule_response = cmr_get(
        "granules",
        {
            "short_name": short_name,
            "version": latest_version,
            "point": f"{lon},{lat}",
            "sort_key[]": "-start_date",
            "page_size": 5,
        },
    )

    granules = granule_response.json().get("feed", {}).get("entry", [])

    cmr_total = granule_response.headers.get("CMR-Hits", "unknown")
    print(f"  Total matching granules: {cmr_total}")
    print(f"  Granules displayed: {len(granules)}")

    for granule in granules:
        print(f"    - {granule.get('title', 'Unknown granule')}")
        print(f"      ID: {granule.get('id', 'N/A')}")
        print(f"      Start: {granule.get('time_start', 'N/A')}")




def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check NASA Earthdata CMR access for demo-site products."
    )
    parser.add_argument("--lat", type=float, default=31.11)
    parser.add_argument("--lon", type=float, default=30.94)
    args = parser.parse_args()


    lat, lon = args.lat, args.lon

    print("Journey Into the Soil - Earthdata Access Check")
    print(f"Demo location: lat={lat}, lon={lon}")

    try:
        for product in PRODUCTS:
            search_product(product, lat, lon)

    except PermissionError as exc:
        print(f"\nACCESS ERROR: {exc}")
        return 1

    except requests.RequestException as exc:
        print(f"\nNETWORK ERROR: {exc}")
        return 1

    except (KeyError, ValueError, IndexError) as exc:
        print(f"\nDATA ERROR: Unexpected CMR response: {exc}")
        return 1

    print("\nCMR search completed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
