# Plan: Adopt and Integrate External 3D Soil Simulation Demo

**Date:** 2026-11-13  
**Status:** Proposed (Awaiting User Review)  
**Author:** Antigravity Team  
**Scope:** `web` (`package.json`, `SceneController.ts`, `textures.ts`, `SoilScene.tsx`, `SoilScene.css`, `contracts/i18n/`)

---

## 1. Problem Statement & Motivation

The current 3D simulation scene in `journey-into-the-soil` has visual and immersion limitations (isolated monolith box, lack of realistic scale, sparse vegetation, and disjointed underground transition).

An external reference implementation was provided in `C:\Users\Lenovo\Downloads\Journey Into the Soil (3D) (1).html`. This demo delivers:
1. **Seamless Landscape**: An expansive 60m × 60m terrain. In Act 1 (Field view), a foreground block sits flush with the topsoil to create an unbroken agricultural horizon, then drops downward like a stage curtain to reveal the subterranean profile.
2. **Dense Wind-Swaying Crops**: Hundreds of instanced stalks animated with a custom GPU vertex shader (`uTime` wave function).
3. **Photorealistic High-Resolution Textures**: 4 curated soil layer textures with normal/bump mapping for Topsoil, Subsoil, Clay layer, and Sand & Gravel.
4. **Cinematic 4-Keyframe Camera & Atmospheric Transition**: Camera starts at field eye-level, glides forward as the ground opens, dives into the subterranean cutaway, and frames the separated floating slabs. Fog smoothly shifts from sunlit haze (`#e8cf9b`) to deep cavernous earth tones.
5. **Harmonic Floating Slabs & Inertial Orbit**: Slabs separate vertically with organic sinusoidal floating (`Math.sin`), with smooth horizontal drag-to-rotate interaction.
6. **Curved SVG Connectors to 3D Callout Cards**: Glassmorphic cards with sand/silt/clay donut charts and soil properties connected to the 3D slabs via dynamic curved SVG bezier lines.
7. **USDA Soil Texture Triangle & Heatmap**: Slide-up drawer displaying an interactive USDA soil texture ternary diagram and multi-layer property heatmap.

This plan details how to scratch the existing scene and adopt the demo's 3D architecture, while integrating our real NASA/HWSD simulation data, timeline controls, and bilingual (English/Arabic) requirements.

---

## 2. Technical Proposal & Architecture

### A. 3D Engine Migration: Three.js
- The demo runs on Three.js (`r128`).
- Add `three` and `@types/three` to `web/package.json`.
- Rewrite `web/src/scene/SceneController.ts` using Three.js.
- **Strict Decoupling**: React components will NEVER touch Three.js objects directly. All 3D rendering, mesh lifecycle, materials, lighting, particle tickers, and raycasting remain encapsulated inside `SceneController.ts`.

### B. Texture & Asset Bundling (`web/src/scene/textures.ts`)
- Extract the 4 high-resolution soil textures (`TEX[0..3]`) and 4 layer thumbnails (`THM[0..3]`) from the demo and bundle them as offline base64 assets in `web/src/scene/textures.ts`.
- Ensures zero network dependency during hackathon demos (adhering to Rule 7 in `AGENTS.md`).

### C. Data Binding with Real Simulation Engine (`AnalysisResult`)
The demo used hardcoded mock numbers. We will bind our real backend `AnalysisResult` data into the scene:
- **Layer Thickness & Physical Depths**: Heights computed from `result.field.soil_profile.layers[i].depth_cm`.
- **Soil Composition**: Sand%, Silt%, Clay%, and Organic Matter% from NASA / HWSD data populate the callout donuts and USDA triangle.
- **Dynamic Physics**: Layer available water capacity ($AWC$) and electrical conductivity ($EC_e$) reflect simulated moisture and salinity.
- **Timeline Progression (`dayT`)**: The 365-day season slider controls crop canopy scale and root visibility across the rotation.

