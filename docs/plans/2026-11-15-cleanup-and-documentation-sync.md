# Implementation Plan: Repository Cleanup, Documentation Synchronization & Pull Request

**Date:** 2026-11-15  
**Author:** Antigravity (Google DeepMind)  
**Branch:** `Ahmed`  
**Target:** `master`  

## 1. Context & Motivation
Over the course of the hackathon development cycle, the `Ahmed` branch has incorporated substantial foundational and user-facing features:
1. **AI Agent & Source-Grounded RAG System**: Deterministic pipeline orchestration (`/agent/recommend`), source-grounded assistant (`/agent/ask`), and NASA SMAP / NDVI observational evidence.
2. **Meteomatics Weather & Live Soil Telemetry**: High-res downscaled weather and multi-depth soil moisture ingestion (`services/meteomatics.py`) driving real-time physics simulation grounding and pre-sowing deficit flags.
3. **Google OAuth & Authentication**: Backend session endpoints (`api/v1/auth.py`) and frontend auth modal.
4. **Astryx Design System & Landing Page**: High-performance React landing page with 27-governorate calibrated interactive Egypt relief map.
5. **4-Stage Guided Simulation Wizard & Executive Dashboard**: Replaces raw JSON inputs with intuitive step-by-step onboarding and executive decision-support metrics.
6. **Cinematic 3D Rhizosphere & Weather Experience**: 3-act sky-to-soil dive, dense multi-plant realistic crop root network across Layer 1 cutaway, dynamic weather atmosphere system (rain particles, dust motes, solar lighting), and interactive telemetry HUD.

However, several documentation files remain outdated (referencing schema 1.0.0, obsolete links, or uncompleted tasks in the backlog), and legacy static HTML prototypes (`landing.html`, `account.html`, `dashboard.html`), extraneous build bundles, and duplicate root images remain in the repository.

This plan details the cleanup of all redundant artifacts, the synchronization of all project documentation to match code reality, verification, and opening the PR to `master`.

---

## 2. Planned Changes

### A. Repository Cleanup (Dead Code & Stray Files Removal)
1. **Legacy HTML prototypes**:
   - Delete root static files: `journey_into_the_soil_landing_page.html`, `landing.html`, `account.html`, `dashboard.html`.
   - Delete redundant static pages in `web/public/`: `web/public/landing.html`, `web/public/account.html`, `web/public/dashboard.html`.
2. **Built bundle artifacts mistakenly placed at repository root**:
   - Delete root `index.html`.
   - Delete root `assets/` directory (`assets/SceneController-CvOq_vlO.js`, `assets/babylon-Db9kk8BL.js`, `assets/index-DRRZCuY7.js`, `assets/index-UNiNsUry.css`, `assets/maplibre-B_gkAjPj.js`).
3. **Duplicate / redundant image assets**:
   - Remove root duplicate image files that already reside cleanly in `web/public/`:
     - `battle_background.jpeg`, `crop_recommendation_background.jpeg`, `data_collection.jpeg`, `layers_background.jpeg`, `soil_layer_how_it_work.jpeg`, `the_shifters_logo_transparent.png`, `account_bg.jpg`, `Unlabeled Relief Map of Egypt.png`.
     - Remove duplicate files with spaces in names at root: `crop recommendation background.jpeg`, `data collection.jpeg`, `layers background.jpeg`, `soil layer how it work.jpeg`, `how does it work.png`, `Screenshot 2026-11-13 171035.png`.
     - Remove unused raw Gemini generation files at root: `Gemini_Generated_Image_42gudn42gudn42gu.png`, `Gemini_Generated_Image_42gudn42gudn42gu.svg`, `Gemini_Generated_Image_fzlkafzlkafzlkaf.jpeg`, `Gemini_Generated_Image_git6nvgit6nvgit6.jpeg` (these are already preserved in `web/public/`).
   - In `web/public/`: Remove unused duplicate files with space-separated names where clean underscored files exist:
     - `web/public/battle background.jpeg`
     - `web/public/crop recommendation background.jpeg`
     - `web/public/data collection.jpeg`
     - `web/public/layers background.jpeg`
     - `web/public/soil layer how it work.jpeg`
     - `web/public/Egypt 's Map.png`
