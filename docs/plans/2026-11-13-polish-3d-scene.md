# Implementation Plan: 3D Scene Polish & Correctness (P0)

**Task:** Polish 3D scene (SoilScene, SceneController, types, styles, i18n, scripts/check_i18n.py)  
**Date:** 2026-11-13  
**Priority:** P0 - Correctness First  
**Scope:** `web/src/scene/`, `web/src/i18n/`, `scripts/check_i18n.py`  

---

## 1. Problem Statement & Scope
The 3D soil simulation in `web/src/scene/` has several correctness, semantic, accessibility, and interaction issues that must be addressed before hackathon submission:
1. Salinity status key mismatch (`moderate` vs `mod`).
2. Hardcoded user-facing strings in `SceneController.ts` and `SoilScene.tsx`.
3. Inaccurate moisture labeling ("Water balance" instead of "Available water") and mislabeled plant-available water share.
4. Inspector card does not update live when the timeline slider moves or rotation strategy changes.
5. Inaccessible role markup (`role="img"` on container instead of canvas), missing `aria-pressed`, missing `Esc` key handling and focus management.
6. Pointer-down trigger fires on drag/orbit instead of clean tap, and picking hits roots/blades.
7. Mobile layout at 390px overlaps toolbar and lacks responsive bottom sheet.
8. Synthetic climate source is not flagged in the scene, and simulated date is missing from telemetry.

---

## 2. Technical Proposal: P0 Item by Item

### Item 1: Salinity Label Key Parity & `check_i18n.py` Enforcement
- **Fix JSONs**: Rename `ui.scene_salinity_mod` to `ui.scene_salinity_moderate` in `web/src/i18n/ui.en.json` and `web/src/i18n/ui.ar.json`.
- **Extend `scripts/check_i18n.py`**:
  Add validation that all dynamic template prefixes (`ui.scene_moisture_${status}`, `ui.scene_salinity_${status}`, `crop.${cropId}`, `ui.scene_view_${preset}`) resolve to known keys for all enum values (`["dry", "stress", "optimal", "saturated"]`, `["low", "moderate", "high"]`, `["perspective", "cutaway", "canopy"]`).

### Item 2: Remove Hardcoded Strings & Support RTL via `<bdi>`
- **`LayerInspectData` in `types.ts`**: Replace formatted `texture: string` with raw numeric properties: `sand: number; silt: number; clay: number`.
- **Add i18n keys**:
  - `ui.texture_proportions`: `{{sand}}% sand, {{silt}}% silt, {{clay}}% clay` / `{{sand}}٪ رمل، {{silt}}٪ طمي، {{clay}}٪ طين`
  - `ui.unit_cm`: `{{val}} cm` / `{{val}} سم`
  - `ui.om_label`: `Organic matter` / `المادة العضوية`
  - `ui.et0_val`: `{{val}} mm ET₀` / `{{val}} مم ET₀`
  - `ui.layer_fallback`: `Layer {{n}}` / `الطبقة {{n}}`
  - `ui.placeholder_climate`: already in JSON.
  - `ui.expand`: `Expand` / `توسيع`
  - `ui.collapse`: `Collapse` / `طي`
- **Component Formatting**: Format all numeric values with `t()` and wrap values in `<bdi dir="ltr">` so numbers, slashes, and units never flip or garble in Arabic RTL.

### Item 3: Relabel Moisture Row as "Available water"
- Add `ui.scene_available_water`: `Available water` / `الماء الميسر`.
- Update tooltip/label and clarify comments in `types.ts` and `SceneController.ts`: value is the fraction of plant-available water (0 at wilting point, 1 at field capacity).

### Item 4: Live-Updating Inspector
- In `SceneController.ts`: store `private inspectedLayerIdx: number | null = null`.
- In `applyDay(day)`: if `this.inspectedLayerIdx !== null`, recompute and invoke `this.inspectLayer(this.inspectedLayerIdx)` without moving focus.
- In `SoilScene.tsx`: keep inspected state synced. When `strategyId` or `dayT` changes, the card updates in real-time.

### Item 5: Semantics, Focus Management & Esc Key
- Move `role="img"` and `aria-label={t("ui.scene_label")}` to the `<canvas>` element.
- Remove `role="img"` from `.scene-container`.
- Add `aria-pressed={activePreset === preset}` and `aria-pressed={isExploded}` to toolbar buttons.
- On opening inspector, store `openerRef.current = document.activeElement as HTMLElement` and focus the inspector card (`tabIndex={-1}`).
- On closing inspector (or pressing `Esc`), return focus to `openerRef.current`.

### Item 6: Clean Tap Detection (No Drag/Orbit) & Picking Filter
- In `SceneController.ts`: record pointer down coordinates `(downX, downY)`.
- On pointer up: calculate distance `Math.hypot(upX - downX, upY - downY)`. If `> 6px`, ignore (user was orbiting camera).
- Filter pick predicate: `(mesh) => mesh.name.startsWith("layer")` (explicitly ignores roots, blades, pedestal, and shadow meshes).

### Item 7: Mobile (390px) Bottom Sheet & Collapsible Telemetry
- CSS at `@media (max-width: 640px)`:
  - `.scene-inspector`: docked at bottom (`inset-block-end: 0; inset-inline: 0; max-block-size: 40%; border-radius: 12px 12px 0 0; overflow-y: auto`).
  - `.scene-telemetry`: compact view showing crop + root depth, with a toggle button to reveal weather/canopy details.
  - Toolbar buttons wrap cleanly with minimum 44px tap targets and no overlap with telemetry or inspector.

### Item 8: Honest Data Presentation
- Check `result.climate.source === "synthetic"`. If true, render a badge `<span className="badge warn">{t("ui.placeholder_climate")}</span>` inside the scene overlay.
- Display the simulated date: `result.climate.dates[dayIdx]` in the telemetry bar.

---

## 3. Visual Verification Strategy (Playwright)
- Build frontend: `npm run build`.
- Start local mock server or API (`uvicorn app.main:app`) and `vite preview`.
- Run automated headless Chromium script using swiftshader args:
  `["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]`.
- Capture screenshots for:
  - 1280px Desktop & 390px Mobile
  - English & Arabic RTL
  - Light & Dark theme
  - States: Cutaway view, Exploded view, and Inspector open.
- Inspect captured screenshots and fix any layout, contrast, or clipping defects.

---

## 4. Definition of Done
1. `python scripts/check_i18n.py` passes (including dynamic key checks).
2. `cd web && npm run typecheck && npm run build` passes.
3. `ruff check api pipelines` and `pytest api/tests pipelines/tests -q` pass.
4. Screenshots at 1280px and 390px in light/dark/en/ar confirm zero visual bugs.
