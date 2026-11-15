"""Step 4: rotation constraints over the last three seasons, driven by knowledge/rotation_rules.yaml (FIELD.PUA s6)."""
from __future__ import annotations

from .. import knowledge


def _matches(rule: dict, prev: dict, crop: dict) -> bool:
    if "prev_family" in rule and prev["family"] != rule["prev_family"]:
        return False
    if "next_family" in rule and crop["family"] != rule["next_family"]:
        return False
    if "prev_crop" in rule and prev["id"] != rule["prev_crop"]:
        return False
    if "next_crop" in rule and crop["id"] != rule["next_crop"]:
        return False
    if "next_not_family" in rule and crop["family"] == rule["next_not_family"]:
        return False
    if "next_not_crop" in rule and crop["id"] == rule["next_not_crop"]:
        return False
    return True


def transition(prev_crops: list[dict], crop: dict) -> tuple[float, list[dict]]:
    """Score `crop` following `prev_crops` (newest first). Returns (points, notes).

    A note is {"type": "why"|"risk", "key", "params", "rule", "ref"}.
    """
    rules = knowledge.rotation_rules()
    rep = rules["repeat"]
    notes: list[dict] = []
    score = 0.0
    if not prev_crops:
        return score, notes
    prev = prev_crops[0]

    if prev["family"] == crop["family"]:
        score += rep["same_family_as_previous"]
        notes.append({"type": "risk", "key": "rot.same_family", "params": {"crop": crop["id"], "family": crop["family"]},
                      "rule": "same_family_as_previous", "ref": "FIELD.PUA s6"})
    else:
        score += rep["new_family_bonus"]
        notes.append({"type": "why", "key": "why.family_break", "params": {"crop": crop["id"], "prev": prev["id"]},
                      "rule": "new_family_bonus", "ref": "FIELD.PUA s6"})
    if sum(1 for p in prev_crops[:3] if p["family"] == crop["family"]) >= 2:
        score += rep["same_family_in_two_of_last_three"]
        notes.append({"type": "risk", "key": "rot.family_repeat", "params": {"crop": crop["id"], "family": crop["family"]},
                      "rule": "same_family_in_two_of_last_three", "ref": "FIELD.PUA s6"})

    for rule in rules["rules"]:
        if not _matches(rule, prev, crop):
            continue
        score += rule["score"]
        if rule["score"] > 0 and rule.get("why_key"):
            notes.append({"type": "why", "key": rule["why_key"], "params": {"crop": crop["id"], "prev": prev["id"]},
                          "rule": rule["id"], "ref": rule["ref"]})
        if rule["score"] < 0 or rule.get("caution_key"):
            notes.append({"type": "risk", "key": rule.get("caution_key", "rot.generic"),
                          "params": {"crop": crop["id"], "prev": prev["id"]}, "rule": rule["id"], "ref": rule["ref"]})
    return score, notes
