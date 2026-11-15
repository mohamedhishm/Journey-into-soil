# Implementation Plan: 3D Maize Crop Morphology & Dense Layer 1 Root Architecture

**Date:** 2026-11-14  
**Author:** Antigravity (The Shifters)  
**Target:** NASA Space Apps 2026 - Field Shift  
**Related Rules:** Plan-First Protocol (`.gemini/config/rules/plan-first.md`), Zero-Emoji Policy, Three.js Encapsulation in `SceneController.ts`

---

## 1. Problem Statement & Motivation
1. **Scene Crop Diversity:**
   The 3D canvas currently only displays generic wheat/barley cone stalks regardless of which crop is active in the simulated rotation. In the default baseline strategy (`existing`), the rotation alternates between winter wheat and summer maize (`['wheat', 'maize', 'wheat']`). When users scrub into the summer season, the UI reports "Maize" / "ذرة", but the 3D scene continues displaying wheat geometry.
   *Goal:* Add authentic 3D Maize morphology (*Zea mays*): tall sturdy stalks (2.2m - 2.6m), alternating broad curved strap leaves, apex golden tassels, and mid-stalk ear shoots with dynamic switching based on `activeCrop`.

2. **Root Density in Layer 1:**
   In `buildRootSystem()`, Layer 1 (topsoil horizon, $y \in [0, -1.5]$, representing 0-20 cm depth) only features 4 sparse lateral cylinders. In agronomic reality, cereal and maize root systems concentrate 70-80% of root length density in the topsoil: crown root whorls, adventitious brace roots, and a dense network of lateral feeder roots and secondary rootlets.
   *Goal:* Substantially increase root density in Layer 1 by introducing crown root whorls, 16+ lateral branches, and secondary feeder rootlets, while preserving deeper taproot anchoring in subsoil layers.

---

## 2. Technical Architecture & Changes

### A. Subterranean Root System (`web/src/scene/SceneController.ts`)
- **Crown / Whorl Roots:**
  - 8 adventitious crown roots radiating at $y \in [-0.08, -0.32]$ with outward spread ($rotZ = \pm 0.72$ to $\pm 1.15$ rad).
- **Dense Primary Laterals in Layer 1:**
  - 16 primary lateral feeder roots across depth $y \in [-0.15, -1.35]$ at $0.075\text{m}$ depth intervals.
  - Alternating left/right orientations with randomized slight curvature and lengths between $0.8\text{m}$ and $2.2\text{m}$.
- **Secondary Branching Rootlets:**
  - Attach 2–3 fine secondary rootlets (`thick: 0.02`, `len: 0.4 - 0.65`) branching off primary laterals in Layer 1 to create an organic, interconnected feeder root web.
- **Deeper Layers (L2-L4):**
  - Retain vertical primary taproot and deeper anchoring laterals down to $-4.5\text{m}$.

### B. Procedural Maize Plant Morphology (`web/src/scene/SceneController.ts`)
- **Stalk (Culm):**
  - Cylinder geometry: height $2.4\text{m}$, base radius $0.09\text{m}$, top radius $0.06\text{m}$, with node rings.
- **Broad Arching Leaves (Blades):**
  - 4 alternating wide curved blade meshes ($0.26\text{m}$ wide, $1.1\text{m}$ span) arching outward and downward from the stalk nodes.
  - Double-sided rendering with standard material and vertex wind sway shader (`this.swayU`).
- **Apex Tassel (Male Panicle):**
  - Multi-spikelet golden-yellow cluster at the stalk apex ($y \approx 2.4 - 2.8\text{m}$, color `0xebd066`).
- **Corn Ears (Female Inflorescence):**
  - Husked cob swelling at mid-stalk ($y \approx 1.1\text{m}$) with golden silk tip.
- **Field Placement:**
  - Plant instanced maize fields across `fieldGroup` (above-ground farm) and `slabs[0].g` (cutaway surface).
- **Dynamic Crop Switching:**
  - In `updateSoilVisuals()`, evaluate `activeCrop`:
    - When `activeCrop === 'maize'`: `maizeMeshes.visible = true; wheatMeshes.visible = false;`
    - When `activeCrop === 'wheat'` (or default cereal): `wheatMeshes.visible = true; maizeMeshes.visible = false;`
    - Scale meshes dynamically with simulated canopy index (`canopy`).

---

## 3. Files Affected
- `web/src/scene/SceneController.ts`: Root system overhaul + Maize geometry generator & dynamic field switcher.
- `docs/plans/2026-11-14-maize-crop-and-dense-roots.md`: Plan record.

---

## 4. Verification & Quality Gates
1. `npm --prefix web run typecheck`: Green TypeScript validation.
2. `npm --prefix web run build`: Clean production bundle build.
3. `python scripts/check_i18n.py`: Zero missing keys between `en.json` and `ar.json`.
4. Zero-Emoji Check: Regex scan confirming no unicode emojis.
5. Visual Verification: Scrub timeline to Summer season in existing strategy, verify Maize stalks, broad arching leaves, and dense Layer 1 root network in cutaway mode.
