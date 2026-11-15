# Plan: Act 1 Cinematic Agricultural Landscape Enhancement

**Date:** 2026-11-13  
**Status:** In Progress  
**Author:** Antigravity Team  
**Scope:** `web` (`SceneController.ts`, `SoilScene.tsx`, `SoilScene.css`)

---

## 1. Problem Statement & Motivation
Act 1 of the simulation scene ("Above ground: your field under the sky") currently suffers from five major visual and immersion defects:
1. **The "Island" Effect**: Crop tufts are strictly restricted to the 2.4m × 1.6m monolith box, surrounded by a completely bare 96m brown box.
2. **Neon Debug Reticle**: A bright neon green wireframe rectangle (`#78e06e`) outlines the soil core on the surface, looking like a CAD/debug gizmo rather than a realistic landscape.
3. **Harsh Horizon Boundary**: The flat 3D ground geometry abruptly cuts off against the 2D CSS gradient sky with no atmospheric blending or depth haze.
4. **Subterranean Soil Texture on Ground**: The surrounding ground uses subterranean `layer_0.jpg` with uniform repetition rather than rich arable topsoil with furrow/tillage guidance.
5. **Overcrowded UI during Intro**: Full telemetry controls and camera toolbars clutter the viewport during the initial 2.8s cinematic establishing shot.

---

## 2. Proposed Architecture & Design Changes

### A. Extended Agricultural Crop Canopy in `SceneController.ts`
- In `buildExtendedFieldCanopy()` / `buildBlades()`:
  - Populate planting rows across the surrounding terrain in Act 1:
    - High density in the central monolith (excavation core).
    - Natural agricultural rows extending out across the surrounding field in the X/Z plane (e.g. 18 rows, spaced across -16m to +16m Z, -20m to +20m X).
    - Thin instances in Babylon.js keep performance cost at near-zero draw calls.
  - When transitioning to Act 2 / Act 3 (`underground` / `layers`), outer field crops are hidden or parented under `fieldGroundNode` so they move and vanish cleanly as the excavation opens.

### B. Atmospheric Horizon Fog
- Enable Babylon.js native distance fog:
  - `scene.fogMode = Scene.FOGMODE_EXP2`
  - In Act 1 (`field`), set `scene.fogDensity = 0.015`.
  - Calibrate `scene.fogColor` to the horizon tone:
    - Light mode: `new Color3(0.85, 0.90, 0.93)` (soft sky haze blending with the CSS horizon).
    - Dark mode: `new Color3(0.16, 0.17, 0.20)`.
  - In Act 2 / Act 3 (`underground` / `layers`), transition `scene.fogColor` to subterranean trench tones (`Color3(0.10, 0.07, 0.05)`) and lower density to maintain crisp inspection clarity.

### C. Reticle Redesign & Topsoil Material
- In Act 1 (`field`), hide the bright neon green reticle: `reticleMesh.setEnabled(false)`.
- When transitioning to Act 2 (`underground`), softly fade in/enable the reticle or transform it into a warm surveyor chalk border (`Color3(0.85, 0.65, 0.35)`).
- Upgrade `surroundingFieldMat`:
  - Rich topsoil loam diffuse color (`new Color3(0.42, 0.36, 0.28)`).
  - Tillage furrow texture / organic specular power to avoid glossy or repetitive box effects.

### D. Cinematic Camera Framing & Sun Atmosphere
- Calibrate camera in Act 1:
  - `targetCamBeta = 1.34` (~77° zenith) to give the sky dramatic dominance.
  - `targetCamRadius = 24` with smooth slight parallax drift during the 2.8s establishing phase.
  - Target: `new Vector3(0, 0.7, -2.5)`.

### E. UI Overlay Hierarchy & Polish
- In `SoilScene.tsx` & `SoilScene.css`:
  - When `diveStage === "field"`, deemphasize camera preset buttons with a subtle fade/translucency, letting the **Narrative Caption pill** and the landscape take center stage.
  - When transitioning to `underground` and `layers`, smoothly transition controls to fully elevated interactive state.

---

## 3. Implementation Steps & Verification Checklist
1. [ ] **Update `SceneController.ts`**:
   - Add fog management (`setDiveStage`, `setTheme`, `tick`).
   - Extend crop instancing to cover agricultural rows across the surrounding terrain.
   - Refactor `reticleMesh` visibility and colors (hidden in `field` stage).
   - Improve `surroundingFieldMat` materials and colors.
   - Tune Act 1 camera coordinates.
2. [ ] **Update `SoilScene.css` & `SoilScene.tsx`**:
   - Add stage-specific CSS rules for `.scene-container[data-stage="field"]` UI elements.
   - Enhance the horizon atmosphere gradient and sun glow.
3. [ ] **Run Quality Gates**:
   - `npm --prefix web run typecheck && npm --prefix web run build`
   - `python scripts/check_i18n.py`
   - `pytest -q` and `ruff check .`
4. [ ] **Git Commit**:
   - Adhere to Conventional Commits: `feat(web): enhance act 1 agricultural landscape with atmospheric fog and field canopy`.
