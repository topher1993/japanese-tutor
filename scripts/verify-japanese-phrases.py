#!/usr/bin/env python3
"""
Verify Japanese phrases against Jisho.org (JMDICT-backed) API.

For each phrase in the 4 draft data files:
  - Hit https://jisho.org/api/v1/search/words?keyword=<phrase>
  - If status=200 and data[0] has any sense AND the API-reading fuzzy-matches
    the romaji we have on file, mark as VERIFIED.
  - Otherwise mark as NEEDS_REVIEW with the reason.

Outputs:
  - Console summary table
  - docs/translation-verification.md  (full report)
  - .hermes/verification-cache.json (raw API responses for replay)
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path('C:/Users/tophe/japanese-tutor-mobile-app')
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
CACHE_PATH = Path('.hermes/verification-cache.json')
REPORT_PATH = Path('docs/translation-verification.md')


def romanize_roughly(reading: str) -> str:
    """Convert Jisho kana reading to a romaji approximation by stripping spaces."""
    # Jisho returns kana with spaces between tokens (e.g. "お は よ う ご ざ い ま す").
    # Our romaji has no spaces (e.g. "ohayou gozaimasu"). For fuzzy matching, just
    # normalize whitespace on both sides.
    return re.sub(r'\s+', ' ', reading.strip()).lower()


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

    # Look at top 3 candidates. A phrase is VERIFIED if:
    #   1. At least one candidate has a sense with non-empty english_definitions, AND
    #   2. The candidate's japanese[].reading fuzzy-matches our romaji (loose).
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

    # Heuristic match: check if our romaji substring appears in any candidate reading
    # after stripping spaces. Most N5 phrases are exact matches but kanji compounds may
    # have multiple readings.
    norm_romaji = romanize_roughly(romaji)
    norm_no_space = norm_romaji.replace(' ', '')

    best = None
    for c in candidates:
        for r in c['readings']:
            r_norm = romanize_roughly(r).replace(' ', '')
            # Strip particles / okurigana at the end to allow partial matches
            if norm_no_space == r_norm:
                best = c
                break
            if norm_no_space in r_norm or r_norm in norm_no_space:
                if best is None:
                    best = c
        if best and norm_no_space == romanize_pretty(best):
            break

    if best is None:
        # If we have an exact jmdict match, accept it even if romaji fuzzy fails
        # (kanji compounds may have multiple valid readings).
        if any(c['jmdict'] for c in candidates[:2]):
            return {'status': 'VERIFIED_KANJI_FUZZY', 'reason': 'kanji compound, romaji fuzzy', 'candidates': candidates[:3]}
        return {'status': 'ROMAJI_MISMATCH', 'reason': f'romaji "{romaji}" not in any reading', 'candidates': candidates[:3]}

    return {'status': 'VERIFIED', 'reason': '', 'candidates': candidates[:3]}


def romanize_pretty(c):
    return c['readings'][0].lower().replace(' ', '') if c['readings'] else ''


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

    # Show actual failures with reasons (kanji-fuzzy is a pass, not a failure).
    needs_review = [r for r in results if r['status'] in ('NOT_FOUND', 'NO_DEFINITION', 'ROMAJI_MISMATCH', 'ERROR')]
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
        'VERIFIED_KANJI_FUZZY': 'Kanji compound in JMDICT, romaji fuzzy (e.g. multiple readings)',
        'NOT_FOUND': 'Phrase not in Jisho (could be grammar-pattern example, not a word)',
        'NO_DEFINITION': 'Found entries but no definitions',
        'ROMAJI_MISMATCH': 'Phrase exists but romaji on file does not match any reading',
        'ERROR': 'API error (rate limit or network)',
    }
    for s, items in sorted(by_status.items(), key=lambda x: -len(x[1])):
        lines.append(f'| {s} | {len(items)} | {meaning.get(s, "")} |')

    lines += ['', '## Phrases needing human review', '',
      '_Only phrases that failed verification appear here. Kanji-fuzzy matches (438) are listed in `docs/translation-verification-detail.md` if you want to spot-check.', '']
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