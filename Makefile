.PHONY: packs bootstrap dev-api dev-web test test-api test-web lint mock sync up down
bootstrap:
	bash scripts/bootstrap.sh
dev-api:
	cd api && . ../.venv/bin/activate && uvicorn app.main:app --reload --port 8000
dev-web:
	cd web && npm run dev
packs:
	. .venv/bin/activate && python pipelines/build_demo_packs.py
test: test-api test-web
test-api:
	cd api && . ../.venv/bin/activate && python -m pytest -q
test-web:
	cd web && npm run typecheck
lint:
	cd api && . ../.venv/bin/activate && ruff check .
mock:
	. .venv/bin/activate && python scripts/make_mock_result.py && bash scripts/sync_contract.sh
sync:
	bash scripts/sync_contract.sh
up:
	docker compose up -d --build
down:
	docker compose down
