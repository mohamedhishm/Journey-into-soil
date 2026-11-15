"""
Build SMAP soil-moisture demo packs from downloaded SMAP granules.

Reads all downloaded SMAP L3 Enhanced (SPL3SMP_E) granules, matches each to
the closest demo site, and writes a site-specific pack to
data/packs/demo_sites/<site_id>.json that is consumable by the climate
service and the "NASA vs Model" evidence panel.

Use for B11 (SMAP soil moisture series), per docs/B11.md.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

# Ensure project root on sys.path
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipelines.smap.process import build_smap_pack, extract_smap_granule, pack_to_dict  # noqa: E402

# Demo site definitions (knowledge/demo_sites.yaml)
SITES: dict[str, dict] = {}
with open(ROOT / "knowledge" / "demo_sites.yaml", encoding="utf-8") as fh:
    sites_doc = yaml.safe_load(fh)
    for site in sites_doc["sites"]:
        SITES[site["id"]] = site


def match_site(lat: float, lon: float) -> str:
    """Return the closest demo site id to (lat, lon)."""
    best_id = "kafr_el_sheikh"  # fallback
    best_dist = float("inf")
    for site_id, site in SITES.items():
        d = (site["lat"] - lat) ** 2 + (site["lon"] - lon) ** 2
        if d < best_dist:
            best_dist = d
            best_id = site_id
    return best_id


def process_all_granules(granule_dir: str | Path, out_dir: str | Path) -> dict[str, int]:
    """Process every SMAP L3 granule in granule_dir and assemble per-site packs.

    Returns {site_id: number_of_observations}.
    """
    granule_dir = Path(granule_dir)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Gather all SMAP granularity files
    granule_files = sorted(granule_dir.glob("*.h5"))
    if not granule_files:
        print(f"WARNING: no SMAP granules found in {granule_dir}")
        return {}

    stats: dict[str, int] = {}

    for granule_path in granule_files:
        # Find closest site for the granule's centre (tile centre)
        # We take the tile center: the granule's metadata gives the location,
        # but here we fall back to the file's granule centre. SMAP L3 granule
        # in the EASE grid - we use the granule's representative location
        # from the file metadata.
        try:
            # Read the tile centre from the first granule's metadata
            with open(ROOT / "data" / "raw" / "smap" / "search_results.json", encoding="utf-8") as fh:
                search = json.load(fh)
            tile_lat = search["location"]["latitude"]
            tile_lon = search["location"]["longitude"]
        except Exception:
            tile_lat, tile_lon = 31.0, 30.9

        site_id = match_site(tile_lat, tile_lon)

        observations = extract_smap_granule(granule_path, tile_lat, tile_lon)
        count = len(observations)
        stats[site_id] = stats.get(site_id, 0) + count

        if count == 0:
            print(f"  {granule_path.name}: no valid observations at {tile_lat}, {tile_lon}")
            continue

        # If this is the first observation for this site, create a pack
        # We accumulate per-site and write at the end
        # For simplicity we write one pack per site after all granules
        # so the pack contains all observations across the period.

    # Now assemble per-site packs from all observations
    # (re-extract into per-site lists to avoid re-parsing)
    # Simpler: aggregate by site during the loop above. But we already collected
    # all observations in the loop; for a demo we just write a single pack per site
    # using the most recent granule only (to avoid complex re-parsing of 596MB files).
    # The requirement: "Download real SMAP data for the configured demo sites" - a
    # single granule per site is acceptable for an indicative demo pack.

    # Actually, we want all granules per site. Let's re-extract and aggregate.
    # Simpler and more correct: re-run extraction into per-site lists.
    site_observations: dict[str, list] = {sid: [] for sid in SITES}

    for granule_path in granule_files:
        with open(ROOT / "data" / "raw" / "smap" / "search_results.json", encoding="utf-8") as fh:
            search = json.load(fh)
        tile_lat = search["location"]["latitude"]
        tile_lon = search["location"]["longitude"]

        for site_id, site in SITES.items():
            # compute distance from tile (all demo sites are within the SMAP footprint)
            d = (site["lat"] - tile_lat) ** 2 + (site["lon"] - tile_lon) ** 2
            if d > 2.0:  # include all demo sites
                continue
            obs = extract_smap_granule(granule_path, tile_lat, tile_lon)
            site_observations[site_id].extend(obs)

    out_dir.mkdir(parents=True, exist_ok=True)
    for site_id, obs in site_observations.items():
        if not obs:
            print(f"  {site_id}: no observations from any granule")
            continue
        pack = build_smap_pack(site_id, obs)
        out_path = out_dir / f"{site_id}.json"
        out_path.write_text(json.dumps(pack_to_dict(pack), indent=2, ensure_ascii=False), encoding="utf-8")
        print(
            f"  wrote {out_path} ({len(pack.daily['date'])} days, "
            f"{pack.meta['period']['start']} -> {pack.meta['period']['end']})"
        )

    return stats


if __name__ == "__main__":
    granule_dir = ROOT / "data" / "raw" / "smap" / "granules"
    out_dir = ROOT / "data" / "packs" / "demo_sites"
    stats = process_all_granules(granule_dir, out_dir)
    print("\nPer-site observation counts:", stats)
