# Implementation Plan: Authentic Soil Horizon Textures & Shading

**Task:** Match 3D soil layer colors and textures from prototype (`Journey Into the Soil (3D) (1).html`)  
**Date:** 2026-11-13  
**Scope:** `web/public/textures/soil/`, `web/src/scene/SceneController.ts`  

---

## 1. Problem & Context
The current 3D monolith in `web/src/scene/` used procedurally generated speckle textures over an algorithmic brown tint, resulting in muddy, uniform brown layers that lacked visual depth and geological stratification.
The reference prototype in `Journey Into the Soil (3D) (1).html` implements authentic photographic cutaway textures with a distinctive 4-horizon palette:
- Layer 0 (Topsoil 0–20 cm): `#241911` (Deep dark humus / organic crumb loam)
- Layer 1 (Subsoil 20–50 cm): `#45311f` (Warm golden-brown earthy loam)
- Layer 2 (Clay Loam 50–90 cm): `#60291b` (Terra-cotta / reddish-brown fissured clay)
- Layer 3 (Substratum 90–150 cm): `#5d5647` (Khaki/olive mineral rock & gravel)

## 2. Technical Strategy
1. **Texture Extraction**:
   - Extract the 4 high-res base64 JPEG textures from `Journey Into the Soil (3D) (1).html` and save them under `web/public/textures/soil/`:
     - `layer_0.jpg` (Topsoil crumb & organic matter)
     - `layer_1.jpg` (Golden subsoil clods & root channels)
     - `layer_2.jpg` (Reddish clay & blocky structure)
     - `layer_3.jpg` (Pebbles, cobbles & coarse mineral substrate)
2. **Material Architecture in `SceneController.ts`**:
   - Set up faceUVs on `MeshBuilder.CreateBox` for each layer:
     - Front face (`-z`): Mapped to photographic texture with high anisotropy and wrap mode.
     - Top face (`+y`): Mapped to soil surface texture (Layer 0 receives `#cfc5ac` ground tint).
     - Sides & Back (`±x`, `+z`): Solid standard material colored with the horizon base color (`#241911`, `#45311f`, `#60291b`, `#5d5647`).
   - Set `layerBase` colors to `[#241911, #45311f, #60291b, #5d5647]`.
   - Preserve dynamic simulation physics in `applyDay()`:
     - Soil moisture modulates lightness: `k = 1 - 0.48 * wet`.
     - Specular sheen dynamically reflects moisture saturation.
     - Salt efflorescence overlay planes (`saltMats`) display crystalline salt blooming on saline days.
3. **Verification**:
   - Rebuild web bundle.
   - Run Playwright screenshot capture across viewports and check visual contrast.
   - Ensure all quality gates (`check_i18n.py`, `typecheck`, `build`, `ruff`, `pytest`) pass.
