# Specification & Implementation Plan: 3D Soil Simulation Enhancement

**Task:** Enhanced 3D Soil Monolith & Simulation Visualization  
**Target Date:** 2026-11-13  
**Project:** Journey Into the Soil (NASA Space Apps 2026)  
**Scope:** `web/src/scene/`, `web/src/i18n/`, `docs/plans/`  
**Target Roles:** `scene-3d` (Babylon.js engine) & `frontend` (React HUD overlay)

---

## 1. Executive Summary & Design System

### 1.1 Context & Objective
The 3D soil simulation is the core visual centerpiece of "Journey Into the Soil". It models how crop rotations, daily NASA weather (POWER), and soil properties interact underground over a 365-day timeline.
Currently, the scene uses basic geometric primitives: flat-shaded boxes with random pixel noise, rigid straight cylinder roots that stretch uniformly in Y, cone blades for crops, and a single replay button.

This plan details the upgrade to a **museum-grade scientific earth simulator**, combining:
1. **Procedural Geological Strata**: Multi-octave natural soil horizons with realistic moisture darkening, aggregate crumb texturing, and 3D salinity efflorescence bloom.
2. **Organic Crop Morphology**: Differentiated taproot vs. fibrous root architecture with progressive growth, distinct crop canopy foliage (cereals vs. broadleaf vs. legumes), and multi-frequency wind sway.
3. **Three-Point Studio Lighting & Atmosphere**: Solar key light, atmospheric fill, cutaway rim highlights, soft contact shadow, and NASA weather-reactive precipitation particles.
4. **Interactive Glassmorphic HUD Overlay**:
   - Interactive centimetre **Depth Ruler** (`0–150 cm`) linked to real soil horizons.
   - **Interactive Layer Inspector** (hover/tap reveals live moisture, salinity, OM, and texture metrics).
   - **Camera Quick Presets** (`[3D Perspective]`, `[Front Cutaway]`, `[Top Canopy]`, `[Replay]`).
   - **Explode Layers Toggle** (smooth transition separating horizons to inspect subsoil).
   - **Live Telemetry Chip** (active crop, root depth, canopy cover, ET₀, precipitation).
5. **Full Accessibility & Dual-Language i18n**: English and Arabic RTL with 100% key parity.

### 1.2 Non-Negotiable Architecture Constraints
- **React never touches Babylon objects**: All Babylon.js objects (`Scene`, `Mesh`, `Material`, `Camera`, `Light`) are encapsulated strictly inside `web/src/scene/SceneController.ts`. React communicates with `SceneController` solely via imperative methods (`loadResult`, `setSeasonTime`, `setCameraView`, `setExplode`, etc.) and event callbacks (`onLayerInspect`, `onDay`).
- **Data Honesty & Advisory Framing**: Visuals represent relative physical dynamics derived from the simulation pipeline; no false promises.
- **Performance Budget**: 60 FPS on desktop, 30+ FPS on mobile. Hardware scaling and quality tiers (`high`, `medium`, `low`) remain active with automatic throttling when FPS < 28.
- **Zero New Dependencies**: Uses existing `@babylonjs/core` and standard React/SVG/CSS primitives. No external icon libraries or heavy textures.

---

## 2. File Architecture & Responsibilities

```
web/src/scene/
├── SceneController.ts     # Pure Babylon.js engine: lighting, materials, procedural meshes, camera animation, raycast picking
├── SoilScene.tsx          # React component: canvas mount, telemetry chip, camera buttons, depth ruler, layer inspector card
├── SoilScene.css          # Glassmorphic overlay styles, depth scale positioning, responsive mobile breakpoints, RTL support
└── types.ts               # Extended with LayerInspectData & CameraPreset types

web/src/i18n/
├── ui.en.json             # English UI strings for camera presets, depth markers, and inspector metrics
└── ui.ar.json             # Arabic (RTL) UI strings with 100% key parity
```

---

## 3. Technical Implementation Details

### 3.1 Geological Soil Horizons & Procedural Texturing (`SceneController.ts`)

