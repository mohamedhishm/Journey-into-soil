# Atmospheric Trench Backdrop, Lush Crop Canopy, and Embedded Root Architecture

**Date:** 2026-11-13  
**Author:** Antigravity (Ahmed Yasser)  
**Status:** Proposal / Ready for Execution  
**Branch:** Ahmed  

---

## 1. Problem Statement & User Feedback

1. **"We don't need the liminal space in the back"**:
   - Behind the floating soil monolith, the current container renders a flat, infinite baby-blue sky gradient (`#9ccbf0` to `#d8ecf8`), even when inspecting subterranean layers at 90-150 cm depth.
   - This creates an eerie, surreal "liminal space" where a block of soil floats in an empty sky void with no context, excavation trench, or physical grounding.
2. **"The first layer doesn't have enough vegetation"**:
   - Crop blades are currently single thin needle cylinders (diameter 0.08) at low density (1400 across a 32 m² block).
   - Canopy height scaling at early season (`sim.canopy[0] = 0.10`) shrinks blades to stubby 0.08 unit specks, looking sparse and bare.
3. **"Roots doesn't sit right"**:
   - Roots are generated at `z = -D/2 - 0.06` (-2.06), which is physically floating 6 cm in front of the soil block in mid-air.
   - Root lines use coarse step zigzags, resembling glowing white neon lightning bolts rather than organic plant roots.
   - Roots do not align with surface plant crowns, lacking natural root-to-shoot continuity.

---

## 2. Proposed Technical Architecture

### A. Subterranean Trench & Agricultural Sky Background
- **Stage-Aware Background System** in `web/src/scene/SoilScene.css`:
  - `data-stage="field"`: Agricultural atmosphere under open sky with subtle warm sun glow and earthen horizon meeting the delta plain.
  - `data-stage="underground"` & `data-stage="layers"`: Rich subterranean excavation trench / studio gallery backdrop (`radial-gradient(circle at 50% 35%, #2a1f16 0%, #1a130d 55%, #0c0805 100%)`).
  - Dark mode equivalents for nighttime trench ambiance.
- **Subterranean Atmosphere in 3D** (`web/src/scene/SceneController.ts`):
  - Add floating earthen dust motes (ambient organic particles catching the light beam, matching `Journey Into the Soil (3D) (1).html`).
  - Soft distance depth fog to blend the monolith naturally into the excavation trench.
  - Enhanced contact shadow beneath the pedestal to anchor the block to the trench floor.

### B. Dense, Organic Agricultural Crop Canopy
- **Multi-Leaf Crop Tufts**:
  - Replace single needle cylinders with compound 3-blade crop shoot geometries with natural leaf curvature, width variations, and fanning angles.
- **Agricultural Row Clustering & Increased Density**:
  - Increase blade instance count to 2800 (high) / 1400 (medium) arranged in crop rows with natural organic jitter.
- **Organic Baseline Height**:
  - Enforce a minimum seedling height of 0.40 units, scaling dynamically up to 1.4 units with canopy cover.
- **Subsurface Turf Base**:
  - Ensure the top surface of Layer 0 features lush agricultural turf texture with color variation matching the active crop (cereal golden-green, legume deep clover, etc.).

### C. Realistic Embedded Root System Architecture
- **Embedded Flush Cutaway**:
  - Position roots at `z = -D/2 - 0.005` (flush against the cutaway face), visually embedding them in the soil matrix rather than floating in air.
- **Root-to-Shoot Anatomical Continuity**:
  - Anchor primary root crowns directly beneath corresponding surface plant crowns along the front margin.
- **Smooth Gravitropic Splines & Hierarchical Branching**:
  - **Primary Root Crown**: Thick taper from $y = 0$ (radius 0.045 down to 0.020).
  - **Secondary Lateral Branches**: Organic $45^\circ-60^\circ$ bifurcations wandering through soil pores.
  - **Legume Nodules**: Small nodule clusters in Layer 0 for nitrogen-fixing legumes (Lentil, Clover, Faba bean).
- **Natural Biological Shading**:
  - Replace neon white emissive color with authentic ivory/cream root material (`diffuseColor: Color3(0.92, 0.89, 0.80)`, subtle subsurface sheen, and real directional lighting response).

---

## 3. Affected Files
- `web/src/scene/SceneController.ts` — Dust particles, canopy tuft geometry, density, root spline architecture, material shading.
- `web/src/scene/SoilScene.tsx` — Bind `data-stage` and `data-theme` to `.scene-container`.
- `web/src/scene/SoilScene.css` — Stage-aware atmospheric backdrops (field sky vs subterranean excavation trench).
- `docs/tasks/BACKLOG.md` — Backlog tracking.

---

## 4. Verification Plan
- Playwright screenshot tests (`scripts/test_focus.py`):
  - Capture field stage, underground core, and stratified layers in both light and dark modes.
  - Inspect Layer 0 up close to verify dense lush canopy and embedded natural root structures.
- Quality gates: `npm --prefix web run typecheck`, `npm --prefix web run build`, `pytest api/tests pipelines/tests -q`, `check_i18n.py`.
