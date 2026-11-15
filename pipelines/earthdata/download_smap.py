import argparse
import os
from pathlib import Path

import earthaccess

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / ".env"

PRODUCT = "SPL3SMP_E"
VERSION = "006"

DEFAULT_LAT = 31.11
DEFAULT_LON = 30.94
DEFAULT_DATE = "2026-11-11"

OUTPUT_DIR = ROOT / "data" / "raw" / "smap" / "granules"


def load_token():
    if os.environ.get("EARTHDATA_TOKEN"):
        return

    if not ENV_FILE.exists():
        raise RuntimeError("EARTHDATA_TOKEN was not found in environment or .env")

    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()

        if line.startswith("EARTHDATA_TOKEN="):
            token = line.split("=", 1)[1].strip().strip('"').strip("'")

            if token:
                os.environ["EARTHDATA_TOKEN"] = token
                return

    raise RuntimeError("EARTHDATA_TOKEN was not found in .env")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=DEFAULT_DATE)
    args = parser.parse_args()

    load_token()

    print("Logging in to NASA Earthdata...")
    earthaccess.login(strategy="environment")

    print(f"Searching {PRODUCT} for {args.date}...")

    granules = earthaccess.search_data(
        short_name=PRODUCT,
        version=VERSION,
        point=(DEFAULT_LON, DEFAULT_LAT),
        temporal=(
            f"{args.date}T00:00:00",
            f"{args.date}T23:59:59",
        ),
        count=10,
    )

    if not granules:
        raise RuntimeError(f"No SMAP granules found for {args.date}")

    print(f"Found {len(granules)} matching granule(s).")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Downloading the first matching granule...")
    downloaded = earthaccess.download(
        [granules[0]],
        local_path=str(OUTPUT_DIR),
        threads=1,
    )

    if not downloaded:
        raise RuntimeError("Download did not return any files.")

    print("\nDownload result:")
    for file_path in downloaded:
        print(file_path)

    print("\nSMAP download completed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}")
        raise SystemExit(1) from error
