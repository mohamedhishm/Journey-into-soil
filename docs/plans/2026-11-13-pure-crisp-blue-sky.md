# Plan: Pure Crisp Blue Sky (Zero Fog, Zero Yellow Glare)

**Date:** 2026-11-13  
**Status:** Completed  
**Author:** Antigravity Team  
**Scope:** `web` (`SoilScene.css`, `SceneController.ts`)

---

## 1. Problem Diagnosis & Motivation

- **User Feedback**: *"Sure but no fog, yellow glare. Just pure sky"*
- **Diagnosis**:
  1. **Milky Fog Bleach**: The Three.js fog (`this.scene.fog = new THREE.Fog(0xd6ebfa, 35, 115)`) was blending all distant geometry (trees at $z = -53\text{m}$, wheat fields, field edges) with `#d6ebfa` (RGB 214, 235, 250 = 98% brightness), effectively creating a milky white haze.
  2. **Gradient Whitening**: The CSS backdrop gradient was transitioning from `#357bb9` at the top down to `#c3e3f8` and `#ddf0fc` (virtually pure white) near the horizon line.
  3. **Goal**: Remove all fog in field mode, eliminate all yellow/warm tints, and provide a vibrant, crystal-clear, deep Egyptian Mediterranean azure sky with razor-sharp tree and horizon silhouettes.

---

## 2. Technical Implementation Plan

### A. Pure Blue Sky Gradient in `web/src/scene/SoilScene.css`
- Replace the pale gradient with a vivid, deep-to-bright pure azure gradient:
  - `0%`: `#155e9c` (Deep cobalt zenith)
  - `20%`: `#1d75bd` (Vivid Egyptian azure)
  - `42%`: `#2c8fd6` (Clear cerulean mid-sky)
  - `68%`: `#4ea5e4` (Bright sunlit blue)
  - `100%`: `#7bbfe9` (Pure horizon blue; no yellow, no whiteout, high chroma)
- For dark mode: Keep deep twilight indigo (`#08101e` to `#1e3450`).

### B. Eliminate Fog & Tune Crisp Lighting in `web/src/scene/SceneController.ts`
- **Eliminate Fog in Field Mode**: Set `this.scene.fog = null` in field mode so distant date palms and wheat stalks remain 100% crisp, saturated, and detailed with zero milky haze.
- **Subterranean Stage**: In Act 2/3 (`underground`/`layers`), optional subtle dark cavern depth (`0x120c08`) only if underground, or keep no fog for maximum contrast on depth callouts.
- **Daylight Lighting**:
  - `AmbientLight(0xf2f7fc, 0.82)`: Clean daylight with subtle sky tint.
  - `DirectionalLight(0xffffff, 0.95)`: Pure neutral sun without yellow glare.
  - `PointLight(0x7dc0f5, 0.45)`: Cool blue sky-fill bounce.

---

## 3. Verification & Definition of Done
1. Typecheck: `npm --prefix web run typecheck` passes with 0 errors.
2. Web build: `npm --prefix web run build` passes with 0 errors.
3. i18n check: `python scripts/check_i18n.py` passes.
4. API test suite: `pytest api/tests -q` (45 tests green).
5. Code style: `ruff check api` clean.
6. Commit: `feat(web): render pure crisp blue sky without fog or yellow glare`.
