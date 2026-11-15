"""Egypt rotation candidate generator using the project's sourced crop catalog.

This is an MVP candidate generator, not a yield, profit, or agronomic simulator.
It reads Egypt crop-reference data and checks local NASA POWER/SoilGrids files.
Because locally validated water, soil-health, income and stage-risk scores are
not available, it optimizes only (a) FAO-56 Kc-mid reference proxy and (b) crop
family diversity. Both are explicitly labeled proxies, not recommendations.

Project layout (run from repository root):
  rotation_optimizer_connected.py
  egypt_rotation_optimizer_data.json
  rotation_input.json
  data/raw/power/<site_id>.json
  data/raw/soilgrids/<site_id>.json

Install: python -m pip install -r requirements-rotation.txt
Run:     python rotation_optimizer_connected.py --input rotation_input.json
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import ortools
from ortools.sat.python import cp_model

ROOT = Path(__file__).resolve().parent
DEFAULT_CATALOG = ROOT / "egypt_rotation_optimizer_data.json"
DEFAULT_INPUT = ROOT / "rotation_input.json"


@dataclass(frozen=True)
class Crop:
    id: str
    scientific_name: str
    family: str
    seasons: tuple[str, ...]
    kc_mid_reference: float | None
    kc_mid_source_text: str


@dataclass(frozen=True)
class Slot:
    year_index: int
    season: str

    @property
    def key(self) -> str:
        return f"y{self.year_index}_{self.season}"


@dataclass
class Candidate:
    scenario_id: str
    strategy_type: str
    rotation: list[dict[str, Any]]
    objective_value: int | None
    objective_label: str
    warnings: list[str]
    risk_status: str


@dataclass
class Plan:
    plan_id: str
    optimizer: str
    optimizer_version: str
    site_id: str
    catalog_version: str
    data_readiness: dict[str, Any]
    slots: list[dict[str, Any]]
    candidates: list[Candidate]
    candidate_count: int
    minimum_target: int
    minimum_target_met: bool
    shortfall_reason: str | None
    important_limits: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _first_float(value: Any) -> float | None:
    """Parse the first numeric reference from a catalog text field."""
    if value is None:
        return None
    match = re.search(r"(?<![A-Za-z])\d+(?:\.\d+)?", str(value))
    return float(match.group(0)) if match else None


def load_crop_catalog(path: Path) -> tuple[list[Crop], str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    crops: list[Crop] = []
    for row in data.get("crops", []):
        kc_text = row.get("fao56_reference", {}).get("kc_mid")
        crops.append(Crop(
            id=row["id"],
            scientific_name=row.get("scientific_name", ""),
            family=row["family"],
            seasons=tuple(row.get("egypt_seasons", [])),
            kc_mid_reference=_first_float(kc_text),
            kc_mid_source_text=str(kc_text or ""),
        ))
    if not crops:
        raise ValueError(f"No crops found in catalog: {path}")
    return crops, str(data.get("version", "unknown"))


def load_json_file(path: Path) -> tuple[dict[str, Any] | None, str]:
    if not path.exists():
        return None, "missing"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else None, "readable"
    except (OSError, json.JSONDecodeError) as exc:
        return None, f"invalid_json:{exc}"


def inspect_power(data: dict[str, Any] | None, status: str) -> dict[str, Any]:
    result: dict[str, Any] = {"status": status, "daily_records": None, "variables_found": []}
    if data is None:
        return result
    parameters = data.get("properties", {}).get("parameter", {})
    if not isinstance(parameters, dict):
        result["status"] = "readable_but_unrecognized_format"
        return result
    result["variables_found"] = sorted(parameters.keys())
    tmax = parameters.get("T2M_MAX", {})
    if isinstance(tmax, dict):
        result["daily_records"] = len(tmax)
    result["status"] = "readable"
    return result


def make_slots(planning_years: int, seasons: list[str]) -> list[Slot]:
    if planning_years < 1 or not seasons:
        raise ValueError("planning_years and seasons_per_year must be non-empty/positive")
    return [Slot(y, season) for y in range(1, planning_years + 1) for season in seasons]


def check_baseline(
    baseline: list[dict[str, Any]], crops: dict[str, Crop], slots: list[Slot], min_family_distance: int
) -> list[str]:
    warnings: list[str] = []
    by_key = {s.key: i for i, s in enumerate(slots)}
    resolved: list[tuple[int, Crop]] = []
    seen: set[str] = set()
    for entry in baseline:
        crop_id = entry.get("crop_id")
        season = entry.get("season")
        year = entry.get("year_index")
        key = f"y{year}_{season}"
        if key not in by_key:
            warnings.append(f"baseline_slot_not_in_plan:{key}")
            continue
        if key in seen:
            warnings.append(f"duplicate_baseline_slot:{key}")
            continue
        seen.add(key)
        crop = crops.get(str(crop_id))
        if crop is None:
            warnings.append(f"unknown_baseline_crop:{crop_id}")
            continue
        if season not in crop.seasons:
            warnings.append(f"crop_not_eligible_for_season:{crop_id}:{season}")
        resolved.append((by_key[key], crop))
    if len(seen) < len(slots):
        warnings.append(f"baseline_incomplete:{len(seen)}_of_{len(slots)}_slots")
    resolved.sort(key=lambda item: item[0])
    for (i, a), (j, b) in zip(resolved, resolved[1:]):
        if a.family == b.family and j - i < min_family_distance:
            warnings.append(f"family_repeat_too_close:{a.id}:{b.id}:distance={j-i}")
    return warnings


def solve_candidate(
    crops: dict[str, Crop], slots: list[Slot], strategy: str,
    min_family_distance: int, max_uses_per_crop: int | None,
    forbidden: list[tuple[str, ...]], time_limit: float,
) -> tuple[list[str], int] | None:
    model = cp_model.CpModel()
    eligible_by_slot: list[list[Crop]] = []
    x: dict[tuple[int, str], cp_model.IntVar] = {}
    for i, slot in enumerate(slots):
        eligible = [c for c in crops.values() if slot.season in c.seasons]
        if not eligible:
            raise ValueError(f"No catalog crops eligible for season {slot.season}")
        eligible_by_slot.append(eligible)
        for crop in eligible:
            x[(i, crop.id)] = model.new_bool_var(f"x_{i}_{crop.id}")
        model.add(sum(x[(i, c.id)] for c in eligible) == 1)

    # Optional planning preference; not an Egypt-specific agronomic disease rule.
    if max_uses_per_crop is not None:
        if max_uses_per_crop < 1:
            raise ValueError("max_uses_per_crop must be >= 1 or null")
        for crop in crops.values():
            crop_vars = [var for (i, crop_id), var in x.items() if crop_id == crop.id]
            if crop_vars:
                model.add(sum(crop_vars) <= max_uses_per_crop)

    # Enforce a minimum distance between two crops of the same family.
    for i, slot_crops in enumerate(eligible_by_slot):
        for j in range(max(0, i - min_family_distance + 1), i):
            for crop in slot_crops:
                for earlier in eligible_by_slot[j]:
                    if crop.family == earlier.family:
                        model.add(x[(i, crop.id)] + x[(j, earlier.id)] <= 1)

    for sequence in forbidden:
        vars_for_sequence = [x.get((i, crop_id)) for i, crop_id in enumerate(sequence)]
        if len(sequence) == len(slots) and all(v is not None for v in vars_for_sequence):
            model.add(sum(vars_for_sequence) <= len(slots) - 1)

    if strategy in ("kc_proxy", "balanced_proxy"):
        # Minimize FAO-56 Kc-mid reference only. This is NOT seasonal water use.
        terms = []
        for (i, crop_id), var in x.items():
            value = crops[crop_id].kc_mid_reference
            if value is None:
                raise ValueError(f"Missing numeric Kc-mid reference for {crop_id}; cannot optimize this proxy")
            terms.append(round(value * 1000) * var)
        if strategy == "kc_proxy":
            model.minimize(sum(terms))
        else:
            # Demonstration-only weighted combination; the coefficient is configurable in code.
            family_bonus = 100
            present: dict[str, cp_model.IntVar] = {}
            for family in sorted({c.family for c in crops.values()}):
                vars_for_family = [var for (i, cid), var in x.items() if crops[cid].family == family]
                if vars_for_family:
                    present[family] = model.new_bool_var(f"family_{family}")
                    model.add_max_equality(present[family], vars_for_family)
            model.maximize(sum(present.values()) * family_bonus - sum(terms))
    elif strategy == "family_diversity":
        present: dict[str, cp_model.IntVar] = {}
        for family in sorted({c.family for c in crops.values()}):
            vars_for_family = [var for (i, cid), var in x.items() if crops[cid].family == family]
            if vars_for_family:
                present[family] = model.new_bool_var(f"family_{family}")
                model.add_max_equality(present[family], vars_for_family)
        model.maximize(sum(present.values()))
    else:
        raise ValueError(f"Unknown strategy: {strategy}")

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 17
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    selected = []
    for i in range(len(slots)):
        selected.append(next(cid for (idx, cid), var in x.items() if idx == i and solver.value(var)))
    return selected, int(round(solver.objective_value))


def build_plan(input_path: Path, catalog_path: Path) -> Plan:
    config = json.loads(input_path.read_text(encoding="utf-8"))
    crops_list, catalog_version = load_crop_catalog(catalog_path)
    crops = {c.id: c for c in crops_list}
    if len(crops) != len(crops_list):
        raise ValueError("Crop IDs in catalog must be unique")

    site_id = str(config.get("site_id", ""))
    if not site_id:
        raise ValueError("Set site_id in rotation_input.json to match data/raw file names")
    data_paths = config.get("data_paths", {})
    power_path = ROOT / data_paths.get("weather", f"data/raw/power/{site_id}.json")
    soil_path = ROOT / data_paths.get("soil", f"data/raw/soilgrids/{site_id}.json")
    power_data, power_status = load_json_file(power_path)
    soil_data, soil_status = load_json_file(soil_path)

    readiness = {
        "crop_catalog": {"status": "readable", "path": str(catalog_path), "crops": len(crops_list)},
        "nasa_power": {"path": str(power_path), **inspect_power(power_data, power_status)},
        "soilgrids": {"path": str(soil_path), "status": soil_status,
                       "properties_in_file": sorted(soil_data.keys()) if soil_data else []},
        "weather_used_in_objective": False,
        "soil_used_in_objective": False,
        "reason": "No crop-stage calendar/validated thermal thresholds or local soil-health response coefficients in the catalog.",
    }

    seasons = config.get("seasons_per_year", ["winter", "summer"])
    slots = make_slots(int(config.get("planning_years", 3)), list(seasons))
    min_distance = int(config.get("constraints", {}).get("min_family_distance_slots", 2))
    max_uses = config.get("constraints", {}).get("max_uses_per_crop", 1)
    max_uses = None if max_uses is None else int(max_uses)
    if min_distance < 1:
        raise ValueError("min_family_distance_slots must be >= 1")
    baseline = config.get("baseline", [])
    baseline_warnings = check_baseline(baseline, crops, slots, min_distance)
    baseline_map = {(int(e.get("year_index", -1)), e.get("season")): e.get("crop_id") for e in baseline}
    baseline_rotation = []
    for slot in slots:
        crop_id = baseline_map.get((slot.year_index, slot.season))
        baseline_rotation.append({"year_index": slot.year_index, "season": slot.season,
                                 "crop_id": crop_id, "family": crops[crop_id].family if crop_id in crops else None})

    minimum = max(1, int(config.get("minimum_candidate_count_including_baseline", 3)))
    time_limit = float(config.get("time_limit_seconds", 5))
    strategies = ["kc_proxy", "family_diversity", "balanced_proxy"]
    candidates = [Candidate(
        scenario_id="baseline", strategy_type="existing_rotation", rotation=baseline_rotation,
        objective_value=None, objective_label="Not optimized; farmer-provided baseline",
        warnings=baseline_warnings,
        risk_status="NOT SCORED: validated crop-stage thresholds and planting-stage dates are unavailable.",
    )]
    forbidden: list[tuple[str, ...]] = []
    attempts = 0
    while len(candidates) < minimum and attempts < 30:
        strategy = strategies[attempts % len(strategies)]
        attempts += 1
        solved = solve_candidate(crops, slots, strategy, min_distance, max_uses, forbidden, time_limit)
        if solved is None:
            continue
        sequence, value = solved
        if tuple(sequence) in forbidden:
            continue
        forbidden.append(tuple(sequence))
        rotation = []
        for slot, crop_id in zip(slots, sequence):
            crop = crops[crop_id]
            rotation.append({"year_index": slot.year_index, "season": slot.season,
                             "crop_id": crop.id, "scientific_name": crop.scientific_name,
                             "family": crop.family, "fao56_kc_mid_reference": crop.kc_mid_reference,
                             "kc_reference_text": crop.kc_mid_source_text})
        label = {
            "kc_proxy": "Minimize sum of FAO-56 Kc-mid reference values (not water volume)",
            "family_diversity": "Maximize number of represented crop families (diversity proxy only)",
            "balanced_proxy": "Demo-only combined Kc-mid/family-diversity score; not agronomically calibrated",
        }[strategy]
        candidates.append(Candidate(
            scenario_id=f"candidate_{len(candidates)}", strategy_type=strategy, rotation=rotation,
            objective_value=value, objective_label=label,
            warnings=["Requires agronomist review; objective uses a reference proxy, not measured yield, water, soil health, or profit."],
            risk_status="NOT SCORED: validated crop-stage thresholds and planting-stage dates are unavailable.",
        ))

    return Plan(
        plan_id=str(config.get("plan_id", "rotation-plan")), optimizer="OR-Tools CP-SAT",
        optimizer_version=ortools.__version__, site_id=site_id, catalog_version=catalog_version,
        data_readiness=readiness,
        slots=[{"year_index": s.year_index, "season": s.season, "key": s.key} for s in slots],
        candidates=candidates, candidate_count=len(candidates), minimum_target=minimum,
        minimum_target_met=len(candidates) >= minimum,
        shortfall_reason=None if len(candidates) >= minimum else
            f"Only {len(candidates)} candidates generated; relax family-distance constraint or add season-eligible crops.",
        important_limits=[
            "FAO-56 Kc values are reference coefficients, not Egypt-local calibration.",
            "Kc-mid is not seasonal irrigation volume; use daily ETo, crop stage dates, Kc curves and soil-water balance for water ranking.",
            "Family diversity is not proof of soil-health benefit; use locally reviewed disease/rotation rules.",
            "The max_uses_per_crop setting is a configurable demo diversity preference, not a sourced crop-return interval.",
            "Profit and income are not optimized: current regional prices/costs are not supplied.",
            "Weather and soil files are detected for readiness but are not scored by this script.",
            "Replace the sample baseline and input configuration with real field records before interpreting results.",
        ],
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate transparent Egypt crop-rotation candidates")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Field/rotation input JSON")
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG, help="Sourced crop catalog JSON")
    parser.add_argument("--output", type=Path, default=None, help="Output JSON path; defaults to data/packs/rotation/<field_id>.json")
    args = parser.parse_args()
    if not args.input.is_absolute(): args.input = ROOT / args.input
    if not args.catalog.is_absolute(): args.catalog = ROOT / args.catalog
    if not args.input.exists(): raise FileNotFoundError(f"Input file not found: {args.input}")
    if not args.catalog.exists(): raise FileNotFoundError(f"Crop catalog not found: {args.catalog}")

    plan = build_plan(args.input, args.catalog)
    field_id = json.loads(args.input.read_text(encoding="utf-8")).get("field_id", plan.site_id)
    output = args.output or (ROOT / "data" / "packs" / "rotation" / f"{field_id}.json")
    if not output.is_absolute(): output = ROOT / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(plan.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Plan saved: {output}")
    print(f"Candidates: {plan.candidate_count}/{plan.minimum_target}; target_met={plan.minimum_target_met}")
    print("Data readiness:")
    print(json.dumps(plan.data_readiness, ensure_ascii=False, indent=2))
    print("NOTE: inspect important_limits in the output before interpreting rankings.")


if __name__ == "__main__":
    main()