#### A. Multi-Octave Strata Synthesis
Replace the flat 256x256 random square noise with a multi-frequency procedural canvas generator (`specklePair(seed, textureType, om)`):
- **Base Strata**: Linear horizontal gradient bands simulating natural sedimentary deposition.
- **Granular Clods & Pores**:
  - *Clay*: Smooth, dense texture, fine desiccated micro-fractures when dry, deep rich darkening when wet.
  - *Sand*: High-frequency coarse granules with subtle specular sparkle.
  - *Loam*: Crumbly organic aggregate structure with dark humus flecks proportional to `layer.om`.
- **Bedrock / Subsoil Monolith Pedestal**:
  - Add a dark slate-gray bevel/pedestal plate (`MeshBuilder.CreateBox("pedestal", { width: W + 0.4, height: 0.25, depth: D + 0.4 })`) beneath Layer 4. This frames the cutaway block as an architectural museum specimen rather than an unanchored floating block.
- **Surface Mulch & Residue**:
  - When `result.input.residues === "retained"`, render a thin organic residue layer (`straw/mulch flecks`) on the top ground face.

#### B. Dynamic Moisture Sheen & 3D Salinity Bloom
- **Moisture Depth Curve**:
  ```ts
  const wet = clamp(sim.moisture[i]?.[day] / 1.1, 0, 1);
  const k = 1 - 0.48 * wet; // color darkening
  mat.diffuseColor = new Color3(base.r * k, base.g * k, base.b * k);
  // Wet soil specular glistening:
  mat.specularColor = new Color3(0.04 + 0.32 * Math.pow(wet, 2), 0.04 + 0.32 * Math.pow(wet, 2), 0.04 + 0.32 * Math.pow(wet, 2));
  mat.specularPower = lerp(16, 64, wet);
  ```
- **Salinity Efflorescence**:
  - When $EC_e > 4.0\text{ dS/m}$, dynamically bloom white crystalline textures on both the front cutaway and top soil perimeter, with crystalline specular reflection (`specularColor: Color3(0.8, 0.8, 0.8)`).

---

### 3.2 Organic Root Architecture & Canopy Dynamics

#### A. Crop Root Morphology
Differentiate crops into two architectural families:
1. **Taproot Family** (`cotton`, `sugar_beet`, `sunflower`, `faba`, `lentil`, `soybean`, `tomato`):
   - Dominant vertical taproot with natural Bezier curvature, tapering from radius `0.045` at the surface to `0.012` at the root tip.
   - Lateral secondaries radiating outward at 45° to 60° angles in the upper and middle root zone.
2. **Fibrous / Adventitious Family** (`wheat`, `barley`, `maize`, `rice`, `sorghum`, `berseem`, `onion`, `garlic`):
   - Dense cluster of 6 to 10 crown roots originating at the plant base, spreading laterally (semi-elliptical envelope) with highest root density in the top 30 cm (Horizons 1 & 2).

#### B. Progressive Growth (No Linear Distortion)
- Instead of stretching a static mesh in Y via `scaling.y` (which distorts tube thickness and branch angles), interpolate the active root path points along the spline up to `root_cm[day]`.
- Root color transitions dynamically from vibrant ivory (`#FAF4E6`) when unstressed to pale amber (`#D9A066`) under severe water stress (`water_stress > 0.4`) or salinity stress (`salinity_stress > 0.3`).

#### C. Canopy Foliage Variety & Field Breeze
- Replace uniform cone cylinders with crop-specific foliage profiles:
  - **Cereals / Grasses**: Curved, arching blade clusters (`tessellation: 3, diameterTop: 0, diameterBottom: 0.07`).
  - **Tall Broadleaf** (Maize, Sorghum, Sunflower): Tiered leaf plates angling outward.
  - **Legumes & Vegetables**: Compact mounded clusters.
- **Wind Dynamics**:
  ```ts
  const windSway = Math.sin(this.time * 2.2 + pos.x * 0.6) * Math.cos(this.time * 1.1 + pos.z * 0.4);
  blade.rotation.z = windSway * (rain > 2 ? 0.08 : 0.035);
  ```

---

### 3.3 Three-Point Studio Lighting & Atmosphere

