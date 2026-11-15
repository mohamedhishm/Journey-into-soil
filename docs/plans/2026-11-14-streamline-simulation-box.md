# Plan: Streamline & Declutter 3D Simulation Box

**Date:** 2026-11-14  
**Scope:** `web`  
**Related Requirements:**  
- Declutter the 3D simulation canvas (`SoilScene.tsx`, `SoilScene.css`, `WeatherAtmosphereHUD.tsx`, `Timeline.tsx`).
- Eliminate overlay collisions between weather telemetry and layer callouts.
- Replace permanent 4-card wall and SVG wire clutter with an on-demand, sleek horizon inspector.
- Remove redundant in-canvas bottom drawer (`.scene-dock`) whose content is already featured in the Analytical Hub below.
- Upgrade `Timeline.tsx` into a tactile cinematic scrubber with Play/Pause animation, step controls, and high-contrast season markers.
- Zero emojis: strictly vector SVGs for all icons, indicators, and controls.
- WCAG AAA contrast in both Light and Dark modes.
- Complete English and Arabic (RTL) i18n parity.

---

## 1. Architectural Changes

### A. Viewport Header & HUD Consolidation (`SoilScene.tsx`)
1. **Left Utility Cluster (Live Sensor & Telemetry Pill):**
   - Displays active crop name, formatted date, air temperature, and daily ET₀ in a compact glass pill.
   - Includes a button with sensor/atmosphere SVG icon to expand/collapse the full Meteomatics Atmospheric Telemetry drawer on demand, rather than having it permanently obscure 360px of the canvas.
2. **Right Utility Cluster (View Controls):**
   - Compact segmented pill for:
     - Perspective 3D View vs Cutaway Orthographic Cross-section.
     - Explode / Compact Soil Layers toggle.
     - Reset Camera & Replay dive sequence.

### B. On-Demand Horizon Inspector (`SoilScene.tsx` & `SoilScene.css`)
1. Remove the 4 floating cards and curved yellow SVG connector arrows that permanently obscure the 3D model.
2. Introduce a sleek, minimal **Horizon Rail** (or direct 3D mesh interaction):
   - A discreet vertical layer selector on the side showing layer depth pills (e.g., L1: 0-20 cm, L2: 20-50 cm, L3: 50-100 cm, L4: 100-150 cm).
   - Selecting a layer opens a single, docked, high-contrast **Horizon Inspector Card** with sand/silt/clay composition, OM, pH, ECe, and moisture status.
   - A close button (`✕`) dismisses the inspector, returning 100% of the canvas to unobstructed 3D viewing.
3. Remove redundant `.scene-dock` / `.scene-drawer` from within `SoilScene`, as recommendations and USDA triangles are already hosted in the Analytical Hub tabs.

### C. Weather & Atmospheric Popover (`WeatherAtmosphereHUD.tsx`)
1. Convert from a permanently pinned 360px floating box into a docked drawer/popover that toggles from the top-left telemetry chip.
2. Retain all live sensor metrics (Air Temp, Relative Humidity, ET₀, Deficit) and the live grounding switch with high-contrast text and vector SVGs.

### D. Cinematic Timeline Scrubber (`Timeline.tsx` & `Timeline.css`)
1. Add interactive playback engine:
   - **Play / Pause** toggle with smooth frame-based interpolation over `dayT`.
   - **Step Forward / Step Back** buttons (by day or by crop season).
2. Clean SVG visualization:
   - Polished season bands with high contrast in light mode (`var(--surface)`, `var(--ink)`) and dark mode.
   - Clear scrubber thumb with crisp tooltip showing the current calendar date, crop phenological stage, and daily moisture.
   - Clean, compact legend without cluttering the slider track.

---

## 2. Affected Files
1. `docs/plans/2026-11-14-streamline-simulation-box.md`
2. `web/src/scene/SoilScene.tsx`
3. `web/src/scene/SoilScene.css`
4. `web/src/features/results/WeatherAtmosphereHUD.tsx`
5. `web/src/features/results/WeatherAtmosphereHUD.css`
6. `web/src/features/results/Timeline.tsx`
7. `web/src/features/results/Timeline.css`
8. `web/src/i18n/ui.en.json` & `web/src/i18n/ui.ar.json`

---

## 3. Verification & Deployment
- `npm --prefix web run typecheck`
- `npm --prefix web run build`
- `python scripts/check_i18n.py`
- Git commit (`feat(web): streamline simulation box and add timeline playback`)
- Push to `origin/Ahmed`
- Deploy to OCI server (`sudo docker compose up -d --build web`)
