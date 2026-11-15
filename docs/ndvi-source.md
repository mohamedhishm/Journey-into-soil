# NDVI source: why VNP13A1, and what the series can and cannot say

Everything here was checked against CMR metadata and the product files themselves on 2026-11-13;
nothing is quoted from memory.

## Candidate products (versions confirmed through CMR)

| Product | Version | Resolution | Format | Verdict |
|---|---|---|---|---|
| `MOD13Q1` (Terra MODIS 16-day VI) | 061 | 250 m | HDF4 | Rejected: needs `pyhdf`/HDF4 system libraries (not installable in this Windows + Python 3.14 environment) and granules are ~129 MB while the DAAC delivered 0.2–0.6 MB/s. |
| `HLSL30` / `HLSS30` (Harmonized Landsat Sentinel-2) | 2.0 | 30 m | GeoTIFF | Preferred on resolution, rejected on cost: about 7 GB of tiles per site-year at the measured throughput is not a demo-sized job. |
| `VNP13A1` (VIIRS/NPP 16-day VI, 500 m SIN grid) | 002 | 500 m | HDF5 | **Chosen.** `h5py` reads it directly, ~56 MB per granule, documented pixel-reliability layer, and the 16-day compositing removes most cloud gaps. |

AppEEARS would have been the easiest path for point samples, but the `EARTHDATA_USERNAME` /
`EARTHDATA_PASSWORD` in `.env` are empty and the bearer token alone is refused (403), so the pipeline
reads LP DAAC granules directly instead.

## Fields read (from the files, not from a summary)

Grid `HDFEOS/GRIDS/VIIRS_Grid_16Day_VI_500m`:

- `500 m 16 days NDVI`: `int16`, `scale_factor` 0.0001, `add_offset` 0, `valid_range` −10000…10000,
  fill values −15000 / −13000.
- `500 m 16 days pixel reliability`: 0 excellent, 1 good, 2 acceptable, 3 marginal, 4 pass,
  5 questionable, 6 poor, 7 cloud shadow, 8 snow/ice, 9 cloud, 10 estimated, 11 long-term average,
  −1 no data, −4 water. Only **0–2** are accepted.
- `500 m 16 days VI Quality`: MODLAND_QA bits 0–1 (00 = VI produced with good quality) and
  VI usefulness bits 2–5 (0000 = highest quality). Snow/ice (bit 14) is rejected.

## Geometry

The grid is the GCTP sinusoidal used by HDF-EOS: `y = R·φ`, `x = R·λ·cos(φ)`, with `φ`,`λ` in radians
and `R = 6371007.181 m` from the granule's `StructMetadata` (`ProjParams`). The file itself settles it:
tile `h20v06` documents `NorthBoundingCoord = 30.0` and `UpperLeftPointMtrs y = 3,335,851`, which is
`R·radians(30°)`, not `R·sin(30°) = 3,185,504`. The `R·sin` form (a tempting "more spherical"
reading) pushes a site in the Delta into the neighbouring tile about 130 km south, where NDVI reads
~0.10 all year instead of the 0.4–0.7 that farmland shows; it is pinned by a unit test.

Two guards keep a wrong pixel out of the series:

- every record carries the distance between the site and the pixel it was read from, and a record
  whose nearest valid pixel is more than **1 km** away is rejected (`nearest_pixel_too_far`) — this is
  what discards granules of the tile that only touches the site's corner;
- `dedupe_by_composite` keeps one record per composite period (accepted first, then closest pixel,
  then best reliability), because overlapping SIN tiles report the same composite repeatedly.

Sanity probes on one July granule with this geometry: Cairo city 0.12, western desert 0.05,
Sharqia farmland 0.72 — the values the product is expected to give.

## The site pixel versus the region

The demo-site coordinates are governorate centres, so the 500 m pixel at the site is often the town
itself (NDVI ≈ 0.12) rather than farmland. The pack therefore carries two series per site:

- `series` — the single pixel at the site, honest but often urban;
- `regional_series` — median (plus p25/p75 and vegetated fraction) of usable 500 m pixels in a ~15 km
  box around the site, labelled "regional median, not the field".

`timeline_check` runs on the regional series (and records `basis`), because a town-centre pixel
cannot show a crop calendar. Neither series is a field measurement.

## What the series may be used for

- Vegetation greenness and canopy condition over time, at 500 m (one pixel ≈ 25 ha, many fields).
- A sanity check on whether the expected crop calendar (from the demo-site preset history plus
  `knowledge/season_windows.yaml`) is compatible with the observed green-up / fallow pattern.

What it may **not** be used for: soil health, fertility, crop identity, yield, or a field-level
statement. `timeline_check` therefore stays `uncertain` for every composite unless the median NDVI
of expected crop periods and expected fallow periods separate by at least 0.10; in the Nile Delta
the 500 m pixel mixes irrigated fields, so this is the normal outcome and is reported as such.

## Reproducing

```bash
python pipelines/ndvi/extract.py --start 2025-11-01 --end 2026-11-10 --workers 5 --force
python pipelines/packs/build_demo_packs.py
```

Outputs: `data/raw/ndvi/observations.json` (raw, gitignored) and `data/packs/demo_sites/<id>.json`
(`nasa.ndvi` + `nasa.timeline_check`, committed). The pipeline uses HTTPS range reads of the rows it
needs because a full granule takes minutes at the measured throughput.