- **Key Light**: Warm directional sun (`Color3(1.0, 0.96, 0.88)`), angled at `(-0.45, -1, 0.65)` with intensity `0.95`.
- **Sky Fill Light**: Cool hemispheric sky light (`Color3(0.72, 0.82, 0.95)` sky, `Color3(0.35, 0.28, 0.2)` ground bounce) with intensity `0.65`.
- **Rim / Contour Light**: Subtle directional back-light pointing towards camera (`(0.3, 0.8, -1.0)`) with intensity `0.35`, illuminating the cutaway edge silhouette.
- **Ground Contact Shadow**:
  - Ground disc mesh (`MeshBuilder.CreateDisc("contactShadow", { radius: 6.5, tessellation: 32 })`) lying at the pedestal base with soft gradient transparency.
- **Precipitation Particles**:
  - When NASA climate indicates `rain[day] > 2.0 mm`, enable a lightweight particle system spawning falling translucent rain streaks over the field surface.

---

### 3.4 Interactive UI HUD & Controls (`SoilScene.tsx` & `SoilScene.css`)

#### A. Component State & Props
```ts
export interface LayerInspectInfo {
  layerIndex: number;
  nameKey: string;
  depthRange: string; // e.g. "0–20 cm"
  texture: string;
  moisturePercent: number; // e.g. 74%
  moistureStatus: "dry" | "stress" | "optimal" | "saturated";
  salinityDsm: number; // e.g. 1.8 dS/m
  salinityStatus: "low" | "moderate" | "high";
  organicMatter: number;
  screenPos: { x: number; y: number };
}
```

#### B. HUD Elements
1. **Depth Ruler (Left Edge)**:
   - Visual scale running alongside the cutaway block:
     - `0 cm` (Soil Surface)
     - `20 cm` (Topsoil boundary)
     - `50 cm` (Subsoil boundary)
     - `90 cm` (Deep Root Zone boundary)
     - `150 cm` (Substratum)
   - Clicking a depth mark highlights the corresponding horizon.
2. **Interactive Layer Inspector Card**:
   - Triggered on layer hover (preview) or tap/click (locked open with close button).
   - Glassmorphic card displaying:
     - Horizon Name & Depth Range
     - Live Moisture Gauge (`% Field Capacity`) + Status Badge
     - Live Salinity Gauge (`$EC_e$ dS/m`) + Risk Badge
     - Soil Texture & OM %
