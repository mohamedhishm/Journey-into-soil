# AGENTS.md - Journey Into the Soil

Project: decision-support web app for NASA Space Apps 2026 "Field Shift: Adapting Farms with NASA Data" (team The Shifters).
Deadline: **14 Nov 2026**. NASA data arrives ~2 days before the hackathon. Owner: Ahmed Yasser. Chat language: English.

## Non-negotiables
1. **Support, not replace.** Advisory output only. No fertilizer rates, no yield or price promises, no "you must".
2. **Honesty about data.** Anything synthetic, estimated, unreviewed or qualitative must surface as a gap and lower confidence. Never present placeholder climate as NASA data.
3. **Contract first.** `contracts/result.schema.json` is the single interface between API and web. Change schema, regenerate `contracts/mock_result.json` (`make mock`), then update web. Bump `schema_version` on breaking change.
4. **i18n always.** Every user-facing string is an i18n key (`{key, params}` from the engine, `ui.*.json` in web). English and Arabic (RTL) must stay in key parity: `python scripts/check_i18n.py`.
5. **Knowledge is data.** Crop parameters, rules, windows live in `knowledge/*.yaml`, versioned. Values with `reviewed: false` are unreviewed seeds; domain experts flip them.
6. **React never touches Babylon objects.** All 3D goes through `web/src/scene/SceneController.ts`.
7. **Demo never depends on the network.** Demo sites use pre-built packs in `data/packs/demo_sites/`.

## Layout
- `api/app/sim` physics (ET0, pedotransfer, water balance, salinity); `api/app/engine` rotation engine (FIELD.PUA section 9 pipeline); `api/app/api/v1` routes; `api/app/services` climate/soil lookups.
- `knowledge/` YAML knowledge base + `knowledge/review/`. `contracts/` schema, mock, i18n catalogs.
- `web/` React + Vite + TS + Babylon.js + MapLibre. `pipelines/` offline NASA data fetch + pack builders. `infra/` reverse proxy. `docs/` plans, tasks, pitch.

## Commands
`bash scripts/bootstrap.sh` (or on Windows: `powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1` / `scripts\bootstrap.bat`) | `make dev-api` | `make dev-web` | `make test` | `make lint` | `make mock` | `python scripts/check_i18n.py` | `docker compose up -d --build`

## Definition of done (every task)
API: `pytest -q` and `ruff check .` green. Web: `npm run typecheck && npm run build` green. `check_i18n.py` green. Schema validated (`tests/test_contract.py`). Docs/backlog updated.

## Workflow
Read `docs/tasks/BACKLOG.md`, take the top unblocked item for your role, work on a branch, small commits, update the backlog status. Roles are in `.claude/agents/`. Start a fresh session with `docs/BOOTSTRAP_PROMPT.md`.

## Known caveats
Synthetic Nile Delta climate until packs land. Crop params unreviewed. Arabic strings are MSA drafts needing native review. OSM tiles need attribution. Babylon chunk is 1.5 MB (lazy-load if it hurts).
