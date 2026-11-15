# Implementation Plan: Simulation Journey & Input UX Redesign

**Date:** 2026-11-14  
**Task:** Transform the simulation setup from an unstyled form dump into an immersive, multi-step guided Simulation Journey following `/ui-ux-pro-max` specifications.  
**Scope:** `web/src/features/inputs/SimulationWizard.tsx`, `web/src/features/inputs/SimulationWizard.css`, `web/src/features/inputs/FieldForm.tsx`, `web/src/App.tsx`, `web/src/i18n/ui.en.json`, `web/src/i18n/ui.ar.json`

## 1. Problem Statement
The current simulator inputs:
1. Present 16 raw inputs simultaneously inside generic browser fieldsets and unstyled dropdowns.
2. Lack visual hierarchy, progress indication, or feedback on field choices.
3. Fail to communicate the real-world agricultural meaning of soil textures, irrigation systems, or priority trade-offs.
4. Give a poor user experience that doesn't match the quality of the 3D subterranean core excavation engine.

## 2. Target Design & Architecture (Following `/ui-ux-pro-max`)

### A. 4-Stage Guided Simulation Wizard
Structure the simulation journey into 4 clean, focused steps with a sticky top progress stepper:
1. **Step 1: 📍 Field Location & Microclimate**
   - Curated NASA Egyptian Demo Sites (Kafr El-Sheikh, Gharbia, West Nubaria, Minya, Fayoum) in visual Bento cards with region badges and live coordinates.
   - Interactive Map selection mode for custom Egyptian coordinates.
2. **Step 2: 🌱 Soil Horizon & Texture Profile**
   - Visual texture selector cards with grain badges (Sand, Sandy Loam, Loam, Silt Loam, Clay Loam, Clay).
   - Tap-friendly pill toggles for drainage (`Good`, `Moderate`, `Poor`) and organic inputs.
   - Collapsible "Advanced Lab Test Data" drawer for measured `ECe` and `pH`.
3. **Step 3: 💧 Irrigation System & Canal Water Salinity**
   - Visual method cards: **Flood Basin** ($55\%$ eff), **Sprinkler Pivot** ($75\%$ eff), **Drip Precision** ($90\%$ eff).
   - Salinity slider with real-time agronomic guidance (`Fresh Canal`, `Agricultural Drainage`, `Saline Well`).
   - Water availability & pest diagnosis selector chips.
4. **Step 4: 🌾 Crop Succession & Strategic Priorities**
   - Next season picker (Winter, Summer, Nili).
   - Quick-pick crop cards for past 3 seasons (Wheat, Maize, Tomato, Berseem, Sugar Beet, etc.).
   - Interactive priority weighting sliders (Water, Soil Health, Income, Climate Risk) with live balance visualization.

### B. Visual & Interaction Design
- **Organic Biophilic & Bento Grids**: Clean cards with 16px radius, soft borders, and emerald/sky active outlines.
- **Strict Accessibility (WCAG AA/AAA)**: Minimum 44x44pt tap targets, high text contrast, keyboard navigation.
- **Pure SVG Icons**: Semantic icons (MapPin, Shovel, Droplets, Wheat, Shield, Sliders) with zero emoji icons.
- **Dual Language & RTL**: Full Arabic (RTL) and English parity.

## 3. Definition of Done
1. `npm run typecheck` passes with zero errors.
2. `npm run build` succeeds.
3. `python scripts/check_i18n.py` passes with zero missing keys.
4. Tested locally and deployed to live production on OCI.
