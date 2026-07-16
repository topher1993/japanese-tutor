#!/usr/bin/env python3
"""
Verify Japanese phrases against Jisho.org (JMDICT-backed) API.

For each phrase in the 4 draft data files:
  - Hit https://jisho.org/api/v1/search/words?keyword=<phrase>
  - If status=200 and a defined entry's kana reading romanizes exactly to the
    romaji on file, mark it as VERIFIED.
  - Otherwise mark as NEEDS_REVIEW with the reason.

Reading verification uses jaconv from requirements-romanizer.txt. If that
dependency is unavailable, results conservatively remain unverified.

Outputs:
  - Console summary table
  - docs/translation-verification.md  (full report)
  - .hermes/verification-cache.json (raw API responses for replay)
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import jaconv
except ModuleNotFoundError:  # The verifier remains safe before optional setup.
    jaconv = None

ROOT = Path(__file__).resolve().parents[1]
DATA_FILES = [
    'src/data/workplaceSurvivalPhrases.ts',
    'src/data/additionalLessonCategoryContent.ts',
    'src/data/mockSenseiLessons.ts',
    'src/data/supplementalFlashcards.ts',
]

# Extract phrase entries from TS data files. Each has: japanese, romaji, status.
# We use a simple regex for `{ ... japanese: 'X', romaji: 'Y', ... }` since
# the files all follow the same shape after the data layout work in Step 4-5.
PHRASE_RE = re.compile(
    r"japanese:\s*'([^']+)'\s*,\s*romaji:\s*'([^']+)'[^}]*?translationReviewStatus:\s*'([^']+)'",
    re.DOTALL,
)

JISHO_API = 'https://jisho.org/api/v1/search/words'
CACHE_PATH = ROOT / '.hermes' / 'verification-cache.json'
REPORT_PATH = ROOT / 'docs' / 'translation-verification.md'


def normalize_romaji(value: str) -> str:
    """Normalize learner-facing romaji without pretending kana is Latin text."""
    normalized = value.strip().lower().translate(str.maketrans({
        'ā': 'aa', 'ī': 'ii', 'ū': 'uu', 'ē': 'ee', 'ō': 'ou',
    }))
    # The app presents the object particle as "o" while dictionary romanizers
    # commonly emit the literal kana spelling "wo".
    normalized = normalized.replace('wo', 'o')
    return re.sub(r'[^a-z]', '', normalized)


def romanize_reading(reading: str) -> str | None:
    """Romanize a Jisho kana reading with the project's installed romanizer."""
    if jaconv is None:
        return None
    romanized = jaconv.kata2alphabet(jaconv.hira2kata(reading)).lower()
    # jaconv can preserve a katakana long-vowel mark as a dash.
    for vowel in 'aeiou':
        romanized = romanized.replace(vowel + '-', vowel * 2)
    return normalize_romaji(romanized)


