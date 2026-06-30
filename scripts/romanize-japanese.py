#!/usr/bin/env python
"""Generate learner-facing Hepburn romaji for Japanese Tutor lesson examples.

Default behavior is safe/read-only: report examples that are missing exampleRomaji.
Use --write to insert generated exampleRomaji fields only where they are missing.
Use --overwrite to replace existing fields with generated readings.

Install dependencies with:
  python -m pip install -r scripts/requirements-romanizer.txt
or:
  npm run setup:romanizer
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    import jaconv
    from fugashi import Tagger
except ModuleNotFoundError as exc:  # pragma: no cover - exercised manually by CLI users.
    missing = exc.name or "romanizer dependency"
    print(
        f"Missing {missing}. Install romanizer dependencies with:\n"
        "  python -m pip install -r scripts/requirements-romanizer.txt\n"
        "or:\n"
        "  npm run setup:romanizer",
        file=sys.stderr,
    )
    raise SystemExit(2) from exc


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FILE = REPO_ROOT / "src" / "data" / "mockSenseiLessons.ts"
PUNCT = {"。": ".", "、": ",", "？": "?", "?": "?", "！": "!", "!": "!"}
TAGGER = Tagger()


@dataclass
class ExampleRow:
    line_index: int
    item_id: str
    level: str
    japanese: str
    existing_romaji: str | None


def kana_reading(word) -> str:
    return getattr(word.feature, "kana", None) or getattr(word.feature, "pron", None) or word.surface


def kana_to_romaji(kana: str) -> str:
    # jaconv handles small っ and katakana long-vowel marks better than the older ad-hoc table.
    return jaconv.kata2alphabet(kana).lower()


def starts_verb_group(word) -> bool:
    return word.feature.pos1 in {"動詞", "形容詞", "助動詞"}


def continues_verb_group(word) -> bool:
    return word.feature.pos1 in {"動詞", "形容詞", "助動詞"} or word.surface in {
        "て",
        "で",
        "た",
        "だ",
        "ない",
        "なかっ",
    }


def normalize_romaji(value: str) -> str:
    value = value.strip().lower()
    replacements = {
        "wo": "o",
        "watakushi": "watashi",
        "dewa": "de wa",
        "asu,": "ashita,",
        "asu ": "ashita ",
        "fuxtsute": "futte",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)

    # Katakana long-vowel mark can become a trailing dash: shawa- -> shawaa.
    # Protect honorific hyphens first: tanaka-san must not become tanakaasan.
    value = value.replace("-san", "__HONORIFIC_SAN__")
    for vowel in "aeiou":
        value = value.replace(vowel + "-", vowel * 2)
    value = value.replace("__HONORIFIC_SAN__", "-san")

    # Learner-facing spacing preferences used in the app.
    value = value.replace("teimasu", "te imasu")
    value = value.replace("taidesu", "tai desu")
    value = value.replace("nodesu", "node")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def romanize(sentence: str) -> str:
    words: list[str] = []
    tokens = list(TAGGER(sentence))
    i = 0
    while i < len(tokens):
        token = tokens[i]
        surface = token.surface

        if surface in PUNCT:
            if words:
                words[-1] = words[-1].rstrip() + PUNCT[surface]
            else:
                words.append(PUNCT[surface])
            i += 1
            continue

        if surface == "さん":
            if words:
                words[-1] = f"{words[-1]}-san"
            else:
                words.append("san")
            i += 1
            continue

        if surface == "ください":
            words.append("kudasai")
            i += 1
            continue

        if starts_verb_group(token):
            kana = ""
            while i < len(tokens):
                next_token = tokens[i]
                next_surface = next_token.surface
                if next_surface in PUNCT or next_surface == "ください":
                    break
                if next_token.feature.pos1 == "助詞" and next_surface not in {"て", "で"}:
                    break
                if not continues_verb_group(next_token):
                    break
                kana += kana_reading(next_token)
                i += 1
            words.append(kana_to_romaji(kana))
            continue

        if token.feature.pos1 == "助詞":
            if surface == "は":
                words.append("wa")
            elif surface == "を":
                words.append("o")
            elif surface == "へ":
                words.append("e")
            else:
                words.append(kana_to_romaji(kana_reading(token)))
            i += 1
            continue

        words.append(kana_to_romaji(kana_reading(token)))
        i += 1

    text = " ".join(words)
    text = text.replace(" ,", ",").replace(" .", ".").replace(" ?", "?").replace(" !", "!")
    return normalize_romaji(text)


def parse_examples(lines: list[str]) -> list[ExampleRow]:
    rows: list[ExampleRow] = []
    current_level = ""
    for index, line in enumerate(lines):
        level_match = re.search(r"level: '([^']+)'", line)
        if level_match:
            current_level = level_match.group(1)
        if "exampleJapanese:" not in line:
            continue
        id_match = re.search(r"id: '([^']+)'", line)
        japanese_match = re.search(r"exampleJapanese: '([^']+)'", line)
        romaji_match = re.search(r"exampleRomaji: '([^']*)'", line)
        if id_match and japanese_match:
            rows.append(
                ExampleRow(
                    line_index=index,
                    item_id=id_match.group(1),
                    level=current_level,
                    japanese=japanese_match.group(1),
                    existing_romaji=romaji_match.group(1) if romaji_match else None,
                )
            )
    return rows


def insert_or_replace_romaji(line: str, japanese: str, romaji: str, overwrite: bool) -> str:
    if "exampleRomaji:" in line:
        if not overwrite:
            return line
        return re.sub(r"exampleRomaji: '[^']*'", f"exampleRomaji: '{romaji}'", line)
    return line.replace(
        f"exampleJapanese: '{japanese}', exampleEnglish:",
        f"exampleJapanese: '{japanese}', exampleRomaji: '{romaji}', exampleEnglish:",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate/check romaji for Japanese Tutor lesson examples.")
    parser.add_argument("--file", default=str(DEFAULT_FILE), help="Lesson data file to update/check.")
    parser.add_argument("--level", default="N4", help="Lesson level to process, e.g. N4, N5, or all.")
    parser.add_argument("--write", action="store_true", help="Write generated romaji for missing fields.")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing exampleRomaji fields too.")
    parser.add_argument("--check", action="store_true", help="Fail if selected examples are missing exampleRomaji.")
    parser.add_argument("--samples", type=int, default=8, help="Number of sample generated readings to print.")
    args = parser.parse_args()

    path = Path(args.file).resolve()
    lines = path.read_text(encoding="utf-8").splitlines()
    rows = parse_examples(lines)
    selected = [row for row in rows if args.level.lower() == "all" or row.level == args.level]
    missing = [row for row in selected if not (row.existing_romaji or "").strip()]

    changed = 0
    samples: list[dict[str, str]] = []
    for row in selected:
        generated = romanize(row.japanese)
        if len(samples) < args.samples:
            samples.append({"id": row.item_id, "japanese": row.japanese, "romaji": generated})
        should_write = args.overwrite or (args.write and not (row.existing_romaji or "").strip())
        if should_write:
            new_line = insert_or_replace_romaji(lines[row.line_index], row.japanese, generated, overwrite=args.overwrite)
            if new_line != lines[row.line_index]:
                lines[row.line_index] = new_line
                changed += 1

    if args.write or args.overwrite:
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        rows_after = parse_examples(lines)
        selected_after = [row for row in rows_after if args.level.lower() == "all" or row.level == args.level]
        missing_after = [row for row in selected_after if not (row.existing_romaji or "").strip()]
    else:
        missing_after = missing

    print(f"romanizer file={path}")
    print(f"level={args.level} selected={len(selected)} missing={len(missing_after)} changed={changed}")
    for sample in samples:
        print(f"sample {sample['id']}: {sample['japanese']} => {sample['romaji']}")

    if args.check and missing_after:
        print("Missing exampleRomaji fields:", file=sys.stderr)
        for row in missing_after[:50]:
            print(f"  {row.item_id}: {row.japanese}", file=sys.stderr)
        if len(missing_after) > 50:
            print(f"  ... and {len(missing_after) - 50} more", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
