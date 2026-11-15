# Plan: Lush Agricultural Vegetation & Seamless Geological Terrain

**Date:** 2026-11-13  
**Status:** In Progress / Awaiting User Feedback  
**Author:** Antigravity Team  
**Scope:** `web` (`SceneController.ts`, `SoilScene.css`)

---

## 1. Problem Analysis & Root Causes

The user reported:
> "Still the simulation looks very bad and generic. The block of soil which we focus on looks like a stand-out block of the land. and the vegetation isn't enough we need more vegetation"

Investigation reveals two fundamental architectural and visual causes in `web/src/scene/SceneController.ts`:

### Cause 1: Why the Central Block "Stands Out" like a Severed Block
1. **Thin 25cm Wafer Ground vs 6.2m Deep Monolith**:
   - The surrounding field boxes (`fieldNorth`, `fieldSouth`, `fieldEast`, `fieldWest`) were given a height of only `h = 0.25m` (from `y = 0` down to `y = -0.25m`).
   - Meanwhile, the 4 soil strata layers beneath the central plot extend **6.2 meters down** (to `y = -6.2m`).
   - In front of the monolith, `fieldSouth` had `h = 0.25m`. Below `-0.25m`, there was literally **empty air** in front of the 6-meter subterranean soil block!
   - From any camera pitch or angle, the user saw a 6-meter cube of soil hanging down into the void beneath a paper-thin wafer floor!
2. **Top Face Material & Texture Scale Mismatch**:
   - `layer0` top face used `layerMat0` with a 2-tile stretch (`uRepeat = 2.0`), and its diffuse color was dynamically modulated by daily soil moisture (`new Color3(k, k, k)` gray).
   - The surrounding ground used `surroundingFieldMat` with `Color3(0.42, 0.36, 0.28)` loam and `uScale = 24.0`.
   - As a result, the central 8m × 4m rectangle was a bright gray, blurry box sitting in the middle of dark, high-frequency dirt with visible seams on all 4 edges.

### Cause 2: Why the Vegetation Looked Sparse & Generic
1. **Extremely Low Density**:
   - The central 8m × 4m plot (32 m²) had only 240 plants (~7 plants per m²), leaving massive bare dirt gaps.
   - The outer 1,000 m² field had only ~500 plants (~0.5 plants per m²), meaning plants were spaced up to 2 meters apart!
2. **Primitive 3-Stick Geometry**:
   - Each tuft was composed of only 3 bare 4-sided cylinders with no leaf width, no volume, no wheat head/seed ear, and no ground understory.
   - It looked like green toothpicks stuck in dirt rather than a lush agricultural crop.

---

## 2. Proposed Solutions

### A. Seamless Deep Geological Terrain (Fixing the Stand-Out Block)
1. **Full-Depth Geological Surroundings**:
   - Extend the height of `fieldNorth`, `fieldSouth`, `fieldEast`, and `fieldWest` to `h = 8.0m` (extending from `y = 0` down to `y = -8.0m`).
   - In Act 1, the entire earth is a solid, continuous geological mass. The front ground plane completely conceals the subterranean layers until Act 2.
   - In Act 2 ("The ground opens"), `frontGroundNode` smoothly slides down (`y: 0 -> -15m`), physically parting the earth like a curtain to reveal the 4 soil strata and root system for the first time.
2. **Unified Seamless Topsoil Surface**:
   - Create a continuous topsoil surface cap on `layer0` sharing the exact same material (`surroundingFieldMat`), diffuse color, texture scale, and specular sheen as the surrounding field.
   - Eliminates all rectangular seams, color mismatches, and wafer borders in Act 1.

### B. Lush Agricultural Vegetation Architecture (Fixing the Generic & Sparse Look)
1. **Botanical Multi-Tier Crop Tuft Mesh**:
   - **Wheat / Grain Ear (Spikelet)**: Tapered central cereal grain head at `y = 0.85`–`1.25m` with warm golden-amber grain tones.
   - **Broad Arching Canopy Blades**: 6 curved, flattened ribbon-like leaves (`Vector3(2.4, 1.0, 0.45)`) radiating outward in 6 compass directions to create real leaf surface area that catches light and cast shadows.
   - **Ground Understory Foliage**: Dense, low-arching basal blades to cover the soil and eliminate bare dirt patches between planting rows.
2. **4× Instance Density (True Sea of Crops)**:
   - Central Core: Increase to **720–960 tufts** (24 rows × 40 plants).
   - Surrounding North & South Farmland: Increase to **2,400+ tufts** arranged in agricultural furrow rows.
   - Total scene foliage: **3,200+ tufts with 22,000+ leaves** rendered via Babylon.js thin instances at 60 FPS in just 3 draw calls.
   - Overlapping foliage completely conceals any ground seams and forms a continuous, waving sea of agricultural wheat/crops.

---

## 3. Implementation Steps
1. [ ] **Update `SceneController.ts`**:
   - Deepen `fieldNorth`, `fieldSouth`, `fieldEast`, `fieldWest` to `h = 8.0m`.
   - Add unified `topsoilCap` on `layer0` matching `surroundingFieldMat`.
   - Rebuild `buildBlades()` with rich 7-element botanical tuft (wheat ear + 6 broad arching blades).
   - Increase instance grid density across central plot and surrounding field rows.
2. [ ] **Verify Quality Gates**:
   - `npm --prefix web run typecheck && npm --prefix web run build`
   - `python scripts/check_i18n.py`
   - `pytest api/tests -q` and `ruff check api`
3. [ ] **Commit Changes**:
   - `feat(web): add lush multi-tier crop vegetation and seamless full-depth terrain`
