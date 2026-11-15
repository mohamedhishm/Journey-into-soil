# Implementation Plan: B8 OCI Deployment & B4 Climate Pack Integration

**Date:** 2026-11-12  
**Task:** B8 (devops) Trial deploy on OCI Ampere A1 & B4 (rotation-engine) Pack presence integration  
**Scope:** `api/app/services/climate.py`, `api/app/engine/pipeline.py`, `api/tests/engine/test_engine.py`, `infra/`, `docker-compose.yml`  

## 1. Context & Objectives
As the rotation-engine and devops engineer owning `api/`, `web/src/scene/`, `infra/`, and `docker-compose*.yml`:
1. **B8 Trial Deploy**:
   - Inspect listening ports on OCI Ampere A1 arm64 host (`141.253.121.245`).
   - Confirm `127.0.0.1:8080` is available.
   - Understand existing reverse proxy / ingress setup without touching Falqyn (`nepers-eye`) containers or proxy.
   - Deploy `journey-soil` via Docker Compose and smoke test.
2. **B4 Pack Integration**:
   - Ensure that when a climate pack is loaded:
     - `nasa_data` correctly reflects `"pack"` status for products in the pack (e.g. `power`, and extensible to others).
     - Confidence increases (no `conf.synthetic_climate` penalty).
     - `gap.synthetic_climate` and `gap.nasa_not_loaded` are eliminated from strategy gaps.
     - `disclaimer.preview_data` is omitted.
   - Build a small fixture pack and write unit tests in `api/tests/engine/test_engine.py`.
   - Run `make mock` and sync contracts.

## 2. OCI Port & Ingress Audit (B8)
We inspected the target OCI instance:
- **`ss -tlnp` output:**
  - `127.0.0.1:8080` is **completely free**.
  - Inbound ports `80` and `443` are blocked by UFW / iptables (only port 22 is open).
  - Existing projects (`gencare` and `nepers-eye` / Falqyn) route web traffic exclusively via **Cloudflare Tunnels** (`cloudflared`).
  - Falqyn runs Caddy internally inside its Docker stack (`nepers-eye-web-1` mounting `/srv/nepers-eye/infra/caddy/Caddyfile`), with no host-level Caddy service.
- **Strict Constraint**: Under no circumstances touch or restart Falqyn containers or `/srv/nepers-eye/infra/caddy/Caddyfile`.
- **Proposed Deploy Steps**:
  1. Clone `journey-into-soil` on OCI under `/srv/journey-into-soil` (or `/home/ubuntu/journey-into-soil`).
  2. Checkout branch `Ahmed`.
  3. Create `.env` from `.env.example`.
  4. Run `docker compose up -d --build`.
  5. Verify local health check on server: `curl -I http://127.0.0.1:8080` and `curl -I http://127.0.0.1:8080/api/v1/health`.
  6. Coordinate external HTTPS termination with the user (e.g., via Cloudflare tunnel route or standalone Caddy container).

## 3. Engine & Climate Pack Integration (B4)
### A. `api/app/services/climate.py`
- Add `products: list[str] = field(default_factory=list)` to `Climate` dataclass.
- When loading a pack, populate `products = pack.get("meta", {}).get("products", ["power"])`.
- Ensure fallback to `synthetic` leaves `products = []`.

### B. `api/app/engine/pipeline.py`
- Update `_nasa_panel(climate)` to assign `"pack"` status to any product present in `climate.products` (and ensure `"power"` gets `"pack"` when `climate.source == "pack"`).
- Verify that `disclaimer.preview_data` is excluded when `climate.source == "pack"`.

### C. `api/tests/engine/test_engine.py`
- Add `test_pack_climate_increases_confidence_and_removes_synthetic_gap`:
  - Use `monkeypatch` to redirect `PACKS_DIR` to a test fixture pack.
  - Verify `nasa_data` shows `power` with `status: "pack"`.
  - Verify confidence score is significantly higher than synthetic (e.g. `>= 0.70`).
  - Verify neither `gap.synthetic_climate` nor `conf.synthetic_climate` appear.

### D. Mock Result & Schema Validation
- Run `python scripts/make_mock_result.py` and `scripts/sync_contract.ps1` to ensure schema compliance and contract sync.

## 4. Verification & Definition of Done
1. `pytest -q` in `api/` passes all tests (including new pack fixture test).
2. `ruff check api` passes cleanly.
3. `npm run typecheck && npm run build` in `web/` succeeds.
4. `python scripts/check_i18n.py` passes with zero missing keys.
5. `api/tests/test_contract.py` passes.
6. Commit on branch `Ahmed` and update `docs/tasks/BACKLOG.md`.
