# Plan: Restore Authentic Organic Root Splines & Botanical Shading from Git History

**Date:** 2026-11-14  
**Author:** Antigravity Team  
**Scope:** `web/src/scene/SceneController.ts`, `docs/plans/2026-11-14-restore-authentic-git-history-roots.md`  
**Reference Git Commits:** `999e7df` ("add subterranean trench backdrop, lush crop canopy and embedded roots"), `241146d`, `docs/screenshots/stage_3_stratified_layers.png`

---

## 1. Problem Analysis & Git History Investigation

In the previous turn, the user noted:
*"This wasn't the old root texture/model look back at the git history and bring those back"*

### What Happened in Git History:
1. **The Authentic Original Root Model (`999e7df`, `241146d`, `3f5e3aa`):**
   - In git commits prior to `a5bb38d` (as documented in `docs/plans/2026-11-13-atmosphere-canopy-and-roots.md` and visually preserved in `docs/screenshots/stage_3_stratified_layers.png`), roots were **NOT straight rigid cylinder sticks**.
   - Roots were constructed as **smooth, organic 3D spline tubes** (`MeshBuilder.CreateTube`) with continuous radius tapering from root base to tip.
   - For cereals (Wheat, Maize, Barley), each plant featured a **fibrous crown root system**: 6–8 arching, curved coronal root strands spreading laterally and downward (`currX = x0 + spread * Math.pow(frac, 0.75) * 1.1 + Math.sin(s * 0.9 + p * 3) * 0.035`).
   - For taproots, roots featured a central wavy, meandering primary root (`Math.sin(s * 0.85 + seedVal) * 0.035`) with curved secondary lateral bifurcations.
   - The material was authentic **botanical ivory/cream root tissue** (`diffuseColor: Color3(0.92, 0.88, 0.78)`, `emissive: Color3(0.06, 0.05, 0.04)`), yielding natural organic subsurface shading rather than flat chalk-white plastic.

2. **What Went Wrong in Recent Commits (`5235dd7`, `07a0629`):**
   - When Three.js was adopted in `a5bb38d`, the demo lacked 3D roots.
   - Commit `5235dd7` introduced a temporary placeholder made of 3 straight vertical cylinders (`seg1, seg2, seg3`) and a few fixed diagonal cylinder sticks (`lateralData`).
   - When asked to "bring back the old roots model", commit `07a0629` mistakenly duplicated those rigid straight cylinders, creating an unnatural, segmented appearance.

---

## 2. Proposed Technical Implementation in Three.js

We will implement the exact mathematical spline curves, continuous tapering, and organic botanical material from `999e7df` inside `SceneController.ts` using Three.js:

### A. Parametric Tapering Tube Generator (`createTaperedTubeGeometry`)
- Build a robust tube geometry builder that extrudes along any sequence of 3D points (`Vector3[]`) with a continuous radius function `radiusAt(t)` and compute smooth vertex normals.
- Merge all root geometries for each station into an optimized single `BufferGeometry` for 60 FPS performance and a single draw call.

### B. Authentic Botanical Morphology (`buildRootSystem`)
1. **Multi-Plant Rhizosphere Distribution:**
   - 9 plant stations distributed across the cutaway front face: $X \in [-22, -16.5, -11, -5.5, 0, 5.5, 11, 16.5, 22]$.
   - Each root crown anchors directly beneath surface crop stalks.
2. **Dense Fibrous Crown System (Wheat & Maize):**
   - 6 to 8 arching, curved main root strands per plant fanning outwards:
     - $y(s) = \text{frac} \cdot \text{depth}$
     - $x(s) = x_0 + \text{spread} \cdot \text{frac}^{0.75} \cdot 1.25 + \sin(s \cdot 0.9 + \text{seed}) \cdot 0.04$
     - $z(s) = \sin(s \cdot 1.1 + \text{seed}) \cdot 0.02$
   - Continuous smooth taper: base radius 0.040 down to 0.010 at tip.
3. **High-Density Layer 1 Lateral Rootlets:**
   - Radiate 8-12 fine lateral feeding rootlets per plant throughout Layer 1 ($y \in [-0.15, -1.45]$), arching outward through the topsoil pores.
4. **Anchor Plant Subsoil Penetration:**
   - Central and intermediate anchor plants ($X = -11, 0, 11$) continue deeper into Layer 2 and Layer 3 ($y \in [-1.5, -4.2]$), simulating mature perennial and deep-rooting behavior.

### C. Authentic Biological Material & Texture
- Replicate the material properties from `999e7df`:
  - `color: 0xede4d3` (natural ivory/cream organic tissue).
  - `roughness: 0.62`, `metalness: 0.04`.
  - Subtle warm ambient reflection (`emissive: 0x14100c`).
  - `polygonOffset` enabled (`factor: -2, units: -2`) to prevent any z-fighting against the cutaway soil face.

---

## 3. Verification & Quality Gates

1. Run `npm --prefix web run typecheck` (0 errors).
2. Run `npm --prefix web run build` (successful production bundle).
3. Run `python scripts/check_i18n.py` (maintain full key parity).
4. Verify strictly ZERO emojis in all modified files.
5. Deploy to OCI server (`141.253.121.245`) and verify live HTTP 200 at `https://theshifters.l4s3r.site/`.
