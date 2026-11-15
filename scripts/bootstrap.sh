#!/usr/bin/env bash
# One-shot setup for a fresh clone (Linux/macOS/WSL/Git Bash).
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf "\n\033[1;32m==> %s\033[0m\n" "$1"; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing tool: $1 ($2)"; MISSING=1; }; }

say "Checking tools"
MISSING=0
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_CMD="python"
else
  echo "Missing tool: python3 or python (install Python 3.11+)"
  MISSING=1
fi

need node "install Node 20+"
need npm "comes with Node"
command -v docker >/dev/null 2>&1 || echo "Note: docker not found (only needed for deployment)."
[ "$MISSING" = "1" ] && exit 1
echo "Python $($PYTHON_CMD -c 'import sys; print("%d.%d" % sys.version_info[:2])'), Node $(node -v)"

say "Creating .env"
[ -f .env ] || cp .env.example .env
if ! grep -q "^LOCAL_OVERRIDES=1" .env; then
  # On Git Bash / MSYS, use Windows paths so Python on Windows can resolve them
  if [ -n "${MSYSTEM:-}" ] || [[ "${OSTYPE:-}" == "msys"* ]] || [[ "${OSTYPE:-}" == "cygwin"* ]]; then
    REPO_DIR=$(pwd -W 2>/dev/null || pwd)
    REPO_DIR="${REPO_DIR//\\//}"
  else
    REPO_DIR=$(pwd)
  fi
  {
    echo "LOCAL_OVERRIDES=1"
    echo "DATABASE_URL=sqlite:///${REPO_DIR}/data/app.db"
    echo "KNOWLEDGE_DIR=${REPO_DIR}/knowledge"
    echo "CONTRACTS_DIR=${REPO_DIR}/contracts"
    echo "PACKS_DIR=${REPO_DIR}/data/packs"
  } >> .env
fi

say "Python venv + API dependencies"
[ -d .venv ] || "$PYTHON_CMD" -m venv .venv
# shellcheck disable=SC1091
if [ -f .venv/bin/activate ]; then
  . .venv/bin/activate
elif [ -f .venv/Scripts/activate ]; then
  . .venv/Scripts/activate
else
  echo "Error: activate script not found in .venv"
  exit 1
fi
pip install -q --upgrade pip
pip install -q -r api/requirements.txt -r api/requirements-dev.txt
pip install -q -r pipelines/requirements.txt || echo "pipelines deps skipped (optional, laptop only)"

say "Generating mock result from the real sim + engine"
python scripts/make_mock_result.py
bash scripts/sync_contract.sh

say "API tests"
( cd api && python -m pytest -q )

say "Web dependencies + typecheck"
( cd web && npm install --no-audit --no-fund && npm run typecheck )

say "Done"
cat <<MSG
Next:
  make dev-api   # http://localhost:8000/docs
  make dev-web   # http://localhost:5173
  Read AGENTS.md and docs/BOOTSTRAP_PROMPT.md, then pick a task in docs/tasks/BACKLOG.md
  Earthdata: docs/earthdata-setup.md (backlog B2 builds pipelines/earthdata/check_access.py)
MSG
