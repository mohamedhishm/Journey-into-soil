"""Fetch SoilGrids data for demo sites with all-null values by searching nearby points."""
from __future__ import annotations

import json
import shutil
import sys
import time
from pathlib import Path

import httpx
import yaml

from pipelines.neighbour_search import (
    SEARCH_OFFSETS,
    SOIL_URL,
    build_soilgrids_params,
    haversine_km,
    is_soil_complete,
)

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

ALREADY_VALID = {"beheira", "new_valley", "nubaria", "port_said", "qalyubia", "south_sinai"}
MAX_REQUESTS = 150
DELAY_SECONDS = 15


STARTING_LOGS = [
    {"site": "cairo", "req": 1, "point": [30.075, 31.25], "offset_km": 2.78, "result": "null"},
    {"site": "cairo", "req": 2, "point": [30.025, 31.25], "offset_km": 2.78, "result": "ReadTimeout"},
    {"site": "cairo", "req": 3, "point": [30.025, 31.25], "offset_km": 2.78, "result": "ReadTimeout"},
    {"site": "cairo", "req": 4, "point": [30.05, 31.275], "offset_km": 2.41, "result": "ReadTimeout"},
    {"site": "cairo", "req": 5, "point": [30.05, 31.275], "offset_km": 2.41, "result": "ReadTimeout"},
    {"site": "cairo", "req": 6, "point": [30.05, 31.225], "offset_km": 2.41, "result": "null"},
    {"site": "cairo", "req": 7, "point": [30.1, 31.25], "offset_km": 5.56, "result": "ReadTimeout"},
    {"site": "cairo", "req": 8, "point": [30.1, 31.25], "offset_km": 5.56, "result": "ReadTimeout"},
    {"site": "cairo", "req": 9, "point": [30.0, 31.25], "offset_km": 5.56, "result": "ReadTimeout"},
    {"site": "cairo", "req": 10, "point": [30.0, 31.25], "offset_km": 5.56, "result": "ReadTimeout"},
    {"site": "cairo", "req": 11, "point": [30.05, 31.3], "offset_km": 4.81, "result": "ReadTimeout"},
    {"site": "cairo", "req": 12, "point": [30.05, 31.3], "offset_km": 4.81, "result": "ReadTimeout"},
    {"site": "cairo", "req": 13, "point": [30.05, 31.2], "offset_km": 4.81, "result": "null"},
    {"site": "cairo", "req": 14, "point": [30.125, 31.25], "offset_km": 8.34, "result": "ReadTimeout"},
    {"site": "cairo", "req": 15, "point": [30.125, 31.25], "offset_km": 8.34, "result": "ReadTimeout"},
    {"site": "cairo", "req": 16, "point": [29.975, 31.25], "offset_km": 8.34, "result": "null"},
    {"site": "cairo", "req": 17, "point": [30.05, 31.325], "offset_km": 7.22, "result": "ReadTimeout"},
    {"site": "cairo", "req": 18, "point": [30.05, 31.325], "offset_km": 7.22, "result": "interrupted"},
    {"site": "cairo", "req": 19, "point": [30.05, 31.3], "offset_km": 4.81, "result": "success_verified"},
]


