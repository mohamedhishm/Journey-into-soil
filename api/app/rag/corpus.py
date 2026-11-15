"""Build the agricultural knowledge corpus that the RAG retriever searches.

Sources, in priority order:
  1. Curated notes in knowledge/agronomy/*.md. Each note declares the ids from
     knowledge/sources.yaml that back it, so an answer can always be traced to a reference.
  2. Facts extracted from the structured knowledge base (knowledge/*.yaml): crop parameters,
     rotation rules and season windows. Values flagged reviewed: false are labelled as
     unreviewed seeds, because they are.

Nothing here is generated at query time: the corpus is built from files in the repository, so
retrieved text and citations cannot be invented by a language model.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from .. import knowledge
from ..config import get_settings

STOPWORDS = frozenset(
    """a an and are as at be because been but by can could do does for from had has have how i if in into is it
    its of on or other our should so some such than that the their them then there these they this to too was we
    were what when where which who why will with would you your about after also more most not only over same
    very much many any all each few own s t just don now between during before while""".split()
)


@dataclass
class Passage:
    id: str
    text: str
    title: str
    sources: list[str] = field(default_factory=list)
    kind: str = "note"

    def citation(self) -> dict:
        return {"id": self.id, "title": self.title, "sources": self.sources, "kind": self.kind}


def tokenize(text: str) -> list[str]:
    """Lowercase word tokens with very light plural/past stripping (no external NLP deps)."""
    words = re.findall(r"[a-z][a-z0-9]{1,}", text.lower())
    out = []
    for word in words:
        if word in STOPWORDS or len(word) < 3:
            continue
        if word.endswith("ies") and len(word) > 5:
            word = word[:-3] + "y"
        elif word.endswith("es") and len(word) > 4 and not word.endswith("ses"):
            word = word[:-2]
        elif word.endswith("s") and not word.endswith("ss"):
            word = word[:-1]
        out.append(word)
    return out


def _front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta: dict[str, str] = {}
    for line in parts[1].splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip()
    return meta, parts[2]


def _split_sentences(paragraph: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", paragraph) if len(s.strip()) > 30]


def note_passages(folder: Path) -> list[Passage]:
    """One passage per paragraph of each curated note, with the note's declared sources."""
    passages: list[Passage] = []
    if not folder.exists():
        return passages
    for path in sorted(folder.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        meta, body = _front_matter(raw)
        title = meta.get("title", path.stem.replace("_", " ").title())
        sources = [s.strip() for s in meta.get("sources", "").strip("[]").split(",") if s.strip()]
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
        index = 0
        for paragraph in paragraphs:
            if paragraph.startswith("#") or len(paragraph) < 60:
                continue
            index += 1
            passages.append(
                Passage(
                    id=f"agronomy.{path.stem}#{index}",
                    text=" ".join(paragraph.split()),
                    title=title,
                    sources=sources,
                    kind="note",
                )
            )
    return passages


def crop_passages() -> list[Passage]:
    """One factual passage per crop, built from knowledge/crops.yaml."""
    out: list[Passage] = []
    for crop in knowledge.crops().values():
        seasons = ", ".join(crop.get("seasons", []))
        water = {1: "low", 2: "medium", 3: "high"}.get(crop.get("water"), "unknown")
        review = "reviewed" if crop.get("reviewed") else "not yet reviewed by an agronomist"
        out.append(
            Passage(
                id=f"crops.{crop['id']}",
                text=(
                    f"{crop.get('name_en', crop['id'])} ({crop['id']}) is a {crop.get('family')} crop grown in the "
                    f"{seasons} season. Water demand class: {water}. It is "
                    f"{'a legume that can fix nitrogen' if crop.get('legume') else 'not a legume'}. "
                    f"Salinity threshold about {crop.get('salt_thr')} dS/m (ECe) with a yield decline of roughly "
                    f"{crop.get('salt_slope')}% per dS/m above it. Typical rooting depth {crop.get('root_cm')} cm. "
                    f"Rotation note: {crop.get('ref', '')}. Parameter status: {review}."
                ),
                title=f"{crop.get('name_en', crop['id'])} parameters",
                sources=["guide"],
                kind="crop",
            )
        )
    return out


def rule_passages() -> list[Passage]:
    """One passage per rotation rule, from knowledge/rotation_rules.yaml."""
    out: list[Passage] = []
    rules = knowledge.rotation_rules()
    for rule in rules.get("rules", []):
        text = (
            f"Rotation rule {rule.get('id')}: moving from {rule.get('prev_family') or rule.get('prev_crop')} to "
            f"{rule.get('next_family') or rule.get('next_crop') or 'a different crop'} scores "
            f"{rule.get('score')} rotation points. Source {rule.get('ref', '')}."
        )
        out.append(Passage(id=f"rules.{rule.get('id')}", text=text, title="Rotation rules", sources=["guide"], kind="rule"))
    repeat = rules.get("repeat", {})
    if repeat:
        out.append(
            Passage(
                id="rules.repeat",
                text=(
                    "Repeating the same crop family as the previous crop costs "
                    f"{abs(repeat.get('same_family_as_previous', 0))} rotation points, and the same family in two of "
                    f"the last three seasons costs {abs(repeat.get('same_family_in_two_of_last_three', 0))} points; a new "
                    f"family adds {repeat.get('new_family_bonus', 0)} points."
                ),
                title="Rotation rules",
                sources=["guide"],
                kind="rule",
            )
        )
    return out


def window_passages() -> list[Passage]:
    windows = knowledge.windows()
    text = "; ".join(
        f"{season}: sow between {spec.get('earliest_sow')} and {spec.get('latest_sow')}, harvest by "
        f"{spec.get('latest_harvest')}"
        for season, spec in windows.get("seasons", {}).items()
    )
    return [
        Passage(
            id="windows.seasons",
            text=f"Indicative Egyptian season windows (month-day): {text}. These vary by governorate, cultivar and system.",
            title="Season windows",
            sources=["guide"],
            kind="rule",
        )
    ]


def build() -> list[Passage]:
    folder = get_settings().knowledge_dir / "agronomy"
    return note_passages(folder) + crop_passages() + rule_passages() + window_passages()
