# Implementation Plan: Integrate Landing Page & Astryx Design System

**Date:** 2026-11-14  
**Task:** Port Jewidan's landing page sections into React and unify entire application under the Astryx Meta Design System  
**Scope:** `web/index.html`, `web/src/styles/`, `web/src/features/landing/`, `web/src/features/results/`, `web/src/state/store.ts`, `web/src/App.tsx`, `web/src/i18n/`

## 1. Context & Objectives
Jewidan created an extensive landing page (`landing.html`) and auth gateway (`account.html`) outside the React web app. The React app currently contains the 3D Babylon simulation, historical climate analysis, NASA evidence panels, and agent backend, but previously had a minimal landing form and basic styling.

Objectives:
1. Establish the **Astryx Meta Design System** (Matcha + Stone / Soil Earth Theme) as the universal design token source for the entire web app, supporting both Luminous Obsidian dark mode and Warm Stone light mode with full WCAG AAA/AA contrast.
2. Build native, modular React components for Jewidan's landing sections in `web/src/features/landing/`:
   - `HeroSection.tsx`: Space-soil full-bleed background, headline, guest vs authenticated state, launch CTAs.
   - `WorkflowSection.tsx`: 3-act interactive card workflow timeline with imagery.
   - `BattlefieldSection.tsx`: NASA satellite vs root-zone physical reality comparison.
   - `CropTalkSection.tsx`: Interactive AI agronomist preview connected to the live `/api/v1/agent/ask` RAG endpoint.
   - `EgyptReliefMap.tsx`: 27-governorate interactive Egyptian relief map with direct simulation launcher.
   - `AuthModal.tsx`: Email / Google sign-in modal with local storage persistence.
   - `PdfReportModal.tsx`: Printable agronomic recommendation summary.
3. Apply Astryx styling across the simulation views (StrategyCards, SoilScene container, Timeline, NASA Evidence, Panels, AgentPanel).
4. Maintain 100% Arabic and English i18n key parity and green test gates.

## 2. Execution Steps
1. **Fonts & Design System Foundation**:
   - Update `web/index.html` with Google Fonts (`Inter`, `Cairo`, `JetBrains Mono`).
   - Create `web/src/styles/astryx.css` with Astryx tokens, typography, glassmorphism, grain, card, button, and badge primitives.
   - Update `web/src/styles/app.css` to import and extend Astryx tokens across existing components.
2. **State & Auth Management**:
   - Update `web/src/state/store.ts` to manage user email, auth modal visibility, PDF report modal, and selected governorate demo site.
3. **Build Modular Landing Components**:
   - Create `HeroSection.tsx`, `WorkflowSection.tsx`, `BattlefieldSection.tsx`, `CropTalkSection.tsx`, `EgyptReliefMap.tsx`, `AuthModal.tsx`, `PdfReportModal.tsx`.
4. **Unify `App.tsx` and Simulation Views**:
   - Integrate Header, Landing sections, Field Selector, and Simulation Results seamlessly in `App.tsx`.
   - Upgrade Strategy Cards, Scene HUD, Evidence, and Agent panels with Astryx tokens.
5. **i18n Strings Synchronization**:
   - Add landing section translations to `web/src/i18n/ui.en.json` and `ui.ar.json`.
   - Verify with `python scripts/check_i18n.py`.
6. **Verification & Quality Gates**:
   - Run `npm --prefix web run build`.
   - Run `pytest api/tests/ -q`.
