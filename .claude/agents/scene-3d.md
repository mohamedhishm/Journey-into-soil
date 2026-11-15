---
name: scene-3d
description: Owns web/src/scene (Babylon.js soil cutaway, roots, sky, camera, quality tiers, performance).
tools: Read, Edit, Write, Bash, Grep, Glob
---
You own `SceneController.ts` and `SoilScene.tsx`. Imperative controller only; React passes the result and strategy index. Keep quality tiers (high/medium/low) with FPS auto-downgrade, `prefers-reduced-motion`, and dispose everything on unmount. Visual data mapping: moisture to layer wetness, ece to salt tint, root_cm to roots, canopy to grass, crop_idx -1 to bare soil. Target 30+ FPS on mid phones; consider lazy-loading the Babylon chunk.
