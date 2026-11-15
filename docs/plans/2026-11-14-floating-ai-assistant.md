# Plan: Persistent Global AI Assistant (Floating Action Button & Scenario Chat)

**Date:** 2026-11-14  
**Scope:** `web`  
**Related Requirements:**  
- Mount a persistent Floating Action Button (FAB) at the bottom right corner across the whole application (Landing, Wizard, Results).
- When opened, provide an interactive, slide-up AI Agronomist chat drawer grounded in NASA POWER, SMAP L4, and FAO-56 knowledge.
- Seamless scenario integration: when a simulation result is active, the assistant directly connects to `result.input` and `result.request_id` to provide scenario-specific answers, rankings explanations, and leaching/irrigation recommendations (sharing exact parity with post-simulation "Ask the assistant").
- Zero emojis: 100% vector SVGs for all icons, chips, and controls.
- Light/Dark mode contrast compliance (WCAG AAA).
- Multilingual key parity (English & Arabic RTL).

---

## 1. Technical Architecture

### A. State & Context Integration
- Access `useStore()`:
  - `result`: active `AnalysisResult` (if simulated).
  - `request`: current draft `AnalysisRequest` (if in wizard).
  - `lang`: active language (`en` vs `ar`).
  - `theme`: active theme (`light` vs `dark`).
- Automatically pass `farmer: result ? result.input : (request ?? undefined)` and `analysis_id: result?.request_id` to `api.ask(question, farmer, analysisId)`.

### B. Scenario Grounding Awareness
- Display a dynamic Context Pill in the chat header:
  - **Scenario Active:** Shows green dot + `"Active Field Scenario: [Region] · [Succession]"` with quick scenario-specific chips ("Why is strategy 1 ranked #1?", "How to reduce water demand?", "Explain salt leaching").
  - **Pre-Simulation / Landing:** Shows blue dot + `"NASA & FAO Knowledge Base"`.

### C. Visual & Interaction Design (/ui-ux-pro-max)
- **Bottom-Right FAB Button:**
  - 56×56px circle, fixed `bottom: 24px; right: 24px` (flips to `left: 24px` in RTL `[dir="rtl"]`).
  - Emerald Astryx gradient (`#1b4332` to `#2d6a4f`) with pulsing aura dot.
  - Sparkle vector SVG icon (0 emojis).
  - Hover pill tooltip: *"Ask AI Agronomist"* / *"اسأل المساعد الذكي"*.
- **Chat Drawer:**
  - 380px wide, max 560px height (fullscreen mobile drawer on small screens).
  - High-contrast tokens, 1.5px solid borders, backdrop-blur.
  - Message thread with user speech bubbles and AI grounded response cards with citation badges (`[FAO-56]`, `[NASA POWER]`, `[SMAP L4]`).
  - Clear / reset conversation option.
  - Accessible keyboard control (`Escape` to close, `Enter` to submit, focus trap).

---

## 2. Affected Files
1. `docs/plans/2026-11-14-floating-ai-assistant.md`
2. `web/src/features/assistant/FloatingAssistantWidget.tsx` (New)
3. `web/src/features/assistant/FloatingAssistantWidget.css` (New)
4. `web/src/App.tsx` (Mount `<FloatingAssistantWidget />` globally)
5. `web/src/i18n/ui.en.json` & `web/src/i18n/ui.ar.json` (New i18n keys)

---

## 3. Verification & Deployment
- `npm --prefix web run typecheck`
- `npm --prefix web run build`
- `python scripts/check_i18n.py`
- Commit: `feat(web): add persistent bottom-right floating ai assistant with scenario grounding`
- Push to `origin/Ahmed`
- Pull and rebuild web container on OCI server (`theshifters.l4s3r.site`).
