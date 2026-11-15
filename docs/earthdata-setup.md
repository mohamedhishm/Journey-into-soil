# NASA Earthdata setup (what to look for)

## 1. Account and token
1. Log in at https://urs.earthdata.nasa.gov with your new account.
2. **Applications > Authorized Apps > Approve More Applications**: approve **NASA GESDISC DATA ARCHIVE** (needed for SMAP/GPM through GES DISC). Other DAACs may ask for their own approval the first time (e.g. LP DAAC for HLS/MODIS).
3. **Generate Token** (User Tokens). Tokens expire (about 60 days). Put it in `.env` as `EARTHDATA_TOKEN=...`. Never commit it.

## 2. Products to look up in Earthdata Search (https://search.earthdata.nasa.gov)
Verify the exact short name and latest version yourself; versions change. Record them in `knowledge/sources.yaml`.

| Need | Candidate product | Notes |
| --- | --- | --- |
| Daily weather (T, rain, radiation, wind, RH) | **NASA POWER** daily API | No login. ~0.5 deg grid. https://power.larc.nasa.gov/docs/ |
| Rainfall | **GPM IMERG** daily final (`GPM_3IMERGDF`) | ~0.1 deg; GES DISC |
| Soil moisture | **SMAP L3 enhanced** (`SPL3SMP_E`) | ~9 km, surface (and root-zone products exist, e.g. SPL4SMGP at 9 km). Coarse: always label "regional indication". |
| Vegetation / bare-field check | **HLS** (Landsat+Sentinel-2, 30 m) or **MOD13Q1** NDVI (250 m) | LP DAAC. Cloud/gap handling needed |
| Easiest way to extract point/area time series | **AppEEARS** (https://appeears.earthdatacloud.nasa.gov) | Request a point sample for each demo site; downloads CSV. Good fallback for NDVI and SMAP |
| Soil texture/OM/pH | **SoilGrids** (ISRIC, not NASA) | Label clearly as non-NASA |

## 3. Suggested order for a part-time team
1. POWER (no login) first: it alone unlocks real climate packs.
2. AppEEARS point samples for NDVI and SMAP for the 3-5 demo sites (manual web UI is fine, then commit CSV to `data/raw/`).
3. Only then automate with `earthaccess` / direct API if time remains.
4. Also use whatever NASA hands you ~2 days before the hackathon: put it in `data/raw/nasa_event/` and map it in `docs/data-sources.md`.
