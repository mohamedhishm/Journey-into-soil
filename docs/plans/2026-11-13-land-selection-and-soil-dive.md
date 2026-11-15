# Implementation Plan: Land Selection & 3D Soil Core Excavation Dive

**Task:** Connect land/parcel selection on the map to an interactive 3D soil core excavation dive  
**Date:** 2026-11-13  
**Status:** PROPOSED (Awaiting User Review)  
**Scope:** `web/src/features/map/`, `web/src/scene/`, `web/src/i18n/`, `web/src/App.tsx`  

---

## 1. User Need & Rationale
The user requested: *"we need to select a piece from the land and look into it. What's in your mind to implement this?"*  
The user selected **Option 3 (Unified Hybrid Experience)**:
1. **On the Map (Macro)**: Selecting an actual parcel/plot of farmland with a visible field boundary box and area measurement.
2. **In 3D Simulation (Micro)**: Experiencing the physical excavation of the soil core:
   - Starting above ground looking across the farm field.
   - An illuminated soil-corer reticle frames the selected monolith piece.
   - The ground cuts open, the camera dives underground into the trench, revealing root penetration and the 4 photographic soil horizons.
   - The user can smoothly transition between **Field Surface**, **Underground Core**, and **Stratified Layers**.

---

## 2. Technical Architecture & Changes

### A. Map Parcel Selection (`web/src/features/map/FieldMap.tsx` & `App.tsx`)
- Compute a dynamic field parcel polygon based on `request.lat`, `request.lon`, and `request.area_feddan` ($1\text{ feddan} = 4,200\text{ m}^2$, roughly $65\text{ m} \times 65\text{ m}$).
- Render a luminous GeoJSON polygon on MapLibre with:
  - Fill: `rgba(162, 80, 47, 0.22)`
  - Border: `#a2502f` / `#57a24b` (2px outline with subtle glow)
- Display parcel dimensions in the coordinate bar: `{{area}} feddans ({{ha}} ha)`.
- Update Landing CTA button to: `ui.analyze_soil_core` (*"Extract Soil Core & Analyze"* / *"احفر عينة التربة وحلل"*).

### B. 3D Agricultural Field Terrain (`web/src/scene/SceneController.ts`)
- **Surrounding Farmland Terrain (`fieldGroundMesh`)**:
  - A $26 \times 26$ ground slab at $y = 0$ surrounding the $8 \times 4$ monolith block with topsoil agricultural texture.
  - Crop blade instances spread across the surrounding field to establish the sense of a vast, living agricultural farm.
- **Illuminated Core Reticle (`reticleMesh`)**:
  - A glowing boundary line around the $8 \times 4$ soil monolith footprint at the surface ($y = 0.02$).
- **Excavation Animation Pipeline**:
  - Three distinct camera & scene narrative stages:
    1. **`field`**: Radius 26, overhead angle (beta 0.68), wide field view with wind sway across crops, compact block flush in the field.
    2. **`underground`**: Radius 13.5, eye-level cutaway (beta 1.25), camera dives down into the trench, outer field fades/slides back, spotlighting roots and cutaway face.
    3. **`layers`**: Monolith expands vertically (`explode = 1`), separating the 4 photographic horizons with depth ruler and live inspector.
  - Smooth animation lerp between stages (`setDiveStage(stage)`).
  - Callback to notify UI of stage changes: `onStageChange(stage)`.

### C. 3D Scene Controls & Narrative Stepper (`web/src/scene/SoilScene.tsx` & `.css`)
- Add a stage breadcrumb / navigator inside the scene:
  - `[ 🌾 Field Surface ]` $\rightarrow$ `[ ⛏️ Underground Core ]` $\rightarrow$ `[ 🟤 Stratified Layers ]`
- Toolbar "Replay" re-triggers the cinematic excavation dive from above ground down into the horizons.
- Ensure 100% mobile responsiveness at 390px with clean button semantics and zero overlap.

### D. Bilingual i18n Parity (`web/src/i18n/ui.en.json` & `ui.ar.json`)
- Add keys:
  - `ui.stage_field`: `"Field surface"` / `"سطح الحقل"`
  - `ui.stage_underground`: `"Underground core"` / `"عينة باطن الأرض"`
  - `ui.stage_layers`: `"Stratified layers"` / `"طبقات التربة"`
  - `ui.dive_into_soil`: `"Dive underground"` / `"الغوص في باطن الأرض"`
  - `ui.analyze_soil_core`: `"Extract Soil Core & Analyze"` / `"احفر عينة التربة وحلل"`
  - `ui.parcel_selected`: `"Parcel: {{feddan}} feddans ({{ha}} ha)"` / `"القطعة: {{feddan}} فدان ({{ha}} هكتار)"`

---

## 3. Definition of Done & Verification
1. `python scripts/check_i18n.py` passes with zero missing keys.
2. `npm --prefix web run typecheck` and `npm --prefix web run build` pass cleanly.
3. Playwright automated visual verification captures:
   - Map with parcel polygon.
   - 3D Field surface view with core reticle.
   - 3D Underground cutaway view.
   - 3D Stratified layers view.
4. `ruff check api pipelines` and `pytest api/tests pipelines/tests -q` green.