3. **Camera Preset Pill Buttons (Top Right)**:
   - `[3D Perspective]`: `alpha: -Math.PI/2, beta: 1.25, radius: 13`
   - `[Front Cutaway]`: `alpha: -Math.PI/2, beta: Math.PI/2, radius: 11` (straight-on profile)
   - `[Top Canopy]`: `alpha: -Math.PI/2, beta: 0.2, radius: 12` (bird's-eye view)
   - `[Replay Dive]`: Triggers smooth camera dive and layer settle animation.
4. **Explode Horizons Toggle**:
   - Toggle button `[💥 Explode]` / `[Compact]`. Smoothly animates `explode` parameter between `0` (compact monolith) and `1` (separated horizons with `GAP = 0.22`), allowing farmers to look inside deep layers.
5. **Live Telemetry Chip (Top Left)**:
   - Glassmorphic chip showing:
     - Active Crop & Season (e.g. `Wheat • Winter`) or `Fallow / Bare`
     - Simulated Root Depth (`root_cm`) & Canopy Cover (`%`)
     - Daily Weather: Temperature (`°C`), Rain (`mm`), and $ET_0$ (`mm/day`).

---

## 4. Bilingual i18n Strings Specification

Ensure exact key parity between `web/src/i18n/ui.en.json` and `web/src/i18n/ui.ar.json`:

### English (`ui.en.json`)
```json
{
  "scene_view_3d": "3D View",
  "scene_view_cutaway": "Cross-Section",
  "scene_view_canopy": "Canopy",
  "scene_explode": "Explode Layers",
  "scene_compact": "Compact Block",
  "scene_depth_topsoil": "Topsoil (0–20 cm)",
  "scene_depth_subsoil": "Subsoil (20–50 cm)",
  "scene_depth_deep": "Deep Zone (50–90 cm)",
  "scene_depth_substratum": "Substratum (90–150 cm)",
  "scene_moisture_optimal": "Optimal Moisture",
  "scene_moisture_stress": "Water Stressed",
  "scene_moisture_dry": "Dry",
  "scene_moisture_saturated": "Saturated",
  "scene_salinity_low": "Non-saline",
  "scene_salinity_mod": "Moderate Salinity",
  "scene_salinity_high": "High Salinity Risk",
  "scene_inspect_close": "Close Inspector",
  "scene_telemetry_crop": "Crop",
  "scene_telemetry_fallow": "Fallow (Bare Field)",
  "scene_telemetry_root": "Root Depth",
  "scene_telemetry_canopy": "Canopy Cover"
}
```

### Arabic (`ui.ar.json`)
```json
{
  "scene_view_3d": "منظور ثلاثي الأبعاد",
  "scene_view_cutaway": "قطاع رأسي للتربة",
  "scene_view_canopy": "الغطاء النباتي",
  "scene_explode": "تفكيك الطبقات",
  "scene_compact": "تجميع الكتلة",
  "scene_depth_topsoil": "التربة السطحية (0–20 سم)",
  "scene_depth_subsoil": "تحت السطحية (20–50 سم)",
  "scene_depth_deep": "النطاق العميق (50–90 سم)",
  "scene_depth_substratum": "طبقة الأساس (90–150 سم)",
  "scene_moisture_optimal": "رطوبة مثالية",
  "scene_moisture_stress": "إجهاد مائي",
  "scene_moisture_dry": "جافة",
  "scene_moisture_saturated": "تشبع مائي",
  "scene_salinity_low": "تربة غير مالحة",
  "scene_salinity_mod": "ملوحة معتدلة",
  "scene_salinity_high": "مخاطر ملوحة مرتفعة",
  "scene_inspect_close": "إغلاق المعاينة",
  "scene_telemetry_crop": "المحصول",
  "scene_telemetry_fallow": "أرض بور (فترة راحة)",
  "scene_telemetry_root": "عمق الجذور",
  "scene_telemetry_canopy": "كثافة الغطاء"
}
```

---

## 5. CSS Styling & Layout Tokens (`SoilScene.css`)

```css
/* Glassmorphic Scene Overlay */
.scene-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
}

.scene-overlay > * {
  pointer-events: auto;
}

/* Glassmorphic Base */
.scene-glass {
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  border-radius: 10px;
}

/* Depth Ruler */
.scene-depth-ruler {
  position: absolute;
  inset-inline-start: 12px;
  inset-block-start: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

/* Camera Controls Toolbar */
.scene-toolbar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-self: flex-end;
}

.scene-toolbar button {
  min-block-size: 36px;
  padding: 4px 10px;
  font-size: 0.82rem;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* Layer Inspector Popup */
.scene-inspector {
  position: absolute;
  inset-inline-end: 14px;
  inset-block-start: 58px;
  max-inline-size: 260px;
  padding: 12px;
  display: grid;
  gap: 6px;
  font-size: 0.82rem;
  z-index: 10;
}

/* Telemetry Badge */
.scene-telemetry {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 6px 12px;
  font-size: 0.82rem;
  font-weight: 500;
}
```

---

## 6. Verification & Quality Gates

An agent or developer executing this plan must run and pass the following quality gates:

1. **Bilingual Parity**:
   ```bash
   python scripts/check_i18n.py
   ```
   *Expected: All new keys present in both `ui.en.json` and `ui.ar.json` with zero missing keys.*
2. **TypeScript & Web Build**:
   ```bash
   cd web && npm run typecheck && npm run build
   ```
   *Expected: Clean build with zero TypeScript errors and code-split Babylon bundle.*
3. **API & Contract Integrity**:
   ```bash
   pytest api/tests -q
   ruff check api pipelines
   ```
   *Expected: All 45 API tests pass, contracts remain untouched and valid.*
4. **Performance & Rendering Smoke Test**:
   - Test at 60 FPS on desktop Chrome/Firefox.
   - Test touch drag and tap on mobile viewport (375px width).
   - Verify `prefers-reduced-motion` suppresses camera dive and wind sway.
