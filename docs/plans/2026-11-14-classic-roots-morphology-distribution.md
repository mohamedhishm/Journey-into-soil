# Implementation Plan: Restoring Classic Root Morphology with Multi-Plant Distribution & Layer 1 Density

**Date:** 2026-11-14  
**Author:** Antigravity (The Shifters)  
**Target:** NASA Space Apps 2026 - Field Shift  
**Related Rules:** Plan-First Protocol (`.gemini/config/rules/plan-first.md`), Zero-Emoji Policy, Three.js Encapsulation in `SceneController.ts`

---

## 1. Problem Statement & User Intent
- The user loved the clean, elegant aesthetic of the original root model (the vertical central taproot with diagonal lateral cylinders branching outward at clean angles).
- However, the user wants the exact same "treatment" applied to it:
  1. **Layer 1 Density:** Increase the number of lateral feeder roots in Layer 1 ($y \in [-0.1, -1.4]$) from just 4 to 14–16 densely spaced laterals per plant.
  2. **Multi-Plant Distribution:** Replicate this clean root model across the front cutaway edge beneath the crops ($X \in [-21, -14, -7, 0, 7, 14, 21]$) so multiple plants have full root systems across the entire layer instead of a single lone root in the center.
  3. **High Visibility & Anti-Clipping:** Position the root group at $Z = 0.12$ in front of the cutaway face, apply `polygonOffset`, and keep all branches in the visible front plane so every root is 100% visible without soil slab occlusion.
  4. **Smooth Phenology Scaling:** Ensure baseline visibility scale ($0.65 - 1.45$) so roots remain clear across all simulation dates.

---

## 2. Technical Architecture & Changes

### A. Root Architecture (`web/src/scene/SceneController.ts`)
- Revert to the clean, classic Three.js taproot + lateral cylinders structure:
  - `seg1`: Primary vertical taproot (`CylinderGeometry(0.09, 0.07, 1.4, 7)`) in Layer 1.
  - `seg2`: Deep taproot (`CylinderGeometry(0.07, 0.05, 1.6, 7)`) in Layer 2.
  - `seg3`: Deep taproot (`CylinderGeometry(0.05, 0.02, 1.8, 6)`) in Layer 3.
- Densely populate Layer 1 laterals:
  - 16 lateral root branches per plant in Layer 1 ($y \in [-0.15, -1.35]$) with alternating angles (`rotZ: ±0.70, ±0.64, ±0.58, ±0.52...`) and lengths ($0.9\text{m} - 1.8\text{m}$).
  - Retain clean deeper laterals in Layers 2 and 3 ($y = -1.7, -1.9, -2.6, -2.8, -3.4, -3.6$).
- Distribute across the cutaway:
  - Spawn root systems across $X \in [-21, -14, -7, 0, 7, 14, 21]$ under the front crop line.
  - Anchor plants ($X = -14, 0, 14$) have full deep taproots; intermediate plants have full Layer 1 roots and upper Layer 2 roots.

### B. Material & Anti-Clipping Settings
- `rootMat`:
  - `color: 0xfdf7ee` (crisp ivory)
  - `roughness: 0.68`
  - `metalness: 0.04`
  - `polygonOffset: true`
  - `polygonOffsetFactor: -2`
  - `polygonOffsetUnits: -2`
- Root group placed at $Z = 0.12$ on `slabs[0].g`.

---

## 3. Files Affected
- `web/src/scene/SceneController.ts`
- `docs/plans/2026-11-14-classic-roots-morphology-distribution.md`

---

## 4. Verification & Quality Gates
1. `npm --prefix web run typecheck`
2. `npm --prefix web run build`
3. `python scripts/check_i18n.py`
4. Regex scan for emojis
5. Deploy to OCI host and verify live with HTTP 200
