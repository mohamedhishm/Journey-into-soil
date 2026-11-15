# Implementation Plan: Meteomatics API Integration

**Date:** 2026-11-14  
**Task:** Integrate Meteomatics high-resolution Weather & Soil API into backend, agent, and web frontend  
**Scope:** `api/app/config.py`, `api/app/services/meteomatics.py`, `api/app/api/v1/routes.py`, `api/app/agent/workflow.py`, `api/tests/test_meteomatics.py`, `web/src/api/client.ts`, `web/src/features/landing/NasaTelemetryModal.tsx`, `contracts/i18n/`, `web/src/i18n/`

## 1. Objectives & Context
Meteomatics is an official collaborator for NASA Space Apps, combining NASA's global Digital Elevation Models (SRTM 90m) with high-resolution numerical weather models to deliver downscaled meteorological, evapotranspiration, and multi-depth soil moisture data.

In this project, Meteomatics provides:
1. Real-time high-resolution 2m temperature, humidity, and precipitation.
2. Soil Moisture Indices (SMI) across depths:
   - Surface (`soil_moisture_index_-5cm:idx`, 0–7 cm) cross-validating NASA SMAP L4 radar.
   - Deep root-zone (`soil_moisture_index_-50cm:idx`, 28–100 cm).
   - Soil moisture deficit (`soil_moisture_deficit:mm`).
3. Reference evapotranspiration (`evapotranspiration_24h:mm`).

## 2. Technical Design

### A. Configuration
- Environment variables:
  - `METEOMATICS_USERNAME`
  - `METEOMATICS_PASSWORD`
- Loaded via `api/app/config.py`.

### B. Service Module: `api/app/services/meteomatics.py`
- Function `fetch_telemetry(lat: float, lon: float) -> dict`:
  - Queries `https://api.meteomatics.com/now/{parameters}/{lat},{lon}/json` using `httpx` with basic auth.
  - Parameters: `t_2m:C`, `relative_humidity_2m:p`, `precip_24h:mm`, `evapotranspiration_24h:mm`, `soil_moisture_index_-5cm:idx`, `soil_moisture_index_-50cm:idx`, `soil_moisture_deficit:mm`.
  - In-memory short-lived cache (15 minutes) to conserve API quotas.
  - Fallback: If unconfigured or network failure, returns modeled analog data with `status: "demo_analog"`, `configured: false`.

### C. API Endpoint
- Route: `GET /api/v1/telemetry/meteomatics?lat={lat}&lon={lon}` in `api/app/api/v1/routes.py`.

### D. AI Agent Workflow
- In `api/app/agent/workflow.py`, ingest live/analog Meteomatics telemetry facts when answering questions about current weather, evapotranspiration, and soil moisture deficit.

### E. Frontend Integration
- Add `api.meteomatics(lat, lon)` in `web/src/api/client.ts`.
- In `web/src/features/landing/NasaTelemetryModal.tsx`, add a 5th card or telemetry lane displaying the Meteomatics downscaled high-resolution soil moisture & weather stream alongside NASA SMAP and NASA POWER.

## 3. Definition of Done
1. `pytest api/tests -q` passes (including new `api/tests/test_meteomatics.py`) - **DONE (117 tests passing)**.
2. `ruff check api` passes - **DONE (Clean)**.
3. `npm run typecheck` and `npm run build` pass in `web` - **DONE (TypeScript clean, Vite build successful)**.
4. `python scripts/check_i18n.py` passes - **DONE (159 engine keys, 355 UI keys in parity)**.
5. Deployed & verified live on OCI instance - **DONE (`https://theshifters.l4s3r.site/api/v1/telemetry/meteomatics` & `https://theshifters-api.l4s3r.site` verified 200 OK)**.
