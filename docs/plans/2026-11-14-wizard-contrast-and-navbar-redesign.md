# Plan: Wizard Light-Mode Contrast & Navigation Bar Overhaul

**Date:** 2026-11-14  
**Scope:** `web`  
**Related Requirements:**  
- Fix wizard card text and borders visibility in Light Mode (WCAG AAA contrast).  
- Redesign top navigation bar: complete missing utilities (NASA Telemetry, PDF Export, 3D Quality, Auth), fix button layout and balance.  
- Strictly zero emojis: 100% vector SVG icons.  

---

## 1. Problem Analysis

### A. Light Mode Text & Border Contrast in Simulation Wizard
- `SimulationWizard.css` hardcoded dark mode colors (`rgba(15, 23, 42, 0.78)`, `#ffffff`, `#94a3b8`, `rgba(255, 255, 255, 0.03)`).
- When light mode is active (`--astryx-color-bg: #fbf9f5`), white card backgrounds and white borders become invisible against the light backdrop.
- Text colors (`#ffffff` on titles, `#94a3b8` on descriptions) result in unreadable contrast (< 1.5:1).
- **Solution:** Introduce semantic CSS custom properties on `.sim-wizard-card` scoped to light and dark modes:
  - `--wiz-bg`, `--wiz-stepper-bg`, `--wiz-border`, `--wiz-border-strong`, `--wiz-text-title`, `--wiz-text-body`, `--wiz-card-bg`, `--wiz-card-border`, `--wiz-pill-bg`.
  - Light mode: crisp surfaces (`#ffffff`, `#f7f4ee`), dark matcha text (`#151a17` title, `#4a544e` body), clear borders (`rgba(21, 26, 23, 0.14)`).
  - Dark mode: luminous obsidian surfaces (`#151b17`), light text (`#f2f6f4` title, `#a7b5ad` body), visible borders (`rgba(255, 255, 255, 0.12)`).

### B. Top Navigation Bar Overhaul
- `Header` in `App.tsx` has minimal, unstyled buttons dumped into `.tools`, lacks proper icon alignment, and misses major application capabilities:
  - No direct access to Live NASA Satellite Telemetry (`NasaTelemetryModal`).
  - No direct access to PDF Executive Export (`PdfReportModal`) from header.
  - No home link on brand identity.
  - Bare browser `<select>` for 3D quality without styling or icon.
  - Buttons have no SVGs (plain text "Light"/"Dark" and "English"/"العربية").
  - `NasaTelemetryModal` and `PdfReportModal` were not even mounted when `showSimulator` was true.
- **Solution:**
  - Build a comprehensive, balanced `TopNavBar` in `web/src/features/navigation/TopNavBar.tsx` and `TopNavBar.css`.
  - Left: Clickable brand logo + "The Shifter" title + "Journey into the Soil" subtitle + "NASA Space Apps 2026" badge.
  - Center: Breadcrumb navigation (Overview / Field Simulation / Rotation Results) + Live NASA Satellite Telemetry launcher button with pulsing green indicator.
  - Right: Contextual actions (Export PDF when results exist, 3D Quality pill, Theme toggle with Sun/Moon SVGs, Language switcher with Globe SVG, Google Sign-in / User avatar).
  - Mount `NasaTelemetryModal` and `PdfReportModal` globally in `App.tsx` so they work across all views.

---

## 2. Proposed Changes

1. **`web/src/features/inputs/SimulationWizard.css`**:
   - Refactor all hardcoded colors into theme tokens scoped for light mode and dark mode.
   - Set high-contrast typography, crisp card borders, and visible selection states in both themes.
2. **`web/src/features/navigation/TopNavBar.tsx`** & `TopNavBar.css`:
   - Structured three-zone header (Brand, Nav & Live Telemetry, Utilities & Profile).
   - Crisp vector SVGs for all actions (no emojis).
   - Full RTL Arabic alignment and mobile responsiveness.
3. **`web/src/App.tsx`**:
   - Replace legacy `Header` with `TopNavBar`.
   - Ensure `NasaTelemetryModal`, `PdfReportModal`, and `AuthModal` are available throughout the simulation lifecycle.
4. **`web/src/i18n/ui.en.json` & `ui.ar.json`**:
   - Ensure complete i18n keys for navbar actions ("NASA Telemetry", "Export PDF", "Overview", "Simulation", etc.).

---

## 3. Verification Plan
- `npm --prefix web run typecheck`
- `npm --prefix web run build`
- `python scripts/check_i18n.py`
- Verify Light Mode and Dark Mode contrast in browser.
- Git commit & deploy to OCI server `ubuntu@141.253.121.245`.
