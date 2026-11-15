# Implementation Plan: Sidebar Area & Soil Layer Focus & Zoom

**Task:** Zoom, highlight, and hold focus on a specific soil layer or area selected from the sidebar in the 3D simulation until reset  
**Date:** 2026-11-13  
**Status:** PROPOSED (Awaiting User Review)  
**Scope:** `web/src/state/store.ts`, `web/src/features/results/Panels.tsx`, `web/src/scene/SceneController.ts`, `web/src/scene/SoilScene.tsx`, `web/src/scene/SoilScene.css`, `web/src/i18n/ui.en.json`, `web/src/i18n/ui.ar.json`

---

## 1. User Need & Rationale
The user requested:  
*"zoom into the specific area selected in the sidebar once inside the simulation itself. It should be highlighted and zoomed in and be focused untill the user decided otherwise (or press reset button)"*

When examining soil simulation results, agronomic analysis requires close inspection of specific soil horizons (e.g. the active topsoil root zone, subsoil compaction layer, or deeper mineral substrata). Currently, the camera maintains a wide overview, and selecting a layer only opens an overlay card without focusing the 3D camera.

By connecting the sidebar (`LayerTable`) and in-scene layer controls directly to camera kinematics and mesh emissive highlights, selecting an area will:
1. **Highlight the selected layer/area** with a luminous highlight while subtly darkening non-selected horizons.
2. **Smoothly zoom and re-target the 3D camera** (`camera.target` lerps to the exact vertical layer centroid, and `radius` tightens from `15.5` to `8.5` for close-up inspection).
3. **Persist the focused view indefinitely** until the user explicitly selects a different layer, clicks the canvas, or presses the **Reset focus** button (`[ ↺ Reset focus ]`).

---

## 2. Technical Architecture & Component Changes

### A. State Synchronization (`web/src/state/store.ts`)
- Add state slice:
  - `focusedLayer: number | null` (index of the active layer horizon, or `null` when in overview mode).
  - `setFocusedLayer: (layerIdx: number | null) => void`.
- Bidirectional synchronization:
  - Selecting a layer in the sidebar `LayerTable` updates `focusedLayer`.
  - Tapping a layer mesh in the 3D Babylon canvas updates `focusedLayer`.
  - Clicking "Reset focus" or `Esc` clears `focusedLayer` to `null`.

### B. Camera Kinematics & Mesh Highlights (`web/src/scene/SceneController.ts`)
- Implement `focusLayer(idx: number | null)`:
  - When `idx !== null`:
    - Calculate exact world $Y$ centroid for layer `idx` taking into account current explosion offsets.
    - Lerp `targetCamTarget` to `(0, layerY, 0)`.
    - Lerp `targetCamRadius` to `8.5` (close-up focus) and `targetCamBeta` to `1.30`.
    - Apply highlight: set `emissiveColor = new Color3(0.32, 0.28, 0.18)` on the active layer mesh; dim non-focused layers to `new Color3(0.04, 0.04, 0.04)`.
    - Keep inspector card data synchronized.
  - When `idx === null` (Reset):
    - Reset `targetCamTarget` to `(0, -3.2, 0)` and `targetCamRadius` to `15.5`.
    - Restore neutral emissive colors across all layer meshes (`Color3.Black()`).
    - Clear inspector.
- Ensure camera keeps looking at the focused layer during user orbit interactions until reset.

### C. Sidebar Interactive Layer Table (`web/src/features/results/Panels.tsx`)
- Enhance `LayerTable` in the sidebar (`.side`):
  - Make each layer row an interactive, accessible button row with hover and active states (`.layer-row.focused`).
  - Add an inline SVG focus icon next to the layer depth.
  - Clicking a row calls `setFocusedLayer(i)`, smoothly scrolls the viewport to the 3D scene (if needed), and triggers the 3D zoom and highlight.
  - Add a **Reset focus** action button in the table header whenever a layer is focused.

### D. In-Scene Controls & Reset Button (`web/src/scene/SoilScene.tsx` & `.css`)
- Display an illuminated **Reset focus** button in the scene toolbar and inspector header:
  - Clean SVG reset icon (`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8...`).
  - Translated label (`ui.reset_focus`).
- Handle `Escape` key and close `(×)` to cleanly reset focus.
- Style `.layer-row`, `.focused`, and `.scene-reset-focus-btn` with glassmorphic styling, high contrast, and dark/light/RTL support.

### E. Bilingual i18n Parity (`web/src/i18n/ui.en.json` & `ui.ar.json`)
- Add keys:
  - `ui.reset_focus`: `"Reset focus"` / `"إعادة ضبط التركيز"`
  - `ui.focus_layer`: `"Focus layer"` / `"تركيز على الطبقة"`
  - `ui.focus_in_3d`: `"Focus in 3D"` / `"عرض في المجسم الثلاثي"`

---

## 3. Verification & Acceptance Criteria
1. Clicking a layer row in the sidebar `LayerTable` smoothly zooms the 3D camera to that horizon and highlights it.
2. The layer remains zoomed in and highlighted as time advances or as the user orbits around it.
3. Clicking the "Reset focus" button (or pressing Esc) restores the overview framing and clears highlights.
4. Tapping a layer in 3D updates the highlighted row in the sidebar `LayerTable`.
5. Zero emojis used — pure scalable SVGs.
6. `npm run typecheck` & `npm run build` pass with 0 errors.
7. `python scripts/check_i18n.py` passes with 100% key parity.
8. Visual verification screenshots captured and reviewed at 1280px and 390px in light/dark/RTL.
