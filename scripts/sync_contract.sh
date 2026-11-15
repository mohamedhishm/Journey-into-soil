#!/usr/bin/env bash
# Copies shared contract files into the web app (single source of truth stays in contracts/).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p web/public web/src/i18n
cp contracts/mock_result.json web/public/mock_result.json
cp contracts/i18n/en.json web/src/i18n/engine.en.json
cp contracts/i18n/ar.json web/src/i18n/engine.ar.json
echo "contract synced to web/"