def fetch_jisho(phrase: str, cache: dict) -> dict:
    if phrase in cache:
        return cache[phrase]
    url = f"{JISHO_API}?keyword={urllib.parse.quote(phrase)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'japanese-tutor-verifier/1.0'})
    # Retry on 429 with exponential backoff
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            cache[phrase] = data
            time.sleep(0.25)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                wait = 2 ** attempt
                print(f"  rate-limited, sleeping {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            cache[phrase] = {'error': f'HTTP {e.code}'}
            return cache[phrase]
        except Exception as e:
            cache[phrase] = {'error': str(e)}
            time.sleep(0.25)
            return cache[phrase]
    cache[phrase] = {'error': 'exhausted retries'}
    return cache[phrase]


def verify_phrase(phrase: str, romaji: str, cache: dict) -> dict:
    data = fetch_jisho(phrase, cache)
    if 'error' in data:
        return {'status': 'ERROR', 'reason': data['error'], 'candidates': []}
    if data.get('meta', {}).get('status') != 200 or not data.get('data'):
        return {'status': 'NOT_FOUND', 'reason': 'no jisho entries', 'candidates': []}

    # Look at the top candidates. A phrase is VERIFIED only if:
    #   1. At least one candidate has a sense with non-empty english_definitions, AND
    #   2. A real kana romanizer confirms the complete reading on file.
    candidates = []
    for entry in data['data'][:5]:
        readings = [r.get('reading', '') for r in entry.get('japanese', [])]
        word = entry.get('slug', '')
        senses = entry.get('senses', [])
        if not senses:
            continue
        first_def = senses[0].get('english_definitions', [])
        if not first_def:
            continue
        candidates.append({
            'word': word,
            'readings': readings,
            'first_def': first_def[0],
            'is_common': entry.get('is_common', False),
            'jlpt': entry.get('jlpt', []),
            'jmdict': entry.get('attribution', {}).get('jmdict', False),
        })

    if not candidates:
        return {'status': 'NO_DEFINITION', 'reason': 'all candidates had no definitions', 'candidates': []}

    if jaconv is None:
        return {
            'status': 'READING_UNVERIFIED',
            'reason': 'jaconv is not installed; run npm run setup:romanizer before verification',
            'candidates': candidates[:3],
        }

    expected = normalize_romaji(romaji)
    partial_match = False
    for c in candidates:
        for reading in c['readings']:
            actual = romanize_reading(reading)
            if actual == expected:
                return {'status': 'VERIFIED', 'reason': '', 'candidates': candidates[:3]}
            if actual and expected and (expected in actual or actual in expected):
                partial_match = True

    if partial_match:
        return {
            'status': 'READING_PARTIAL_MATCH',
            'reason': f'romaji "{romaji}" only partially matches a dictionary reading',
            'candidates': candidates[:3],
        }
    return {'status': 'ROMAJI_MISMATCH', 'reason': f'romaji "{romaji}" does not match any romanized reading', 'candidates': candidates[:3]}


def main():
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    if CACHE_PATH.exists():
        cache = json.loads(CACHE_PATH.read_text(encoding='utf-8'))
    else:
        cache = {}

    all_phrases = []
    for f in DATA_FILES:
        path = ROOT / f
        text = path.read_text(encoding='utf-8')
        for m in PHRASE_RE.finditer(text):
            japanese, romaji, status = m.group(1), m.group(2), m.group(3)
            all_phrases.append({
                'file': f,
                'japanese': japanese,
                'romaji': romaji,
                'status': status,
                'context': text[max(0, m.start()-40):m.end()+20].replace('\n', ' ')[:120],
            })

    print(f"Found {len(all_phrases)} phrases across {len(DATA_FILES)} files")
    print(f"Cache: {len(cache)} prior entries")
    print()

    results = []
    # Parallel fetch — Jisho handles burst traffic fine for our volume.
    from concurrent.futures import ThreadPoolExecutor, as_completed
    with ThreadPoolExecutor(max_workers=2) as ex:
        futures = {ex.submit(verify_phrase, p['japanese'], p['romaji'], cache): p for p in all_phrases}
        for i, fut in enumerate(as_completed(futures), 1):
            p = futures[fut]
            v = fut.result()
            results.append({**p, **v})
            if i % 25 == 0:
                print(f"  [{i}/{len(all_phrases)}] cache={len(cache)}", file=sys.stderr)

    # Persist cache
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding='utf-8')

    # Summary
    by_status = {}
    for r in results:
        by_status.setdefault(r['status'], []).append(r)

    print()
    print("=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    for s, items in sorted(by_status.items()):
        print(f"  {s:25s} {len(items):4d}")
    print(f"  {'TOTAL':25s} {len(results):4d}")
    print()

    needs_review_statuses = {
        'NOT_FOUND', 'NO_DEFINITION', 'ROMAJI_MISMATCH', 'READING_PARTIAL_MATCH',
        'READING_UNVERIFIED', 'ERROR',
    }
    needs_review = [r for r in results if r['status'] in needs_review_statuses]
    if needs_review:
        print("PHRASES NEEDING HUMAN REVIEW:")
        print("-" * 60)
        for r in needs_review:
            cands = r.get('candidates', [])
            cands_str = ''
            if cands:
                c0 = cands[0]
                cands_str = f" | closest: {c0.get('word','?')} ({c0.get('first_def','?')[:40]})"
            print(f"  [{r['status']:18s}] {r['japanese']:20s} {r['romaji']:30s}{cands_str}")
        print()

    # Build markdown report
    lines = [
        '# Translation Verification Report',
        '',
        f'Generated by `scripts/verify-japanese-phrases.py` against Jisho.org (JMDICT).',
        '',
        f'**Total phrases checked:** {len(results)}',
        '',
        '## Summary',
        '',
        '| Status | Count | Meaning |',
        '|---|---|---|',
    ]
    meaning = {
        'VERIFIED': 'Exact match in JMDICT, romaji matches reading',
        'READING_PARTIAL_MATCH': 'Romanized reading only partially matches; human review required',
        'READING_UNVERIFIED': 'Local kana romanizer unavailable; human review required',
        'NOT_FOUND': 'Phrase not in Jisho (could be grammar-pattern example, not a word)',
        'NO_DEFINITION': 'Found entries but no definitions',
        'ROMAJI_MISMATCH': 'Phrase exists but romaji on file does not match any reading',
        'ERROR': 'API error (rate limit or network)',
    }
    for s, items in sorted(by_status.items(), key=lambda x: -len(x[1])):
        lines.append(f'| {s} | {len(items)} | {meaning.get(s, "")} |')

    lines += ['', '## Phrases needing human review', '',
      '_Only exact, romanizer-confirmed reading matches pass automatically. All other results appear here._', '']
    if not needs_review:
        lines.append('_None — all phrases verified._')
    else:
        for r in needs_review:
            lines.append(f"### `{r['japanese']}` ({r['romaji']})")
            lines.append(f"- **File:** `{r['file']}`")
            lines.append(f"- **Status:** {r['status']}")
            lines.append(f"- **Reason:** {r.get('reason', '')}")
            cands = r.get('candidates', [])
            if cands:
                lines.append('- **Closest Jisho matches:**')
                for c in cands[:3]:
                    lines.append(f"  - `{c.get('word','')}` ({', '.join(c.get('readings', []))}) — {c.get('first_def','')[:80]}")
            lines.append('')

    REPORT_PATH.write_text('\n'.join(lines), encoding='utf-8')
    print(f"Full report: {REPORT_PATH}")
    print(f"Cache:       {CACHE_PATH}")
    return 0 if not needs_review else 1


if __name__ == '__main__':
    sys.exit(main())
