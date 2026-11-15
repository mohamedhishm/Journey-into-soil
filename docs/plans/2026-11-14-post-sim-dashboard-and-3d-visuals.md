# Plan: Post-Simulation Dashboard Redesign & 3D Reactive Visuals

**Date:** 2026-11-14  
**Scope:** `web`  
**Related Requirements:**  
- De-clutter post-simulation screen (`Results` view) into a structured executive dashboard with KPI Bento row and tabbed Analytical Hub.  
- Wire input parameters (soil texture, moisture timeline, salinity, root growth) directly to 3D mesh visuals in `SceneController.ts`.  
- Zero emojis: 100% vector SVG icons.  
- High-contrast Light Mode and Dark Mode support.  

---

## 1. Problem Analysis

### A. Cluttered Post-Simulation Screen
- Currently, `Results` in `App.tsx` stacks 10 legacy panels sequentially down an endless scrolling page (`Flags`, `StrategyCards`, `SoilScene`, `Timeline`, `NasaVsModelPanel`, `NdviTimelinePanel`, `EvidencePanel`, `ClimateSlider`, `AgentPanel`, `NasaPanel`, `LayerTable`, `Glossary`).
- Lacks executive hierarchy, clear KPI metrics, and intuitive categorization.
- **Solution:**
  - Create `web/src/features/results/ResultsDashboard.tsx` and `.css`.
  - **Zone 1: Executive Farm Header & KPI Cards** (Bento summary with Feddan, soil type, strategy badge, water savings, margin, and quick action SVGs).
  - **Zone 2: 3D Soil Studio & Interactive Rotation Core** (`SoilScene`, `StrategyCards`, and `Timeline` scrubber).
  - **Zone 3: Analytical Intelligence Hub with Tabbed Navigation:**
    - Tab 1: **Root-Zone & Horizons** (`EvidencePanel` + `LayerTable`).
    - Tab 2: **NASA Satellite Validation** (`NasaVsModelPanel` + `NdviTimelinePanel` + `NasaPanel`).
    - Tab 3: **Climate Stress & AI Agronomist** (`ClimateSlider` + `AgentPanel` + `Flags` + `Glossary`).

### B. Reactive 3D Soil Core & Root Mesh Visuals
- The 3D scene in `SceneController.ts` previously only reflected inputs through text in the HUD and inspection callouts. The 3D cubes stayed fixed.
- **Solution:**
  - **Dynamic Soil Core Tinting:** Compute layer diffuse colors and roughness based on sand/silt/clay fractions and organic matter from `result.layers`.
  - **Moisture Responsive Darkening:** As timeline scrubs `dayT`, dynamically darken (wet/saturated) or lighten (dry/parched) the slab materials.
  - **Surface Salt Efflorescence Crust:** When irrigation or soil salinity $EC > 3\text{ dS/m}$, apply a visible white mineral crusting / crystalline sheen to the topsoil mesh.
  - **Dynamic 3D Root Branching Mesh:** Build a procedural 3D root system beneath the crop that visibly plunges through the soil horizons as `root_cm` increases over time.

---

## 2. Proposed Changes

1. **`web/src/scene/SceneController.ts`**:
   - Add `updateSoilVisuals(result, dayT)`:
     - Color tinting per texture type (sand vs loam vs clay).
     - Surface salt crust effect for high salinity.
     - Moisture darkening on active horizon materials.
   - Add procedural 3D root group in `profileGroup` with vertical scaling driven by `strat.sim.root_cm[day]`.
2. **`web/src/features/results/ResultsDashboard.tsx`** & `ResultsDashboard.css`:
   - Replace the raw panel dump in `App.tsx` with a cohesive, beautifully structured Bento dashboard.
   - Clean tabbed interface with SVG icons for deep-dive analyses.
3. **`web/src/App.tsx`**:
   - Mount `ResultsDashboard` inside `Results`.
4. **Verification**:
   - `npm --prefix web run typecheck`
   - `npm --prefix web run build`
   - `python scripts/check_i18n.py`
   - Deploy to OCI server `theshifters.l4s3r.site`.
