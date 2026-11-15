# Plan: Act 1 Agricultural Landscape & Lush Crop Canopy Enhancement

**Date:** 2026-11-13  
**Status:** In Progress  
**Author:** Antigravity Team  
**Scope:** `web` (`SceneController.ts`, `SoilScene.tsx`, `SoilScene.css`)

---

## 1. Root Cause Analysis

Why did Act 1 look "literally empty"?
1. **CSS Z-Index Occlusion Bug**:
   - In `SoilScene.css`, `.scene-bg-gradient` had `z-index: 1`, while `canvas` had `z-index: 0`.
   - Because `.scene-bg-gradient` had `opacity: 1` during Act 1 (`data-stage="field"`), it drew an opaque 2D CSS gradient box **in front of** the 3D canvas, completely occluding the 3D terrain and crops from the user's view!
   - In Act 2 / Act 3 (`underground` / `layers`), its opacity transitioned to 0, which was why the underground slabs were suddenly revealed.
2. **Crop Geometry & Density**:
   - The instanced plants in the demo used `ConeGeometry(0.05, 1, 4)` (ultra-thin 5cm hairline cones) spaced at `dx = 1, dz = 0.75`.
   - On a 60m terrain, 1 needle-thin stalk per meter creates a barren, depopulated appearance rather than a lush agricultural field.
   - Front ground bounds (`x: -14..14`, `z: 0.5..10`) left large gaps to the left, right, and near the camera.
3. **Act 1 UI Guidance**:
   - During Act 1, the user lacked a prominent "Dive Underground" invitation button and field context card to guide the user into the excavation experience.

---

## 2. Proposed Architecture & Fixes

### A. Fix Canvas Layering & Atmospheric Background
- In `SoilScene.css`:
  - Set `.scene-bg-gradient { z-index: 0; }` (behind the canvas).
  - Set `.scene-container canvas { position: relative; z-index: 1; }` (transparent WebGL canvas on top, letting the sky show through while soil & crops render crisply).
  - Set `.scene-overlay { z-index: 2; }` (interactive UI on top).

### B. Lush Agricultural Crop Canopy in `SceneController.ts`
- **Volumetric Crop Geometry**:
  - Increase stem base radius to `0.09` with height `1.25` and 5 radial segments.
  - Multi-stem passes:
    - Pass 0: Main vertical wheat stalks with golden grain tips.
    - Pass 1: Side blades tilting naturally at $25^\circ\text{--}40^\circ$.
    - Pass 2: Dense ground-covering foliage blades.
- **Tightened Agricultural Row Spacing**:
  - Reduce spacing from `dx=1.0, dz=0.75` down to `dx=0.55, dz=0.45`, increasing density over $3\times$.
  - Seamless planting coverage:
    - Main slab: `x: -28 to 28`, `z: -56 to 0`.
    - Foreground drop block: `x: -26 to 26`, `z: 0 to 14` (fully covering the camera's view down to eye-level).
- **Crop-Specific Hues & Variety**:
  - Golden harvest ambers and vibrant emerald greens (`setHSL(0.24 + ..., 0.45 + ..., 0.22 + ...)`).

### C. Act 1 Hero Overlay & "Dive Underground" CTA in `SoilScene.tsx`
- When `diveStage === "field"`:
  - Display a prominent, inviting **"Dive underground (0–150 cm) ↓"** button.
  - Display a clean field summary chip: Field region, area in feddan, and current crop name.
  - Clicking the CTA triggers the smooth cinematic camera glide into the subterranean core.

---

## 3. Implementation Steps & Verification

1. [ ] Fix `z-index` stacking in `SoilScene.css`.
2. [ ] Overhaul `plantField` and density in `SceneController.ts`.
3. [ ] Add Act 1 Hero CTA and field summary in `SoilScene.tsx`.
4. [ ] Run `npm --prefix web run typecheck` and `npm --prefix web run build`.
5. [ ] Verify `python scripts/check_i18n.py` and API test suite.
