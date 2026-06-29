# N4 Lesson Polish QC

## Verdict

**PASS**

**Unresolved P0/P1:** none.

## Scope

- Fixed N4 learner-facing `japanese` and `exampleJapanese` fields in `src/data/mockSenseiLessons.ts` so they use Japanese script instead of romaji.
- Preserved romanized `romaji` fields for beginner reading support.
- Corrected selected Sensei content/romaji issues:
  - `漢字が読めます` / `kanji ga yomemasu`
  - `伝言をお願いできますか` / `dengon o onegai dekimasu ka`
  - `一日休みたいです` / `ichinichi yasumitai desu`
  - Potential-form summary no longer calls `taberu` a u-verb.
- Resolved duplicate N4 deck Japanese values by making N4 cards more specific than beginner versions.
- Added regression tests in `tests/n4LessonContentPolish.test.ts`.
- Disabled the old Phase 31 generator because it can regenerate romaji-only learner-facing Japanese fields.

## Validation evidence

- `npm run typecheck` → **passed**.
- Focused tests:
  - `tests/n4LessonContentPolish.test.ts`
  - `tests/phase31N4Lessons.test.ts`
  - `tests/translationCoverage.test.ts`
  - Result: **3 files / 13 tests passed**.
- Full suite: `npm test` → **72 files / 548 tests passed**.
- N4 content audit script:
  - N4 lessons: **18**
  - N4 items: **100**
  - N4 Japanese/example fields lacking script: **0**
  - N4 romaji fields containing Japanese script: **0**
  - N4 duplicate Japanese values: **0**
- GPT-5.5 reachability probe: `hermes -m gpt-5.5 -z "REACHABLE"` → `REACHABLE`.
- Tusk/GPT-5.5 narrow QC verdict: **PASS**, unresolved P0/P1: none.

## Notes

Translations remain marked `draft`; this polish only fixes learner-facing Japanese script and guards against regenerating the old romaji-only N4 fields.
