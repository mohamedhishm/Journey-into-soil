"""Loads the versioned YAML knowledge base once. Edit knowledge/*.yaml, never hard-code agronomy in Python."""
from __future__ import annotations

from functools import lru_cache
from typing import Any

import yaml

from .config import get_settings


@lru_cache
def _load(name: str) -> dict[str, Any]:
    path = get_settings().knowledge_dir / f"{name}.yaml"
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def crops() -> dict[str, dict]:
    data = _load("crops")
    defaults = data.get("defaults", {})
    return {c["id"]: {**defaults, **c} for c in data["crops"]}


def families() -> dict[str, dict]:
    return _load("crop_families")["families"]


def soils() -> dict[str, Any]:
    return _load("soils")


def windows() -> dict[str, Any]:
    return _load("season_windows")


def rotation_rules() -> dict[str, Any]:
    return _load("rotation_rules")


def strategies() -> dict[str, Any]:
    return _load("strategies")


def sources() -> dict[str, dict]:
    return _load("sources")["sources"]


def demo_sites() -> list[dict]:
    return _load("demo_sites")["sites"]


def version_tag() -> str:
    return "k" + "-".join(str(_load(n).get("version", 0)) for n in ("crops", "soils", "season_windows", "rotation_rules"))
