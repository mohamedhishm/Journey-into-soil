# Data sources and pack format

Sources registry: `knowledge/sources.yaml`. Status per product is exposed in `result.nasa_data` (`pack` | `placeholder` | `planned`).

## Pack format `data/packs/demo_sites/<id>.json` (read by `api/app/services/climate.py`)
Check `climate.py` for the authoritative fields (daily arrays: date, tmax, tmin, rain, et0 or inputs to compute it, plus `source` / `pack_id`). Builders must follow what the loader expects, extend loader + tests together, and set `resolution_km` per product.

## NASA observation block (`nasa`) in the demo packs

`pipelines/packs/build_demo_packs.py` adds a `nasa` section without touching `meta`/`daily`:

```
"nasa": {
  "smap": { status, product: "SPL3SMP_E", version: "006", depth_cm: [0,5],
            root_zone_available: false, observations[], daily[], summary, limitations[] },
  "ndvi": { status, product: "VNP13A1", version: "002", observations[], series[],
            summary, timeline_check{...}, limitations[] }
}
```

Rules the API follows when reading it (see `api/app/services/nasa.py`):

- Products not obtained are written with `status: "planned"` plus a `reason`; they never break the
  result and never appear as if observed.
- SMAP `SPL3SMP_E` is **surface** soil moisture, top ~5 cm. There is no root-zone variable in this
  product; root-zone values only exist in model-assimilated L4 products, so `root_zone_available`
  is `false` and the panel says so.
- The "NASA vs model" comparison transforms the model's relative moisture (0 = wilting point,
  1 = field capacity) to m³/m³ using the site's Saxton–Rawls water content, then reports bias,
  RMSE, MAE and Pearson r over the days present in both windows. It is always labelled
  `indicative: true` and compares one value per day.
- NDVI is greenness, not soil health or crop identity; see `docs/ndvi-source.md`.

## Notes
- POWER ~50 km; IMERG ~10 km; SMAP ~9 km; HLS 30 m; SoilGrids ~250 m. Field-scale claims need a caveat.
- SoilGrids values are ISRIC 250 m machine-learning model predictions (not field measurements); in API responses they are strictly labelled "estimated" (never "measured"). When incorporated into demo packs, values reflect the topsoil (0-5 cm) layer only, and pack organic matter (OM) is capped at 3.5% in the engine. Currently, 7 of 27 demo sites have soil data (6 original sites sampled at 0.0 km offset plus Cairo sampled from a nearby point at 4.81 km offset), while 20 sites have none (`soil: null`, status `planned`) because the ISRIC API returned null values for their coordinates.
- Sentinel/VIIRS NDVI at 500 m mixes many small Delta fields: the timeline check reports `uncertain`
  unless crop and fallow periods separate by at least 0.10 NDVI.
- Analog-year lookup: scenarios (dT, dP) shift a real year rather than inventing weather.