### D. Bilingual i18n & RTL Support
- All captions, depth labels (0–150 cm), stage names (`Field`, `Underground`, `Layers separate`, `Analysis`), card tooltips, and warnings are wired to `ui.*` translation keys.
- Full key parity between `contracts/i18n/ui.en.json` and `contracts/i18n/ui.ar.json`, verified by `python scripts/check_i18n.py`.
- In Arabic (RTL), callouts and SVG connector lines invert coordinates gracefully.

### E. Scene Controls & UI Polish
- **Depth Ruler**: Animated vertical gauge tracking descent depth from 0 cm to 150 cm.
- **Stepper**: 4-stage navigation (`Field` → `Underground` → `Layers separate` → `Analysis`).
- **Interactive Orbit**: Pointer drag on canvas rotates the group with smooth inertia and damping.
- **Drawer**: Expandable bottom panel containing:
  - Tab 1: Strategy recommendations with suitability ring scores.
  - Tab 2: USDA Soil Texture Triangle SVG with plotted points for the 4 layers + Property heatmap.
- **Controls**: Replay, skip dive, preset view toggles, and edit inputs navigation.

---

## 3. Affected Files

| File | Change Description |
|---|---|
| `web/package.json` | Add `three` and `@types/three` dependencies |
| `web/src/scene/textures.ts` | **New file**: Bundles the 4 high-res soil textures and layer thumbnails |
| `web/src/scene/SceneController.ts` | Complete rewrite to implement the demo's 3D scene in Three.js |
| `web/src/scene/SoilScene.tsx` | Integrate the demo HUD, SVG curved arrows, callouts, and drawer |
| `web/src/scene/SoilScene.css` | Import demo glassmorphism, responsive styles, animations, and RTL support |
| `contracts/i18n/ui.en.json` | Add missing i18n keys for USDA triangle, stage steps, and depth ruler |
| `contracts/i18n/ui.ar.json` | Add corresponding Arabic translations for key parity |
| `web/src/i18n/ui.en.json` & `ui.ar.json` | Synchronized with contracts |

---

## 4. Implementation Steps & Verification Checklist

1. [ ] **Dependencies**:
   - Run `npm --prefix web install three @types/three`
2. [ ] **Assets (`web/src/scene/textures.ts`)**:
   - Extract `TEX[0..3]` and `THM[0..3]` from the demo HTML into clean exportable constants.
3. [ ] **3D Scene Engine (`SceneController.ts`)**:
   - Initialize WebGLRenderer, PerspectiveCamera, Ambient/Directional/Point lights.
   - Construct the $60 \times 60$ soil slabs with high-res textures, bump maps, and side materials.
   - Construct the foreground dropping block (`frontG`) at $(0, -3.1, 20)$.
   - Build the instanced wind-swaying crop field with the custom vertex shader.
   - Add ambient rising dust particles and ground break burst particle effect.
   - Implement the 4-keyframe cinematic camera interpolation and dynamic fog transition.
   - Expose public methods: `loadResult()`, `setSeasonTime()`, `setStrategy()`, `replay()`, `project()`, `dispose()`.
4. [ ] **HUD & Callouts Overlay (`SoilScene.tsx` & `SoilScene.css`)**:
   - Implement depth ruler (0–150 cm) and 4-step narrative progress pills.
   - Implement floating layer callout cards with Sand/Silt/Clay donut charts.
   - Implement SVG bezier connector arrows that update on frame tick from `project(i)`.
   - Implement slide-up drawer with USDA ternary triangle SVG and property heatmap.
5. [ ] **i18n Parity**:
   - Ensure all user-facing strings are keys in `ui.en.json` and `ui.ar.json`.
   - Run `python scripts/check_i18n.py`.
6. [ ] **Verification Gates**:
   - `npm --prefix web run typecheck`
   - `npm --prefix web run build`
   - `.venv\Scripts\python.exe -m pytest api/tests -q`
   - `.venv\Scripts\ruff.exe check api`
7. [ ] **Git Commit**:
   - Commit changes adhering to Conventional Commits: `feat(web): adopt high-fidelity 3d soil simulation from demo`.