4. **Update `.gitignore`**:
   - Ensure root built artifacts (`/index.html`, `/assets/`) are ignored to prevent future accidental commits.

---

### B. Documentation Synchronization

1. **`README.md`**:
   - Fix invalid markdown links (replace broken `journey-into-soil/...` prefix with proper repository-relative links conforming to link conventions).
   - Update architecture table and key highlights:
     - Multi-Year Historical Climate Uncertainty (Schema 1.1.0)
     - AI Agent & Source-Grounded RAG System (`/agent/recommend`, `/agent/ask`)
     - Meteomatics Live Weather & Multi-Depth Soil Telemetry
     - NASA SMAP & NDVI Observational Evidence Integration
     - 4-Stage Guided Simulation Wizard & Executive Dashboard
     - 3-Act Cinematic 3D Sky-to-Soil Dive & Botanical Rhizosphere Root Network
     - 27 Offline Pre-Calibrated Demo Site Packs across Egypt

2. **`docs/architecture.md`**:
   - Rewrite to reflect the full production architecture:
     - End-to-end topology: React 18 + Vite + Three.js / Babylon 3D + MapLibre GL -> Nginx -> FastAPI -> Engine / Sim / RAG / Telemetry.
     - Physical Simulation layer (FAO-56 ET0, Saxton-Rawls pedotransfer, Maas-Hoffman salinity, 4-layer water balance).
     - FIELD.PUA Rotation Engine & Uncertainty (Schema 1.1.0 15-year analog sweep).
     - Live telemetry & NASA observation integration (NASA POWER packs, Meteomatics API, NASA SMAP `SPL3SMP_E` & VIIRS `VNP13A1` NDVI).
     - RAG and deterministic AI agent workflow.
     - Frontend presentation architecture (Astryx design tokens, 4-stage wizard, SceneController decoupling, executive dashboard).

3. **`docs/tasks/BACKLOG.md`**:
   - Mark completed deliverables and record recent work items:
     - `B9`: Submission draft and video script
     - `B10`: Challenge checklist pass
     - `B25`: Multi-plant realistic crop root network across layer 1 cutaway
     - `B26`: 3D weather atmosphere system (rain, dust, lighting) & floating telemetry HUD
     - `B27`: Meteomatics high-resolution weather & soil API integration
     - `B28`: Google OAuth backend endpoints & frontend auth modal
     - `B29`: Astryx design system integration, interactive Egypt relief map, and native landing page
     - `B30`: 4-stage guided simulation wizard & executive post-sim dashboard

4. **`docs/challenge-checklist.md`**:
   - Update checklist items with completed status and concrete pointers to code implementations.

5. **`docs/pitch/submission.md` & `docs/pitch/video-script.md`**:
   - Complete draft of Space Apps project submission narrative, NASA data usage disclosure, AI tool disclosure, and 60-second video demo script.

---

## 3. Verification & Quality Gates
Before pushing and creating the PR, execute the full test suite:
1. `api/tests`: `python -m pytest api/tests -q` (119 passed).
2. `pipelines/tests`: `python -m pytest pipelines/tests -q` (35 passed).
3. `ruff`: `ruff check api` (0 issues).
4. `check_i18n.py`: `python scripts/check_i18n.py` (100% key parity).
5. `web typecheck`: `npm --prefix web run typecheck` (clean).
6. `web build`: `npm --prefix web run build` (clean Vite production build).

---

## 4. Git Commits & Pull Request
- Create atomic conventional commits:
  1. `chore: clean redundant legacy html prototypes and stray root artifacts`
  2. `docs: synchronize architecture, readme, backlog, and pitch materials`
- Push feature branch to origin: `git push origin Ahmed`
- Open Pull Request to `master` with detailed release description via `gh pr create`.
