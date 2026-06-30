# Phase 34 — Strict Helper-Language Visibility

## Verdict

**PASS** — GPT-5.5/Tusk re-check found no unresolved P0/P1 blockers.

## User rule

If a learner selects a helper language, learner-facing app screens must show only:

1. the selected helper language translation, and
2. English fallback/support text.

Example: Vietnamese mode may show Vietnamese + English, but must not show Filipino/Tagalog/TL anywhere in normal learner flow.

## Implemented

- Added `tests/phase34StrictHelperLanguageVisibility.test.ts`.
- Replaced raw `VI:` / `TL:` rendering in `src/screens/LessonsScreen.tsx` with centralized `getVisibleTranslations(item, supportLanguage)`.
- Replaced raw `VI:` / `TL:` rendering in `src/screens/DailyLessonScreen.tsx` with centralized `getVisibleTranslations(item, supportLanguage)`.
- Added a `supportLanguage` prop to `DailyLessonScreen` so future routing can preserve the same rule.
- Extended strict source checks to include normal learner Settings.
- Hid reviewer tools from normal learner Settings by default.
- Gated Sensei translation review behind explicit dev reviewer mode: `?reviewer=1`.
- Normal `?screen=review` now falls back to Home and does not expose raw VI/TL review content.

## Final verification

| Check | Result |
|---|---|
| Focused strict/reset tests | PASS — 19/19 |
| Full typecheck | PASS |
| Full test suite | PASS — 76 files / 563 tests |
| Graphify update | PASS — 2208 nodes / 3426 edges |
| Live iOS bundle | PASS — HTTP 200, 9,077,210 bytes |
| Vietnamese lesson-detail browser smoke | PASS — Vietnamese + English only; no Filipino/Tagalog/TL |
| Filipino lesson-detail browser smoke | PASS — Filipino/Tagalog + English only; no Vietnamese/VI |
| Normal Settings browser smoke | PASS — no Reviewer tools, no Open translation review, no VI/TL |
| Direct review route browser smoke | PASS — `?screen=review` without `reviewer=1` falls to Home |
| GPT-5.5/Tusk re-check | PASS — no P0/P1 |

## Tusk/GPT-5.5 final result

```text
Verdict: PASS
P0/P1 list: none
Prior P1s are closed.
```

## Notes

The Sensei translation review screen still shows English/VI/TL because it is a reviewer/dev tool, not normal learner flow. It is now gated behind explicit `?reviewer=1` so normal learners cannot reach it from Settings or direct `?screen=review`.
