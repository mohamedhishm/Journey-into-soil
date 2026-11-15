# Journey Into the Soil: workspace rules

Project: NASA Space Apps 2026 "Field Shift". Repo root = this workspace. Read AGENTS.md and docs/tasks/BACKLOG.md

## Environment (Windows)
- Shell is Windows PowerShell 5: NEVER use `&&`. Run commands one per line, or use `;`.
- Python venv is at ..\.venv (activate with `..\.venv\Scripts\Activate.ps1` from the repo root).
- API: `cd api` then `python -m pytest -q`. Pipelines: `python -m pytest pipelines/tests -q`.

## Scope
- Another person is finishing web/. Do NOT edit web/ except mirrored contract files via scripts/sync_contract.ps1.
- Contract changes must be ADDITIVE and updated together: contracts/result.schema.json, contracts/mock_result.json (scripts/make_mock_result.py), contracts/i18n/*.json (ar + en), docs/result-schema.md, tests. Run `python scripts/check_i18n.py`.

## Honesty rules (non-negotiable)
- Never invent NASA product versions, dataset values, Kc/root-depth/salinity numbers or citations. Unverified = write "unverified".
- Data status stays honest in the product: placeholder / planned / pack. Mark a product "pack" only if real data for that site is in the pack.
- Keep the "support, not replacement" disclaimer. Scores are relative within the candidate pool; say so.
- Free and legal sources only. No pirated PDFs. Summarize references in our own words with links.
- Do not mark crop parameters `reviewed: true`; only domain experts do that.

## Working style
- Every code change needs tests; keep all existing tests green (currently 80 API + 13 pipeline).
- Small verified steps. Run the Definition of Done before reporting complete, and paste the real command outputs in the Walkthrough.
- Ask before: deleting files, changing knowledge/*.yaml values, installing system packages, or anything that needs credentials (Earthdata token). Never print or commit tokens.
- Update docs/tasks/BACKLOG.md when an item finishes.