def run_fetch(
    raw_dir: Path | None = None,
    sites_yaml: Path | None = None,
    max_requests: int = MAX_REQUESTS,
    delay: float = DELAY_SECONDS,
    client: httpx.Client | None = None,
    initial_requests: int = 19,
) -> dict:
    raw_dir = raw_dir or (ROOT / "data" / "raw" / "soilgrids")
    sites_yaml = sites_yaml or (ROOT / "knowledge" / "demo_sites.yaml")

    sites = yaml.safe_load(sites_yaml.read_text(encoding="utf-8"))["sites"]

    # Ensure metadata for the 6 untouched valid sites
    for s in sites:
        if s["id"] in ALREADY_VALID:
            meta_p = raw_dir / f"{s['id']}.meta.json"
            if not meta_p.exists():
                meta_p.write_text(
                    json.dumps(
                        {
                            "id": s["id"],
                            "site_lat": s["lat"],
                            "site_lon": s["lon"],
                            "sample_lat": s["lat"],
                            "sample_lon": s["lon"],
                            "offset_km": 0.0,
                            "source": "soilgrids_250m_model",
                            "depth": "0-5cm",
                        },
                        indent=2,
                    ),
                    encoding="utf-8",
                )

    request_count = initial_requests
    logs: list[dict] = list(STARTING_LOGS) if initial_requests == 19 else []
    resolved: list[str] = []
    still_missing: list[str] = []
    stopped_by_cap = False

    close_client = False
    if client is None:
        client = httpx.Client(timeout=httpx.Timeout(connect=30.0, read=180.0, write=30.0, pool=30.0))
        close_client = True

    try:
        for s in sites:
            sid = s["id"]
            if sid in ALREADY_VALID:
                continue

            raw_file = raw_dir / f"{sid}.json"
            orig_null = raw_dir / f"{sid}.original_null.json"
            meta_file = raw_dir / f"{sid}.meta.json"

            # Check resumability: if already resolved and valid with meta, skip
            if orig_null.exists() and raw_file.exists() and meta_file.exists():
                try:
                    cur_data = json.loads(raw_file.read_text(encoding="utf-8"))
                    if is_soil_complete(cur_data):
                        print(f"[{sid}] Already resolved previously; skipping.")
                        resolved.append(sid)
                        continue
                except (json.JSONDecodeError, OSError):
                    print(f"[{sid}] Error reading existing file, will recheck.")

            # If raw file exists and is null, ensure original_null.json exists
            if raw_file.exists() and not orig_null.exists():
                shutil.copyfile(raw_file, orig_null)

            print(f"\n[{sid}] Starting neighbour search around lat={s['lat']}, lon={s['lon']}...")
            site_found = False

            for d_lat, d_lon in SEARCH_OFFSETS:
                if request_count >= max_requests:
                    print(f"HARD CAP REACHED ({max_requests} requests). Stopping.")
                    stopped_by_cap = True
                    break

                q_lat = round(s["lat"] + d_lat, 4)
                q_lon = round(s["lon"] + d_lon, 4)
                dist_km = haversine_km(s["lat"], s["lon"], q_lat, q_lon)
                params = build_soilgrids_params(q_lat, q_lon)

                # Attempt query with up to 1 retry
                data = None
                query_status = "error"
                for attempt in range(1, 3):
                    if request_count >= max_requests:
                        stopped_by_cap = True
                        break
                    request_count += 1
                    print(
                        f"  Req #{request_count}/{max_requests} for {sid}: offset ({d_lat:+.3f}, {d_lon:+.3f}) -> ({q_lat}, {q_lon}) dist={dist_km}km [try {attempt}]...",
                        end=" ",
                        flush=True,
                    )
                    try:
                        resp = client.get(SOIL_URL, params=params)
                        resp.raise_for_status()
                        data = resp.json()
                        break
                    except (httpx.HTTPError, json.JSONDecodeError, OSError) as exc:
                        print(f"[{type(exc).__name__}]", end=" ", flush=True)
                        if attempt == 1 and request_count < max_requests:
                            time.sleep(5)
                        else:
                            break

                if stopped_by_cap:
                    break

                if data and is_soil_complete(data):
                    query_status = "success"
                    print("VALID SOIL FOUND!")
                    # Save sidecar metadata
                    meta = {
                        "id": sid,
                        "site_lat": s["lat"],
                        "site_lon": s["lon"],
                        "sample_lat": q_lat,
                        "sample_lon": q_lon,
                        "offset_km": dist_km,
                        "source": "soilgrids_250m_model",
                        "depth": "0-5cm",
                    }
                    meta_file.write_text(json.dumps(meta, indent=2), encoding="utf-8")
                    # Add sidecar fields inside payload as well
                    data["sample_lat"] = q_lat
                    data["sample_lon"] = q_lon
                    data["offset_km"] = dist_km
                    raw_file.write_text(json.dumps(data, indent=2), encoding="utf-8")

                    logs.append({"site": sid, "req": request_count, "point": (q_lat, q_lon), "offset_km": dist_km, "result": "success"})
                    site_found = True
                    resolved.append(sid)
                    # Save progress
                    summary = {
                        "requests_made": request_count,
                        "max_requests": max_requests,
                        "stopped_by_cap": stopped_by_cap,
                        "resolved_count": len(resolved),
                        "resolved_sites": resolved,
                        "missing_count": len(still_missing),
                        "missing_sites": still_missing,
                        "logs": logs,
                    }
                    (raw_dir / "fetch_log.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
                    print(f"  Waiting {delay}s...")
                    time.sleep(delay)
                    break
                else:
                    query_status = "null" if data else "error"
                    print("null or error.")
                    logs.append({"site": sid, "req": request_count, "point": (q_lat, q_lon), "offset_km": dist_km, "result": query_status})
                    # Save progress
                    summary = {
                        "requests_made": request_count,
                        "max_requests": max_requests,
                        "stopped_by_cap": stopped_by_cap,
                        "resolved_count": len(resolved),
                        "resolved_sites": resolved,
                        "missing_count": len(still_missing),
                        "missing_sites": still_missing,
                        "logs": logs,
                    }
                    (raw_dir / "fetch_log.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
                    print(f"  Waiting {delay}s...")
                    time.sleep(delay)

            if not site_found:
                still_missing.append(sid)
                if stopped_by_cap:
                    break

        # Check remaining sites if stopped early
        for s in sites:
            if s["id"] not in ALREADY_VALID and s["id"] not in resolved and s["id"] not in still_missing:
                still_missing.append(s["id"])

    finally:
        if close_client:
            client.close()

    summary = {
        "requests_made": request_count,
        "max_requests": max_requests,
        "stopped_by_cap": stopped_by_cap,
        "resolved_count": len(resolved),
        "resolved_sites": resolved,
        "missing_count": len(still_missing),
        "missing_sites": still_missing,
        "logs": logs,
    }
    (raw_dir / "fetch_log.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    res = run_fetch()
    print("\n=== Summary ===")
    print(f"Requests made: {res['requests_made']}/{res['max_requests']}")
    print(f"Resolved ({res['resolved_count']}): {', '.join(res['resolved_sites'])}")
    if res["missing_sites"]:
        print(f"Missing ({res['missing_count']}): {', '.join(res['missing_sites'])}")
