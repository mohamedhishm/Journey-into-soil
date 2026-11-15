# Plan: Independent Field & Soil Profile Scenes & Centered Cattle Herd

**Date:** 2026-11-13  
**Status:** Completed  
**Author:** Antigravity Team  
**Scope:** `web` (`SceneController.ts`, `SoilScene.tsx`, `SoilScene.css`)

---

## 1. Problem Diagnosis & Motivation

1. **Cows Distance & Placement**:
   - *User Feedback*: *"Now the cows are too close in. Center them in the middle."*
   - *Diagnosis*: In the previous turn, the cows were moved too close to the camera lens (`z = 1.8 to 4.2`, scale 0.42), which felt crowded and in-your-face.
   - *Fix*: Move the cattle herd into the true visual center and midground of the farm (`z = -7.5 to -12.5`, `x = -3.5 to +3.5`), scale them to natural proportions (`0.30 - 0.33`), and center the pasture clearing so the herd sits in the composition's golden focal sweet spot.

2. **Decouple Scenes & Fix Topsoil Moving Down**:
   - *User Feedback*: *"can we make the scenes be independent of each other because I have noticed the topsoil itself move down with the camera and it shouldn't be happening"*
   - *Diagnosis*: The previous implementation inherited a continuous descent trick where a foreground ground block (`frontG`) was plunged downwards by -15 meters (`frontG.position.y = -15 * ...`) to simulate an elevator descending underground. This created the bizarre visual artifact where the ground/topsoil appeared to collapse or fall down with the camera!
   - *Fix*: Decouple into two clean, independent scenes:
     - **Scene 1 (Field View / Act 1)**: Above-ground Egyptian farm with stable surface at `y = 0` (zero sinking or falling blocks). Clear blue sky, date palms, crops, and cattle herd centered in the middle pasture.
     - **Scene 2 (Soil Horizon Profile / Act 2 & 3)**: Underground geological cross-section monolith (0–150 cm). Topsoil (0–20 cm) stays firmly at the top (`y = 0` to `-1.5m`); subsoil, root zone, and substratum stacked in proper geological order below. In exploded view, layers expand symmetrically with topsoil remaining at the top.
     - **Smooth Transition**: Transitioning between Field and Soil Profile smoothly shifts the camera and scene visibility rather than physically dropping the ground into the earth.

---

## 2. Technical Architecture & Changes

### A. Scene Decoupling in `SceneController.ts`
- **Root Architecture**:
  - `fieldSceneGroup`: Contains the stable surface terrain slab, instanced crops, date palm shelterbelts, and centered grazing cattle herd. Active and visible during `stage === "field"`.
  - `profileSceneGroup`: Contains the 4 geological soil horizon slabs (0–20cm, 20–50cm, 50–90cm, 90–150cm) with their high-res bump textures, depth callouts, and inspection metadata. Active and visible during `stage === "underground"` and `stage === "layers"`.
  - Eliminate the artificial dropping curtain (`frontG.position.y = -15`).
- **Topsoil Stability**:
  - Topsoil slab (`slabs[0]`) remains anchored at `y = 0` to `-1.5m`.
  - In exploded mode (`layers`), slabs separate downward from the topsoil anchor:
    - Layer 0 (0–20 cm): `y = -0.75m` (topsoil anchor)
    - Layer 1 (20–50 cm): `y = -0.75 - (1.5 + gap)`
    - Layer 2 (50–90 cm): `y = -0.75 - (1.5 + gap) - (1.7 + gap)`
    - Layer 3 (90–150 cm): `y = -0.75 - (1.5 + gap) - (1.7 + gap) - (1.5 + gap)`
  - Topsoil never drops below its geological position.

### B. Centered Cattle Herd Placement
- **Coordinates & Framing**:
  - Position the herd in the middle pasture clearing of the field (`z = -7.5 to -12.5`, `x = -3.2 to +3.2`):
    - Cow 1 (Mother Holstein): `x = -0.8, y = 0.75, z = -8.5`, rotation: `0.65`, scale: `0.33`
    - Cow 2 (Playful Calf): `x = 0.7, y = 0.75, z = -7.8`, rotation: `1.35`, scale: `0.20`
    - Cow 3 (Companion Holstein): `x = 2.4, y = 0.75, z = -9.8`, rotation: `-1.85`, scale: `0.31`
    - Cow 4 (Companion Cow): `x = -2.6, y = 0.75, z = -10.5`, rotation: `2.15`, scale: `0.31`
    - Cow 5 (Grazing Cow): `x = 0.4, y = 0.75, z = -12.2`, rotation: `-0.45`, scale: `0.30`
    - Cow 6 & 7 (Pasture Margins): `x = 4.5, z = -11.5` and `x = -4.2, z = -13.0` (scale: `0.30`)
- **Pasture Clearing**:
  - Wheat crops on `slabs[0].g` will have a centered exclusion zone (`x: -5.5 to +5.5, z: -6.5 to -14.0`) so the herd stands visibly in their open pasture.

### C. Camera Orchestration
- **Field Mode (`field`)**:
  - Camera at `[0, 2.4, 9.5]`, looking at `[0, 1.2, -10.0]` (directly centered on the cattle herd and middle field).
- **Soil Profile Mode (`underground` / `layers`)**:
  - Camera smoothly transitions to front elevation view: `[0, -3.8, this.D]`, looking at `[0, -3.8, 0]` to face the geological soil profile head-on.
  - Cross-fade sky gradient to clean dark underground ambient.

---

## 3. Verification Plan
- `npm --prefix web run typecheck`
- `npm --prefix web run build`
- `python scripts/check_i18n.py`
- `pytest api/tests -q` & `ruff check api`
- Visual validation in browser:
  1. Act 1: Cattle herd is centered in the middle of the field with balanced perspective.
  2. Ground is completely stable (no falling or sinking blocks).
  3. Underground view: Topsoil stays at the top of the soil column.
