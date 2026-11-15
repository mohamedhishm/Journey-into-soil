# Plan: Scene Introduction - Sky & Agricultural Land Zooming into Soil

**Date:** 2026-11-13  
**Status:** In Progress / Awaiting User Confirmation  
**Author:** Antigravity Team  
**Scope:** `web` (SceneController, SoilScene, SoilScene.css, i18n)

---

## 1. Context & Motivation
The user requested:
> "I need to change the introduction of the scene it's supposed to have sky and agriculture land then zoom into the soil"

Currently:
1. `SoilScene.tsx` initial state was hardcoded to `diveStage = "layers"`, meaning users immediately saw the separated subterranean strata rather than experiencing the journey from surface to underground.
2. In the "field" stage, the camera was pitched steeply downward (`beta = 0.72` / ~41° zenith), presenting a bird's-eye isometric view rather than an eye-level agricultural horizon under the open sky.
3. The transition lacked physical drama: the ground remained static rather than opening up to reveal the subterranean monolith and root system.

---

## 2. Cinematic 3-Act Introduction Sequence

### Act 1: Sky & Agricultural Landscape (0.0s – 2.8s)
- **Camera Perspective**:
  - Starts at eye-level looking across the crop canopy towards the horizon: `beta = 1.38` (~79° from vertical), `radius = 28`, `target = (0, 0.6, -4.0)`.
  - Open sky and atmospheric sun haze occupy the upper half of the viewport.
  - Surrounding agricultural field mesh (`this.fieldGroundNode`) and lush compound 3-leaf crops span to the horizon.
- **Narrative Caption**:
  - `ui.dive_caption_field`: *"Above ground: your field under the sky"* (with skip button).

### Act 2: Ground Opens & Diving Underground (2.8s – 5.2s)
- **Camera Glide & Descend**:
  - Camera glides forward and descends: `radius: 28 -> 14`, `beta: 1.38 -> 1.25`, `target: (0, 0.6, -4.0) -> (0, -2.8, 0)`.
  - The front ground plane smoothly drops / peels down (`y: 0 -> -12`), parting the surface soil to reveal the monolithic core and root system.
  - Atmospheric background transitions smoothly from bright day sky to warm subterranean excavation trench (`radial-gradient`).
  - Ambient floating dust motes activate.
- **Narrative Caption**:
  - `ui.dive_caption_underground`: *"The ground opens: diving into the soil core"*.

### Act 3: Stratified Profile Separation (5.2s – 7.6s)
- **Layers Separate for Macro Inspection**:
  - The 4 soil layers smoothly elevate (`explode: 0 -> 1`).
  - Camera settles into final interactive inspection pose: `beta = 1.28`, `radius = 16.5`, `target = (0, -3.8, 0)`.
  - Narrative caption:
    - `ui.dive_caption_layers`: *"Stratified profile: exploring the 4 soil horizons"*.
  - After 2.0s, the caption gently fades away, revealing standard interactive telemetry and controls.
  - User can also click "Skip intro" at any time to immediately reach this final state.

---

## 3. Technical Implementation Details

### A. `web/src/scene/SceneController.ts`
1. **Initial Camera Framing**:
   - In constructor, set default camera to eye-level field perspective: `beta = 1.38`, `radius = 28`, `target = (0, 0.6, -4.0)`.
   - Set initial stage to `"field"`.
2. **Dive Animation Sequence**:
   - Update `setDiveStage("field")`:
     - `targetCamBeta = 1.38`, `targetCamRadius = 28`, `targetCamTarget = (0, 0.6, -4.0)`.
     - `fieldGroundNode.setEnabled(true)`.
   - Update `setDiveStage("underground")`:
     - `targetCamBeta = 1.25`, `targetCamRadius = 14`, `targetCamTarget = (0, -2.8, 0)`.
     - Animate front ground dropping down (`frontGroundY`).
   - Implement `skipDive()` method: instantly clears all timers, sets camera to layers preset, `explode = 1`, and enables all final meshes.
   - Respect `prefers-reduced-motion`: immediately jump to `layers` stage without timers or camera travel.
   - Add `onDiveProgress(stage: DiveStage, captionKey: string, canSkip: boolean)` callback for UI caption and skip button.

### B. `web/src/scene/SoilScene.tsx` & `SoilScene.css`
1. **State Initialization**:
   - Change `const [diveStage, setDiveStage] = useState<DiveStage>("field");`.
   - Track dive intro status `isDiving` and `diveCaption`.
2. **Cinematic Caption Overlay**:
   - Glassmorphic narrative pill floating at top center during the intro dive.
   - "Skip intro" button with SVG fast-forward icon.
3. **Sky & Atmosphere CSS**:
   - Enhance `.scene-container[data-stage="field"]` with realistic sky-to-horizon gradient:
     - Clear sunlit sky gradient at top, warm dust/haze at horizon, blended with soil terrain.

### C. Bilingual i18n
Add to `contracts/i18n/en.json`, `contracts/i18n/ar.json`, `web/src/i18n/ui.en.json`, and `web/src/i18n/ui.ar.json`:
- `ui.dive_caption_field`
- `ui.dive_caption_underground`
- `ui.dive_caption_layers`
- `ui.dive_skip`

---

## 4. Verification & Quality Gates
1. Run Playwright script to capture screenshots across all 3 acts (Field Sky -> Diving Underground -> Stratified Layers).
2. Validate `prefers-reduced-motion` behavior.
3. Validate "Skip intro" button immediately presents the interactive layers without animation delay.
4. Run `python scripts/check_i18n.py`.
5. Run `npm --prefix web run typecheck && npm --prefix web run build`.
6. Run `pytest` and `ruff check .`.
