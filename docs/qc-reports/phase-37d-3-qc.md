
session_id: 20260701_071622_bafc51
## On-disk verify: PASS
- `npx tsc --noEmit` exit 0
- Focused vitest: 43/43 (6+7+6+14+5+5) across all six files
- `npm test`: 637/637 pass across 87 files
- All 4 record* methods present in `practiceProgressStore.ts` (lines 31, 105, 212, 337)
- Single `recordKanjiGood` call site at `FlashcardsScreen.tsx:212`, nested inside the `isTodoFeatureEnabled() && store` guard opened at line 192

## Design invariants honored: PASS
1. Short-circuit pattern matches 37d-1/37d-2: gate-off L338, saveExtendedProgress missing L339, no weekPlan L341-342 → `practiceProgressStore.ts:338-342`
2. Intersection rule: `new Set(kanjiSetResolution.cardIds)` then `nextGood.filter(id => kanjiSet.has(id))` — `practiceProgressStore.ts:397-399`
3. De-dup correct: `priorGood.includes(kanjiCardId) ? priorGood : [...priorGood, kanjiCardId]` — `practiceProgressStore.ts:353-355`
4. Clamp + completedAt-on-first-cross match: `Math.min(progressCount, target)`, `reached = clamped >= target && target > 0`, `completedAt: reached ? (prior?.completedAt ?? Date.now()) : undefined` — `practiceProgressStore.ts:404-411`
5. Screen wiring gated by `card.kind === 'kanji'` only — `FlashcardsScreen.tsx:211`
6. kanji branch sits INSIDE the same `isTodoFeatureEnabled() && store` guard, not a sibling — `FlashcardsScreen.tsx:192,211-213`
7. No regression: 637/637 includes 37d-1 (6) + 37d-2 (7) + 37d-3 (6) focused suites; completeCurrentLesson / recordDailyRushComplete / recordFlashcardReview all behaviorally intact (prior QC trusted for the first three)

## Existing methods preserved: PASS
`completeCurrentLesson` (L31), `recordDailyRushComplete` (L105), `recordFlashcardReview` (L212), `recordKanjiGood` (L337) — all 4 record* methods present in the rewritten store.

## New P0/P1 issues
None.

Minor note (informational, not a blocker): `markGoodAndAdvance` calls `recordFlashcardReview` for ALL card kinds (37d-2 behavior unchanged), then additionally calls `recordKanjiGood` only for kanji. This means a kanji card bumps both the flashcards-pool todo and the kanji todo — correct per §5 because kanji cards live in both pools. The "only on kind === 'kanji'" wording in the brief refers to the additive kanji call, which is honored at L211.

## QC verdict: PASS

## Recommendation: ship 37d-3
