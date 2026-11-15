# Plan: Clear Azure Sky & Removal of Yellow Glare

**Date:** 2026-11-13  
**Status:** Completed  
**Author:** Antigravity Team  
**Scope:** `web` (`SoilScene.css`, `SceneController.ts`)

---

## 1. Context & Motivation

- **User Request**: *"We need the sky to be clear no yellow glare"*
- **Current Issues**:
  1. `.scene-bg-gradient` in `SoilScene.css` contained a strong radial sun disc `rgba(255, 244, 200, 0.95)` at `22% 20%` and a muddy yellow-sand horizon gradient `#ecd9a6` and `#e8cf9b` from 33% to 100%.
  2. Three.js atmospheric fog was set to `0xe8cf9b` (sandy yellow) and `HAZE = [0.91, 0.81, 0.61]`.
  3. Scene directional and rim lights were set to warm yellow (`0xfff0d0` and `0xffc37a`), and airborne dust particles were colored golden-yellow (`0xffe6b0`).
  4. These combined to give the entire sky and horizon an intense yellow, dusty desert glare.

---

## 2. Proposed Technical Changes

### A. CSS Clear Sky Backdrop (`SoilScene.css`)
- Remove the radial yellow sun glare hotspot completely.
- Replace the yellow-ochre horizon with a pure, crystal-clear, azure-to-cerulean blue sky gradient:
  - Zenith: `#357bb9` (vibrant clear sky blue)
  - Mid: `#5ea3db` -> `#8bc3ec`
  - Horizon: `#c3e3f8` -> `#ddf0fc` (clean, fresh, soft atmospheric daylight horizon)
- Dark Mode: Clear night sky gradient (`#0b1424` to `#223854`).

### B. Three.js Lighting & Fog Calibration (`SceneController.ts`)
- **Fog**:
  - Update `HAZE` from `[0.91, 0.81, 0.61]` (dusty yellow `#e8cf9b`) to `[0.82, 0.92, 0.98]` (`#d2ebfa`, clean sky blue daylight mist).
  - Update initial fog: `new THREE.Fog(0xd2ebfa, 35, 115)`.
- **Lighting**:
  - Ambient Light: `0xffffff, 0.92` (clean, natural daylight).
  - Directional Sun: `0xffffff, 0.98` (pure crisp daylight instead of yellow `0xfff0d0`).
  - Rim Light: `0x98cbf8, 0.55` (cool sky-fill bounce instead of orange-yellow `0xffc37a`).
- **Particles**:
  - Update dust particles color to `0xdaf0ff` (clean airy daylight particles).

---

## 3. Verification Plan
- [x] `npm --prefix web run typecheck`
- [x] `npm --prefix web run build`
- [x] `python scripts/check_i18n.py`
- [x] `pytest api/tests -q` & `ruff check api`
