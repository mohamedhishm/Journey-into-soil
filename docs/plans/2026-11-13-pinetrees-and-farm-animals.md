# Plan: Add Pine Tree Windbreaks & Farm Livestock (Cows) to 3D Scene

**Date:** 2026-11-13  
**Status:** Completed  
**Author:** Antigravity Team  
**Scope:** `web` (`SceneController.ts`)

---

## 1. Goal & Requirements
1. **Pine Trees Windbreak**: Add authentic pine tree shelterbelts along the field borders (left, right, and back horizon) to frame the agricultural crop field, create depth, and eliminate any sense of emptiness in Act 1.
2. **Cattle / Livestock Models**: Research and implement lightweight Three.js cow models grazing peacefully in the pasture / field margin.

---

## 2. Technical Approach

### A. Procedural Pine Tree Generation in Three.js
- **Geometry**:
  - Wooden Trunk: `CylinderGeometry(0.14, 0.22, 1.5, 6)` at `y = 0.75` with rich bark material (`#3d2714`).
  - 3 Conical Foliage Tiers:
    - Base Tier: `ConeGeometry(1.2, 1.4, 7)` at `y = 1.6` (`#1b3a1d`).
    - Mid Tier: `ConeGeometry(0.9, 1.2, 7)` at `y = 2.4` (`#244b27`).
    - Top Tier: `ConeGeometry(0.6, 1.0, 7)` at `y = 3.1` (`#2e5c32`).
- **Placement & Distribution**:
  - Left shelterbelt: 8 trees spaced along `x = -24 to -26`, `z = -48 to 6`.
  - Right shelterbelt: 8 trees spaced along `x = 24 to 26`, `z = -48 to 6`.
  - Back ridge / horizon line: 10 trees along `x = -26 to 26`, `z = -50 to -54`.
  - Staggered scale variations (`0.85` to `1.3`) and random rotations for an organic forest windbreak look.
- **Parenting**:
  - Trees are parented to the ground surfaces (`slabs[0].g` and `frontG`) so they move synchronously with the terrain and naturally drop during the subterranean dive.

### B. Farm Livestock (Cows) Research & Options
1. **Option 1: Procedural Low-Poly Grazing Cow (Recommended)**:
   - Built natively in Three.js using primitives (body, head with snout and horns, 4 legs with hooves, udder, and tail).
   - Holstein-Friesian black & white coat pattern or warm brown cowhide.
   - Idle grazing animation (subtle head bobbing and tail swishing).
   - **Pros**: Zero external network requests, zero bundle weight, instantly renders, fits the biophilic low-poly aesthetic.
2. **Option 2: External GLTF/GLB Model**:
   - Download a CC0 low-poly cow GLTF (e.g., Kenney/Poly Pizza) and load via `GLTFLoader`.
   - **Pros**: Detailed rigged mesh if complex animations are needed.
   - **Cons**: Adds asynchronous network/file loading and asset bundling overhead.

---

## 3. Implementation Steps & Verification

1. [x] Implement `createPineTree()` and tree-line distribution in `SceneController.ts`.
2. [x] Implement procedural articulated `createCow()` with Holstein and Jersey breeds in `SceneController.ts`.
3. [x] Add continuous grazing head bob and tail swish animation in `frame()`.
4. [x] Carve out dedicated livestock pasture clearing on `frontG` so cows stand in short grass/pasture.
5. [x] Verify `npm --prefix web run typecheck` and `npm --prefix web run build`.
6. [x] Verify `python scripts/check_i18n.py`, `pytest api/tests -q`, and `ruff check api`.
