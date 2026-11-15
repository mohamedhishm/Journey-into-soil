# Implementation Plan: Full-Layer Distributed Root Rhizosphere & High-Visibility Root Network

**Date:** 2026-11-14  
**Author:** Antigravity (The Shifters)  
**Target:** NASA Space Apps 2026 - Field Shift  
**Related Rules:** Plan-First Protocol (`.gemini/config/rules/plan-first.md`), Zero-Emoji Policy, Three.js Encapsulation in `SceneController.ts`

---

## 1. Problem Statement & Root Cause
1. **Single Root Plant for Entire 60m Field:**
   In `SceneController.ts`, `this.rootGroup` was only instantiated once and anchored at $X = 0$. Across the 60-meter wide cutaway face ($X \in [-28, +28]$) where hundreds of crop plants are growing on top, only the single plant at $X = 0$ had roots beneath it. All crops across the remaining 58 meters had empty soil beneath them, appearing completely illogical.
2. **Occlusion & Clipping into Solid Soil Slab:**
   The single root system at $X = 0$ had lateral roots with negative Z rotations (`rotX < 0` / $\theta > 0$) that penetrated behind $Z = 0$ into the opaque soil block. Furthermore, bump mapping on the soil slab caused surface clipping. Consequently, viewers only saw a single vertical taproot cylinder.

---

## 2. Technical Architecture & Changes

### A. Distributed Multi-Plant Root System Across Layer 1 (`SceneController.ts`)
- Replace the single $X = 0$ root mesh with a continuous distributed root network across the cutaway front face:
  - **13 Primary Plant Root Clusters** positioned under front-row crops at $X \in [-24, -20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20, 24]$.
  - **12 Intermediate Feeder Root Clusters** at $X \in [-22, -18, -14, -10, -6, -2, 2, 6, 10, 14, 18, 22]$.
  - **Interconnected Rhizosphere Web:** Lateral feeder roots and secondary rootlets extending sideways to interlock between neighboring plants across the entire topsoil horizon ($y \in [-0.05, -1.45]$).
  - **Subsoil Anchoring:** Anchor plants ($X = -12, -4, 0, 4, 12$) have deep roots descending into Layer 2 and Layer 3.

### B. Anti-Occlusion & High-Contrast Material Setup
- **Strict Front-Plane Positioning:** All roots placed at $Z \in [0.08, 0.16]$, strictly ahead of the soil slab face ($Z = 0$). No negative Z rotations.
- **Depth Offset:** Enable `polygonOffset: true`, `polygonOffsetFactor: -2`, `polygonOffsetUnits: -2` on `rootMat` to prevent any Z-fighting or bump map clipping.
- **Botanical Contrast Material:**
  - Color: Rich ivory `0xfbf6ec`
  - Roughness: `0.65`
  - Emissive: `0x241d15` with `emissiveIntensity: 0.35`
  - Increased thickness: primary taproots ($0.07 - 0.09$), crown roots ($0.05 - 0.065$), laterals ($0.038 - 0.048$).
- **Minimum Growth Baseline:** Ensure baseline visible scale ($0.55 - 1.35$) so roots are distinct and legible even during early season periods.

---

## 3. Files Affected
- `web/src/scene/SceneController.ts`: Overhaul `buildRootSystem()` to construct a distributed multi-plant root network across the cutaway edge.
- `docs/plans/2026-11-14-dense-field-root-rhizosphere.md`: Plan record.

---

## 4. Verification & Quality Gates
1. `npm --prefix web run typecheck`: Green TypeScript validation.
2. `npm --prefix web run build`: Clean production bundle build.
3. `python scripts/check_i18n.py`: Parity check.
4. Zero-Emoji Check: Regex scan.
5. Deploy to OCI host and verify live with HTTP 200.
