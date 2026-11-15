# Plan: Egyptian Date Palms & Realistic 3D Animated Cattle

**Date:** 2026-11-13  
**Status:** Completed  
**Author:** Antigravity Team  
**Scope:** `web` (`SceneController.ts`, `web/public/models/cow.glb`)

---

## 1. Context & Motivation

1. **Egyptian Farmland Authenticity**:
   - Pine trees (temperate conifers) are non-native to Egyptian agricultural soil.
   - Farmland across the Nile Delta (Kafr El-Sheikh, Dakahlia, Sharqia, Beheira) is historically lined by **Date Palm Trees (Phoenix dactylifera / نخيل البلح)** along irrigation canals, field borders, and roadsides.
   - Date palms provide natural wind protection, authentic regional visual cues, and iconic silhouettes (tall ringed fibrous trunks, radiating pinnate frond crowns, and hanging amber date clusters / عراجين البلح).

2. **Organic Cattle Models**:
   - The user noted that the previous procedural box cattle looked like "squares stacked on top of each other."
   - We sourced the official CC0 low-poly animated Cow model from the Three.js ecosystem (Quaternius), packaged it as a single offline binary (`web/public/models/cow.glb`), and verified it serves locally with 0 external network requests (strictly complying with AGENTS.md Rule 7).
   - This model includes smooth organic anatomy, textures (Holstein coat, pink snout, horns, hooves), a skeletal armature, and built-in idle grazing animations (breathing, head nodding, ear and tail twitching).

---

## 2. Technical Architecture & Changes

### A. Procedural Egyptian Date Palm System (`SceneController.ts`)
- **Trunk**:
  - Height: 6.5m to 9.5m (scale factor 0.85 to 1.3).
  - Tapered fibrous cylinder (`CylinderGeometry(0.28, 0.42, 7.2, 8, 6)`) with subtle organic curve and 8 ring collars mimicking pruned leaf scars.
  - Material: Warm grey-brown weathered fiber bark (`#5c4835`, roughness 0.9).
- **Crown & Fronds**:
  - 22 arching pinnate fronds arranged in 3 organic tiers:
    - **Lower tier (8 fronds)**: Drooping downward (pitch ~70° from vertical, length 4.2m, deep forest date green `#254519`).
    - **Mid tier (8 fronds)**: Arching outward (pitch ~48°, length 3.8m, rich green `#335e21`).
    - **Upper spear tier (6 fronds)**: Erect and slightly flared (pitch ~25°, length 3.0m, vibrant yellow-green `#4a7c2b`).
  - Each frond features an arched spine and tapered leaf blade.
- **Date Fruit Clusters (عراجين البلح)**:
  - 2 to 3 amber-orange fruit clusters (`#d46e16`, `#bf5d12`) hanging beneath the canopy on curved stalks.
- **Placement**:
  - Left canal line: 8 palms (`x: -26.5m`, `z: -50m to -2m`).
  - Right canal line: 8 palms (`x: 26.5m`, `z: -50m to -2m`).
  - Horizon ridge: 12 palms (`x: -25m to 25m`, `z: -53m`).
  - Foreground perimeter: 4 palms on `frontG` framing the camera view in Act 1.
- **Tree Swapping**:
  - Completely remove `createPineTree()` and `plantPineTrees()`.
  - Replace with `createDatePalmTree()` and `plantDatePalms()`.

### B. Realistic 3D Cow Model Integration (`cow.glb`)
- **Asset**: `web/public/models/cow.glb` (627 KB, self-contained standalone binary with materials and animations).
- **Loader**: `three/examples/jsm/loaders/GLTFLoader.js`.
- **Herd Layout in Farmland**:
  - **Cow 1 (Mother Holstein)**: Placed in the foreground pasture clearing on `frontG` (`x: -9.5m, z: 7.2m`).
  - **Cow 2 (Pasture Holstein)**: Placed nearby (`x: -12.5m, z: 9.5m`, rotated).
  - **Cow 3 (Calf)**: Scaled to 0.6x (`x: -7.0m, z: 8.5m`).
  - **Cow 4 (Distant Grazing Cow)**: Placed along the distant edge on `slabs[0].g` (`x: 14.0m, z: -14.0m`).
- **Animation**:
  - For each cow instance, create a `THREE.AnimationMixer`.
  - Play the `'Idle'` clip (grazing, gentle breathing, tail flick).
  - Offset playback times (`mixer.setTime(Math.random() * 3.0)`) so the herd does not move in robotic unison.
  - In `frame(now)`: update mixers via `mixer.update(dt)`.

---

## 3. Files Affected
- `web/src/scene/SceneController.ts`: Replace pine trees with date palms, replace box cows with `GLTFLoader` instance loading and animation mixer loop.
- `web/public/models/cow.glb`: Bundled standalone binary asset.
- `docs/plans/2026-11-13-date-palms-and-gltf-cows.md`: This execution plan.

---

## 4. Verification Plan
1. [x] `npm --prefix web run typecheck`: Confirm no TS errors with `GLTFLoader` or `AnimationMixer`.
2. [x] `npm --prefix web run build`: Ensure Vite bundles cleanly with the new public asset.
3. [x] `python scripts/check_i18n.py`: Ensure i18n key parity remains untouched and clean.
4. [x] `pytest api/tests -q` & `ruff check api`: Confirm backend integrity.
5. [x] In browser: Verify tall date palms silhouette the sky with date clusters, and organic cows graze naturally in the clearing.
