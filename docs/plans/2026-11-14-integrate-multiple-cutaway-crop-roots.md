# Plan: Integrate Multiple Realistic Cutaway Crop Roots Across Layer 1

**Date:** 2026-11-14  
**Author:** Antigravity Team  
**Scope:** `web/src/scene/SceneController.ts`, `docs/plans/2026-11-14-integrate-multiple-cutaway-crop-roots.md`  
**Target Asset:** `web/public/textures/crop_root.png`

---

## 1. Problem Statement & User Goal

The user approved the isolated transparent root texture (`crop_root.png`) and requested:
*"Looks very solid. But don't add just one root into layer one add multiple to make it look realistic"*

### Objectives:
1. Distribute a continuous multi-plant root network along the front subterranean cutaway face ($X \in [-24, +24]$) across Layer 0 and Layer 1.
2. Ensure each root system anchors directly beneath the surface crops (wheat / maize stalks).
3. Introduce natural organic variations across stations:
   - Staggered horizontal positions with alternating mirrored orientations (`scale.x = 1` vs `scale.x = -1`).
   - Natural scale variations ($0.85$ to $1.15$).
   - Multi-tier depth planes ($Z = 0.06$ to $0.12$) to create biological parallax and depth.
   - Anchor deep-rooting plants extending into Layer 2.
4. Wire the root group to the daily simulation progression (`root_cm`), scaling vertically downward from the soil surface ($y = 0$).

---

## 2. Technical Architecture in `SceneController.ts`

### A. Root Texture Loading
- Load `/textures/crop_root.png` via `THREE.TextureLoader` with `sRGBColorSpace` and `anisotropy = 8`.
- Apply a `MeshStandardMaterial` with:
  - `transparent: true`
  - `alphaTest: 0.08`
  - `roughness: 0.65`, `metalness: 0.05`
  - `depthWrite: false` (eliminates sorting and transparency artifacts)
  - `polygonOffset: true` (`factor: -2, units: -2`) to prevent z-fighting against the cutaway soil block.

### B. Multi-Station Rhizosphere Layout
- Create 13 plant root stations across the 48m cutaway face:
  - Primary stations: $X \in [-24, -18, -12, -6, 0, 6, 12, 18, 24]$.
  - Interstitial/staggered stations: $X \in [-21, -15, -9, -3, 3, 9, 15, 21]$.
- For each station:
  - Plane geometry: `PlaneGeometry(width, height)` with top-aligned anchor (pivot at $y = 0$).
  - Varied scale ($W \approx 3.8 - 4.6$, $H \approx 2.1 - 2.8$ for standard plants; $H \approx 3.4$ for anchor deep roots).
  - Varied $Z$-offset ($Z = 0.06$ to $0.12$) and random/alternating horizontal flip to prevent visual repetition.

### C. Simulation Timeline Dynamics
- In `updateSoilVisuals(strat, day)`:
  - Scale `this.rootGroup.scale.set(rootSpreadScale, rootDepthScale, rootSpreadScale)`.
  - Base depth scale ranges from $0.35$ (day 0 seedlings) up to $1.4$ (mature crops at harvest).

---

## 3. Verification & Quality Gates

1. TypeScript compilation: `npm --prefix web run typecheck` (0 errors).
2. Production bundle build: `npm --prefix web run build`.
3. Bilingual key parity: `python scripts/check_i18n.py`.
4. Zero emoji scan: verify regex match = 0.
5. Deploy to OCI server (`141.253.121.245`) and verify live HTTP 200 on `https://theshifters.l4s3r.site/`.
