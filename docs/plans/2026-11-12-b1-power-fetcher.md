# Implementation Plan: B1 NASA POWER Agroclimatology Fetcher

**Date:** 2026-11-12  
**Task:** B1 (data-pipelines) NASA POWER daily fetcher  
**Scope:** `pipelines/power/`, `pipelines/tests/`, `data/raw/power/`  

## 1. Context & Objectives
To unlock real NASA-backed climate packs for demo sites in Egypt without relying on synthetic climate approximations, we need an automated, robust, and resumable data ingestion script for NASA POWER (Prediction of Worldwide Energy Resources) Agroclimatology daily API.
As specified in [docs/tasks/BACKLOG.md](../../docs/tasks/BACKLOG.md) (item B1) and [docs/earthdata-setup.md](../../docs/earthdata-setup.md):
- Fetch daily agroclimatic variables: `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN`, `RH2M`, `WS2M`.
- Target: Each demo site listed in [knowledge/demo_sites.yaml](../../knowledge/demo_sites.yaml) (`kafr_el_sheikh`, `gharbia`, `nubaria`, `minya`, `fayoum`).
- Time range: 2000-01-01 to 2025-12-31 (or latest available date).
- Authentication: No login required (public API).
- Raw output: Stored locally in `data/raw/power/<site_id>.json` (gitignored).

## 2. Proposed Changes
### A. `pipelines/power/fetch.py`
Create the ingestion module and CLI entry point:
- Read sites dynamically from `knowledge/demo_sites.yaml`.
- Query NASA POWER Point Daily API:
  - Base URL: `https://power.larc.nasa.gov/api/temporal/daily/point`
  - Parameters: `T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,WS2M`
  - Community: `AG`
  - Longitude & Latitude per site.
  - Start date: `20000101`, End date: `20251231` (configurable via arguments).
  - Format: `JSON`.
- **Resumability**: If `data/raw/power/<site_id>.json` already exists with valid data, skip it unless `--force` is provided.
- **Robust Error Handling**: Handle rate limiting, partial date range truncation (if latest year is not fully published), and non-fatal network retries using `requests` with standard timeout and backoff.

### B. `pipelines/tests/test_power.py`
Add unit and regression tests with mock responses:
- Test URL and query parameter construction.
- Test JSON parsing and validation of returned variables.
- Test resumability (skip existing valid files).
- Test CLI argument handling without requiring live internet access during test runs.

### C. Update Backlog
- Update [docs/tasks/BACKLOG.md](../../docs/tasks/BACKLOG.md) to mark B1 complete once all Definition of Done gates pass.

## 3. Rationale & Tradeoffs
- **No network in CI/tests**: Unit tests mock HTTP responses using a synthetic fixture so test suites remain fast, offline-capable, and deterministic.
- **Public API Rate Limits**: POWER API has rate limits (~30 requests/min). The script introduces modest delays between site queries and caches the raw JSON directly to `data/raw/power/` so each site is fetched at most once.

## 4. Verification & Definition of Done
1. API tests: `pytest -q` in `api/` and `pipelines/tests/`.
2. Linter: `ruff check api pipelines`.
3. Web: `npm run typecheck && npm run build` in `web/`.
4. i18n check: `python scripts/check_i18n.py`.
5. Contract validation: `api/tests/test_contract.py`.
