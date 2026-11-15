"""Download raw NASA POWER weather and ISRIC SoilGrids soil data for demo sites.

Run from the repo root:
    python knowledge/pipelines/fetch_raw_data.py

Existing output files are skipped. Delete a file manually if you want to fetch it again.

Outputs:
    data/raw/power/<site_id>.json
    data/raw/soilgrids/<site_id>.json
"""
import json
import time
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parents[2]
SITES = yaml.safe_load(
    (ROOT / "knowledge" / "demo_sites.yaml").read_text(encoding="utf-8")
)["sites"]

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
POWER_PARAMS = "T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,WS2M"
START, END = "20000101", "20251231"

SOIL_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
SOIL_PROPS = ["sand", "silt", "clay", "soc", "phh2o", "bdod", "wv0033", "wv1500"]
SOIL_DEPTHS = ["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm"]


def fetch_power(client: httpx.Client, site: dict) -> None:
    out = ROOT / "data" / "raw" / "power" / f"{site['id']}.json"
    if out.exists():
        print(f"[power] {site['id']}: already exists; skipped")
        return

    params = {
        "parameters": POWER_PARAMS,
        "community": "AG",
        "longitude": site["lon"],
        "latitude": site["lat"],
        "start": START,
        "end": END,
        "format": "JSON",
    }

    response = client.get(POWER_URL, params=params, timeout=120)
    response.raise_for_status()
    data = response.json()

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data), encoding="utf-8")

    units = data.get("parameters", {})
    print(f"[power] {site['id']}: saved. Units:")
    for key in POWER_PARAMS.split(","):
        print(f"    {key}: {units.get(key, {}).get('units', '?')}")


def fetch_soilgrids(client: httpx.Client, site: dict) -> None:
    out = ROOT / "data" / "raw" / "soilgrids" / f"{site['id']}.json"
    if out.exists():
        print(f"[soilgrids] {site['id']}: already exists; skipped")
        return

    params = [("lon", site["lon"]), ("lat", site["lat"])]
    params += [("property", prop) for prop in SOIL_PROPS]
    params += [("depth", depth) for depth in SOIL_DEPTHS]
    params += [("value", value) for value in ("mean", "Q0.05", "Q0.95")]

    response = client.get(SOIL_URL, params=params, timeout=300)
    response.raise_for_status()
    data = response.json()

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data), encoding="utf-8")
    print(f"[soilgrids] {site['id']}: saved")


def fetch_with_retries(client: httpx.Client, fn, site: dict) -> None:
    for attempt in range(1, 4):
        try:
            fn(client, site)
            return
        except httpx.HTTPError as exc:
            print(f"  attempt {attempt}/3 for {fn.__name__} {site['id']} failed: {exc}")
            if attempt < 3:
                time.sleep(15)

    print(f"  [failed] {fn.__name__} {site['id']}: gave up after 3 attempts")


def main() -> None:
    with httpx.Client() as client:
        for site in SITES:
 
            fetch_with_retries(client, fetch_power, site)
            fetch_with_retries(client, fetch_soilgrids, site)

            time.sleep(15)


if __name__ == "__main__":
    main()
