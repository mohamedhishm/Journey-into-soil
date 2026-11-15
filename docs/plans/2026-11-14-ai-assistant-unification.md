# Plan: AI Assistant Unification & Post-Simulation Proactive Chatbot

**Date:** 2026-11-14  
**Scope:** `web`  
**Related Requirements:**  
- Port questions entered in the Results tab into the global floating chatbot drawer.
- Display a proactive notification callout balloon above the bottom-right assistant button when simulation completes: *"Simulation complete! Ask me anything about your scenario"*.
- Unify assistant state in `useStore`: `assistantOpen`, `setAssistantOpen(open, query?)`, `assistantNotification`, and `dismissAssistantNotification()`.
- Zero emojis: 100% vector message SVG icons (`M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z`).
- WCAG AAA contrast in both Light & Dark modes.
- Complete English and Arabic (RTL) i18n parity.

---

## 1. Architecture & State Management

### A. Store Additions (`web/src/state/store.ts`)
- Add state properties:
  - `assistantOpen: boolean`
  - `assistantInitialQuery: string | null`
  - `assistantNotification: string | null`
- Add actions:
  - `setAssistantOpen: (open: boolean, initialQuery?: string) => void`
  - `dismissAssistantNotification: () => void`
- In `analyze()` and `openDemoSite()`:
  - When simulation completes successfully, set `assistantNotification: "Simulation complete! Ask me anything about your scenario"`.

### B. Proactive Callout Popup (`FloatingAssistantWidget.tsx`)
- When `assistantNotification` is active and `assistantOpen` is false:
  - Render an animated callout popup right above the bottom-right FAB.
  - Clicking anywhere on the callout opens the chatbot drawer.
  - Clicking `✕` dismisses the notification.
  - Auto-dismiss after 12 seconds if unclicked.

### C. Porting Tab 3 Input to Chatbot (`ResultsDashboard.tsx`)
- Replace the legacy separate `AgentPanel` with an integrated **AI Agronomist Gateway Card**:
  - Displays prompt field with placeholder *"e.g. Why was strategy 1 recommended for this farm?"*.
  - Typing here and pressing `Enter` or clicking *"Ask in Chatbot"* immediately:
    1. Opens the floating assistant drawer.
    2. Transmits the query into the chatbot thread.
    3. Triggers the backend scenario-grounded API call (`api.ask`).

---

## 2. Affected Files
1. `docs/plans/2026-11-14-ai-assistant-unification.md`
2. `web/src/state/store.ts`
3. `web/src/features/assistant/FloatingAssistantWidget.tsx`
4. `web/src/features/assistant/FloatingAssistantWidget.css`
5. `web/src/features/results/ResultsDashboard.tsx`
6. `web/src/features/results/ResultsDashboard.css`
7. `web/src/i18n/ui.en.json` & `web/src/i18n/ui.ar.json`

---

## 3. Verification & Deployment
- `npm --prefix web run typecheck`
- `npm --prefix web run build`
- `python scripts/check_i18n.py`
- Commit & push to `origin/Ahmed`
- Deploy to OCI production server and verify.
