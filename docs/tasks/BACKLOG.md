# Backlog (status: [ ] todo, [~] doing, [x] done). Deadline 14 Nov 2026; NASA data ~12 Nov.

## P0 - must ship
- [x] B1 (data-pipelines) POWER fetcher: daily T2M_MAX/MIN, PRECTOTCORR, ALLSKY_SFC_SW_DWN, RH2M, WS2M for each demo site, 2000-2025, no login. Output raw to `data/raw/power/`.
- [x] B2 (data-pipelines) `pipelines/earthdata/check_access.py`: verify token works, list granules for SPL3SMP_E and GPM_3IMERGDF over a demo site. See `docs/earthdata-setup.md`.
- [x] B3 (data-pipelines) `pipelines/build_demo_packs.py` (done 12 Nov: 27 packs from POWER 2000-2025, 35 tests; run `make packs`). Merged raw into `data/packs/demo_sites/<id>.json`.
- [x] B4 (rotation-engine) When a pack is present: status "pack" per product in `nasa_data`, higher confidence, remove `gap.synthetic_climate`. Covered by `api/tests/engine/test_demo_sites_and_packs.py`.
- [x] B5 (rotation-engine + experts) Review packet prepared (`knowledge/review/`); awaiting expert review and signoff before changing any `reviewed:false` crop params. Add a source per approved value.
- [x] B6 (frontend) Shareable link route `/a/:id`, copy button, load via GET /analyses/{id}.
- [x] B7 (frontend) Demo-site picker on landing (from /demo-sites) + "use my own field" map click.
- [x] B8 (devops) Deploy on OCI: Cloudflare Tunnel, Docker Compose up on ARM64, single-origin proxy + api subdomains, live smoke test passed.
- [x] B9 (docs-pitch) Submission text, 30-60 s video script, AI-use disclosure (`docs/pitch/`).
- [x] B10 (reviewer) Challenge checklist pass (`docs/challenge-checklist.md`).

## P1 - should

- [x] B11 (data-pipelines) SMAP SPL3SMP_E **surface** moisture series into the pack (root zone documented as unavailable); "NASA vs model" evidence panel labelled indicative. `pipelines/smap/`, `api/app/services/nasa.py`, `web/src/features/results/NasaEvidence.tsx`.
- [x] B12 (data-pipelines) NDVI per site from `VNP13A1` v002 (500 m, 16-day) + bare-field/crop timeline check. Product choice and limits: `docs/ndvi-source.md`.
- [x] B13 (data-pipelines) SoilGrids lookup cached into pack for demo sites; `services/soil.py` parses estimates for topsoil texture and organic matter.
- [x] B14 (frontend) Native Arabic review pass with a speaker; fix strings in `contracts/i18n/ar.json` + `web/src/i18n/ui.ar.json`.
- [x] B15 (scene-3d) Lazy-load Babylon/Three.js, measure FPS on mobile, tune asset tiers.
- [x] B16 (frontend) Accessibility pass (focus order, high-contrast dark/light modes, aria labels for timeline and wizard).
- [x] B21 (ai-agent) Deterministic agent orchestration over the real engine (`/agent/recommend`) with an optional LLM phrasing layer (`OPENAI_API_KEY`, never scoring).
- [x] B22 (rag) Source-grounded assistant (`/agent/ask`, `/knowledge/search`): BM25 over `knowledge/agronomy/*.md` + knowledge YAML, extractive answers with citations, explicit refusal when out-of-domain.
- [x] B23 (scene-3d) Atmospheric excavation trench backdrop, floating dust motes, dense 3-blade crop canopy (2800 instances), and natural gravitropic tapering roots with nodules flush against cutaway face.
- [x] B24 (scene-3d) 3-Act cinematic dive sequence: eye-level sky & agriculture land intro, ground-parting zoom dive, and stratified layer inspection with skip button & i18n narrative.
- [x] B25 (scene-3d) Multi-plant realistic crop root network across layer 1 cutaway face with organic branching splines and botanical shading.
- [x] B26 (scene-3d) 3D weather atmosphere system (rain particle system, dust haze, solar lighting) and floating telemetry HUD.
- [x] B27 (telemetry/api) Meteomatics high-resolution weather & multi-depth soil API integration (`services/meteomatics.py`) and live simulation grounding with pre-sowing deficit flags.
- [x] B28 (web/auth) Google OAuth backend endpoints, session management, and frontend sign-in modal.
- [x] B29 (web/landing) Astryx design system integration, interactive Egypt relief map with 27 calibrated governorate pins, and native landing page.
- [x] B30 (web/ui) 4-stage guided simulation wizard (`SimulationWizard.tsx`), executive results dashboard (`ResultsDashboard.tsx`), persistent floating AI assistant (`FloatingAssistantWidget.tsx`), and timeline playback.
- [x] B31 (repo) Clean redundant legacy HTML prototypes (`landing.html`, `account.html`, etc.), stray root build artifacts, and duplicate media assets.

## P2 - nice

- [ ] B17 Rice paddy ponding model.
- [ ] B18 Erosion/compaction indicators.
- [x] B19 PDF/print summary modal of a simulation result (`PdfReportModal.tsx`).
- [ ] B20 Per-region heat thresholds per crop.
