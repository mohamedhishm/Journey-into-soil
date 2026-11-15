# Plan: Reposition Cattle to Immediate Foreground & Enlarge Visual Scale

**Date:** 2026-11-13  
**Status:** Completed  
**Author:** Antigravity Team  
**Scope:** `web` (`SceneController.ts`)

---

## 1. Root Cause Diagnosis

### Why did the cows look too far away?
1. **Frustum Clipping of Near Cows**:
   - The camera starts at `[1, 1.7, 9.5]`, looking forward into the distance at `[0, 1.1, -30]` with a `38°` FOV.
   - At distance `z = 7` to `9` (near the camera), the visible width of the screen is only `±1.8m` from center (`x ≈ -1m to +3m`).
   - The nearest cows were placed at `x = -9.5` and `x = -12.8`, placing them **77° off-axis to the left**, far outside the screen borders!
   - As a result, the only cows visible in the camera viewport were the background cows located at `z = -14m` to `-32m` (24–42 meters away from the camera), where they appeared as tiny distant dots.
2. **Sub-optimal Scale**:
   - The scale of `0.30` at 30 meters appears only ~15–20 pixels tall. At 5–7 meters, a scale of `0.38`–`0.42` gives a full-bodied, prominent, cinematic presentation of the cow.

---

## 2. Proposed Solution

### A. Place Primary Herd in Immediate Foreground Viewport (`frontG`)
Position the main cattle group right in front of the camera (distance: 5.5m–7.5m, `z = 2.0 to 4.5`):
- **Mother Holstein Cow**: Center-left foreground (`x: -2.2, z: 2.8`), rotated slightly toward the camera (`rotY: 0.85`), scale: `0.40` (~1.9m tall, beautifully detailed and prominent).
- **Playful Calf**: Standing beside the mother (`x: -0.6, z: 3.5`), rotY: `1.2`, scale: `0.23` (~1.1m tall).
- **Companion Holstein Cow**: Center-right foreground (`x: 2.8, z: 2.2`), grazing sideways (`rotY: -2.1`), scale: `0.38`.
- **Second Grazing Cow**: Left foreground (`x: -4.2, z: 4.2`), rotY: `2.6`, scale: `0.36`.

### B. Shift Foreground Pasture Clearing
- Expand the crop exclusion zone on `frontG` to encompass `x: -5.5 to +4.5` and `z: 0 to 6.5`.
- This creates an open grassy meadow right in front of the camera where the cows stand in full, unobstructed view with zero tall wheat stalks blocking them.

### C. Tiered Midground & Horizon Cows (`slabs[0].g`)
- Keep 5 cows at tiered depths (`z: -8m, -16m, -25m`) along the headlands and canal margins to maintain rich depth of field and rural agricultural scale.

---

## 3. Verification Plan
- [x] `npm --prefix web run typecheck`
- [x] `npm --prefix web run build`
- [x] `python scripts/check_i18n.py`
- [x] `pytest api/tests -q` & `ruff check api`
- [x] In-browser visual check: cows are prominent and front-and-center in Act 1.
