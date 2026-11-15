#!/usr/bin/env python3
"""Fail if any translation key is missing. Run from the repo root: python scripts/check_i18n.py
Checks: en/ar key parity (engine + ui), every literal t("...") key in web/src exists, every dynamic t(`prefix.${x}`) prefix has keys."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
load = lambda p: json.loads((root / p).read_text(encoding="utf-8"))
engine_en, engine_ar = load("contracts/i18n/en.json"), load("contracts/i18n/ar.json")
ui_en, ui_ar = load("web/src/i18n/ui.en.json"), load("web/src/i18n/ui.ar.json")
errors = []
for name, a, b in (("engine", engine_en, engine_ar), ("ui", ui_en, ui_ar)):
    for k in sorted(set(a) ^ set(b)):
        errors.append(f"{name}: key only in one language: {k}")
keys = set(engine_en) | set(ui_en)
for path in (root / "web/src").rglob("*.ts*"):
    src = path.read_text(encoding="utf-8")
    for m in re.finditer(r"""\bt\(\s*["']([\w.]+)["']""", src):
        if m.group(1) not in keys:
            errors.append(f"{path.relative_to(root)}: missing key {m.group(1)}")
    for m in re.finditer(r"\bt\(\s*`([\w.]*)\$\{", src):
        if not any(k.startswith(m.group(1)) for k in keys):
            errors.append(f"{path.relative_to(root)}: no keys with prefix {m.group(1)}")
# Explicit dynamic enum keys check:
dynamic_enum_checks = {
    "ui.scene_moisture_": ["dry", "stress", "optimal", "saturated"],
    "ui.scene_salinity_": ["low", "moderate", "high"],
    "ui.scene_view_": ["3d", "cutaway", "canopy"],
}
for prefix, variants in dynamic_enum_checks.items():
    for variant in variants:
        full_key = f"{prefix}{variant}"
        if full_key not in keys:
            errors.append(f"dynamic key check: missing expected key {full_key}")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"i18n ok: {len(engine_en)} engine keys, {len(ui_en)} ui keys, both languages")
