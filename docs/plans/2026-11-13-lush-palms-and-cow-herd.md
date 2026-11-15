# Plan: Lush Evergreen Palm Foliage & Expanded Field Cattle Herd

**Date:** 2026-11-13  
**Status:** Completed  
**Author:** Antigravity Team  
**Scope:** `web` (`SceneController.ts`)

---

## 1. Problem Statement & User Feedback

1. **Tree Color Preservation**:
   - The user noted: *"we need the trees to preserve its color which is supposed to be green"*.
   - **Root Cause**:
     1. The previous atmospheric fog had `near = 13m` and `far = 55m`. Because the camera starts at `z = 9.5m` and palm trees extend back to `z = -53m` (~62m away), trees were being heavily occluded by sandy desert fog (`#e8cf9b`), turning them pale khaki/tan.
     2. The frond materials had very low luminance (`0x244619` ~15% brightness) with high roughness (0.8), causing them to appear murky dark-olive rather than lush Egyptian date palm green.
2. **Cattle Herd Density**:
   - The user requested: *"and put more cows on the field"*.
   - Currently only 4 cows exist (3 in the foreground clearing and 1 distant). The farm feels underpopulated.

---

## 2. Proposed Technical Solution

### A. Vivid, Color-Preserved Date Palm Foliage
- **Atmospheric Fog Recalibration**:
  - Adjust `scene.fog = new THREE.Fog(0xe8cf9b, 28, 105)`.
  - Ensures 0% fog wash on the foreground and midground field (`z = 9.5m` to `-25m`), and only a soft aerial perspective at the far horizon (`z = -53m`).
- **Material Vibrancy & Specular Response**:
  - `matFrondLow`: `#2a7a1c` (rich emerald palm green) + waxy cuticle sheen (`roughness: 0.55`, `metalness: 0.05`) + subtle vibrant emissive tint (`#0a2406`, intensity: 0.22) to prevent shadows from turning muddy.
  - `matFrondMid`: `#389a24` (vibrant mid canopy green) + emissive `#0d2e08`.
  - `matFrondHigh`: `#52b82e` (luminous crown spear green) + emissive `#143c0c`.
  - Guarantees palm fronds stay distinctly green from any camera angle, distance, and lighting condition.

### B. Expanded Cattle Herd (11 Cows Distributed Across Farm)
- **Foreground Paddock on `frontG`** (5 cows):
  1. Mother Holstein (`-9.5, 0, 7.2`, scale: 0.31)
  2. Companion Holstein (`-12.8, 0, 9.6`, scale: 0.28)
  3. Playful calf (`-7.2, 0, 8.8`, scale: 0.17)
  4. Second calf exploring (`-11.2, 0, 6.2`, scale: 0.18)
  5. Grazing Holstein (`-5.5, 0, 10.5`, scale: 0.30)
- **Main Agricultural Field & Headland Grazing Margins on `slabs[0].g`** (6 cows):
  6. Right field margin grazing (`16.5, HT[0]/2, -7.0`, scale: 0.30)
  7. Right mid-field grazing (`15.0, HT[0]/2, -15.0`, scale: 0.29)
  8. Right canal path grazing (`12.5, HT[0]/2, -23.0`, scale: 0.28)
  9. Left field margin grazing (`-17.5, HT[0]/2, -9.5`, scale: 0.31)
  10. Left mid-field grazing (`-14.5, HT[0]/2, -22.0`, scale: 0.29)
  11. Distant horizon grazing (`-3.0, HT[0]/2, -32.0`, scale: 0.27)
- **Independent Idle Desynchronization**:
  - Each cow instance receives an `AnimationMixer` with randomized start times (`Math.random() * 3.5s`), producing an organic, living herd with natural grazing, breathing, and tail movements.

---

## 3. Verification Plan
- [x] `npm --prefix web run typecheck`
- [x] `npm --prefix web run build`
- [x] `python scripts/check_i18n.py`
- [x] `pytest api/tests -q` & `ruff check api`
