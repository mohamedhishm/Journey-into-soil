# Implementation Plan: Live Weather Simulation Grounding & 3D Atmospheric Systems

**Date:** 2026-11-14  
**Task:** Ground soil moisture simulation in live Meteomatics weather telemetry and render dynamic 3D atmospheric weather conditions with an interactive HUD.  
**Scope:** `api/app/schemas/request.py`, `api/app/sim/water_balance.py`, `api/app/sim/runner.py`, `api/app/engine/pipeline.py`, `contracts/i18n/`, `web/src/scene/SceneController.ts`, `web/src/features/results/WeatherAtmosphereHUD.tsx`, `web/src/i18n/`

## 1. Objectives & Context
With the Meteomatics Weather & Soil API live on the OCI server, the platform can bridge real-time observations (NASA SRTM 90m downscaled) into both the agronomic physics simulation and the 3D visual experience.

Key outcomes:
1. **Engine Physics**: Replace the hardcoded Day 0 initial soil moisture (0.70) with live measured Soil Moisture Indices across depths ($SMI_{5cm}$, $SMI_{50cm}$) and generate a pre-sowing deficit advisory flag when $SMD > 50\text{ mm}$.
2. **3D Atmosphere**: Render dynamic weather conditions (Sunny/Arid, Rain Downpour with wet soil sheen, Khamsin Dust Haze with rapid crop sway) in Three.js.
3. **UI/UX Experience (`/ui-ux-pro-max`)**: A glassmorphic biophilic HUD widget with live telemetry readouts, interactive weather presets, and a live grounding toggle with strict WCAG contrast and SVG icons.

## 2. Technical Architecture

### A. Physics & Simulation Grounding
- In `api/app/sim/water_balance.py`:
  - Extend `initial_theta(layers, fraction=0.7, layer_fractions=None)` to compute moisture per layer using specific $SMI$ values when provided.
- In `api/app/sim/runner.py`:
  - Pass `init_fractions` to `run_timeline()`.
- In `api/app/engine/pipeline.py`:
  - When `req.use_live_weather` is active (default), retrieve live/analog telemetry via `meteomatics.get_telemetry_sync(req.lat, req.lon)`.
  - Derive stratum moisture fractions:
    - Layer 0 (0–15 cm): $\max(0.05, \min(1.0, SMI_{5cm}))$
    - Layer 1 (15–30 cm): $0.7 \times SMI_{5cm} + 0.3 \times SMI_{50cm}$
    - Layer 2 (30–60 cm): $\max(0.05, \min(1.0, SMI_{50cm}))$
    - Layer 3 (60–100 cm): $\max(0.05, \min(1.0, SMI_{50cm}))$
  - If $SMD > 50\text{ mm}$, emit `flag.pre_sowing_deficit` in `flags`.

### B. Contracts & i18n
- Add `flag.pre_sowing_deficit` to `contracts/i18n/en.json` and `ar.json`.
- Add UI strings for HUD in `web/src/i18n/ui.en.json` and `ui.ar.json`.

### C. 3D Scene Weather Systems (`SceneController.ts`)
- Add rain particle system (`THREE.Points`) with downward velocity reset.
- Support weather modes: `"auto" | "sunny" | "rain" | "dust"`.
- Adjust directional/ambient lights, sky background tone, topsoil slab roughness (wet gloss vs dry crust), and dust motes / crop sway speeds.

### D. UI/UX Widget (`WeatherAtmosphereHUD.tsx`)
- Floating glassmorphic panel on top of the 3D viewport.
- Indicators: Live Temp, RH, $ET_0$, Soil Deficit with pulsing green beacon.
- Toggles: `[● Live Grounding | ○ Historical Average]` and weather buttons `[Auto | Sunny | Rain | Dust]`.

## 3. Definition of Done
1. `pytest api/tests -q` passes with new test for live weather simulation grounding - **DONE (119 passed)**.
2. `ruff check api` passes - **DONE (Clean)**.
3. `python scripts/check_i18n.py` passes with zero key mismatch - **DONE (160 engine keys, 379 UI keys)**.
4. `npm run typecheck` and `npm run build` pass in `web` - **DONE (Vite build successful)**.
5. Committed with conventional commit and deployed to OCI instance.
