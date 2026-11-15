# Fix Layer 0 Pedestal Clipping and Enhance 3D Layer Focus

**Date:** 2026-11-13  
**Author:** Antigravity (Ahmed Yasser)  
**Status:** In Progress  
**Branch:** Ahmed  

---

## 1. Context & Motivation

In the 3D soil simulation:
1. **Layer 0 Glitch**: A dark grey box ($8.4 \times 0.25 \times 4.4$) appeared sitting on top of Layer 0 at $y = 0$, occluding the topsoil surface, roots, and vegetation.
   - *Root Cause*: `pedestalMesh` was created at $(0, 0, 0)$ in `buildPedestal()`. Because `positionLayers()` was only called prior to `buildPedestal()` in `buildLayers()` when `pedestalMesh` was still `null`, `pedestalMesh` remained at $(0, 0, 0)$. In stages where `explode = 0` and `targetExplode = 0`, `positionLayers()` was never called in `tick()`, leaving the pedestal capping Layer 0.
2. **Stratum Focus & Framing**:
   - The user requested "a little more focus like whats happening in `Journey Into the Soil (3D) (1).html`".
   - In `Journey Into the Soil (3D) (1).html`, layers separate with prominent spacing (`GAP = 1.3`), the 3D block is offset to the left on desktop to leave ample room for layer callouts on the right, and the active stratum is framed with tight focus and rich texture donut charts.

---

## 2. Technical Changes

### A. Fix Pedestal Positioning & Layer 0 Geometry (`web/src/scene/SceneController.ts`)
- In `buildPedestal()`: Call `this.positionLayers();` immediately after creating `pedestalMesh` and `shadowMesh`.
- In `constructor`: Call `this.positionLayers();` after all meshes (`buildPedestal`, `buildRainMesh`, `buildReticle`, `buildSurroundingField`) are created.
- In `setDiveStage(stage)`: Call `this.positionLayers();` immediately on any stage transition.
- In `focusLayer(idx)`: Change condition from `if (this.diveStage === "field")` to `if (this.diveStage !== "layers") this.setDiveStage("layers");` so selecting a layer always expands the strata cleanly.

### B. Increase Layer Spacing (`GAP`)
- Increase `GAP` from `0.22` to `0.65`.
- Update camera center target for `stage === "layers"` to `new Vector3(0, -3.9, 0)` with `radius = 16.5` to frame the expanded 4-layer stack proportionally.
- Slabs now float with distinct breathing room, matching the aesthetic of "Layers separate" in `Journey Into the Soil (3D) (1).html`.

### C. Tight Macro Focus & Desktop Offset Framing
- In `focusLayer(idx)`:
  - Desktop ($\ge 768\text{px}$): `targetCamTarget = new Vector3(-1.35, targetY, 0)`.
  - Mobile ($< 768\text{px}$): `targetCamTarget = new Vector3(0, targetY, 0)`.
  - `targetCamRadius = 6.2` (desktop) / `7.0` (mobile) for an intimate macro view of the layer aggregates, roots, and cutaway profile.
  - `targetCamBeta = 1.34` for crisp eye-level perspective with top face receding in depth.
  - `targetCamAlpha = -Math.PI / 2 + 0.10` for subtle 3D volumetric relief.
  - Warm luminous emissive highlight on the focused stratum (`Color3(0.42, 0.36, 0.22)`), dimming non-active strata to `Color3(0.01, 0.01, 0.01)`.
  - Amplify salt crystallization on the focused stratum.
- In `positionLayers()`:
  - Preserve `targetCamTarget.x = isDesktop ? -1.35 : 0` when `focusedLayerIdx !== null`.

### D. Soil Texture Donut Breakdown in Inspector Card (`web/src/scene/SoilScene.tsx` & `SoilScene.css`)
- Add a soil texture donut chart (`conic-gradient`) and proportions row to the inspector card, matching `Journey Into the Soil (3D) (1).html`.
- Strict SVG-only icons (no emojis).
- Full bilingual English and Arabic RTL support.

---

## 3. Verification Plan
- Run `scripts/visual_verify.py` and targeted Playwright test `scripts/test_focus.py`.
- Verify screenshots of Layer 0 (Topsoil), Layer 1, Layer 2, Layer 3. Confirm Layer 0 has no black pedestal slab sitting on top.
- Run `npm --prefix web run build && npm --prefix web run typecheck`.
- Run `python scripts/check_i18n.py`.
- Run `pytest api/tests pipelines/tests -q`.
