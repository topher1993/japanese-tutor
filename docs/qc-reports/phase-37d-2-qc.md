
session_id: 20260701_070455_91b8f9
Everything cross-checks. Both call sites in DailyRushScreen guarded + record via `practiceStore`; FlashcardsScreen call at `markGoodAndAdvance`. 3-todo plan + flashcards todo with `target: 0`. `kind?: 'vocab' | 'kanji'` optional. Both construction sites backfill `'vocab'`. Belion-fix destructure `{ plan, todo, poolSize }` confirmed at lines 164 + 205. 37b tests 4 + 7 use `resolveCardPool` (lines 115, 214) — `flashcardTodo.target` no longer hardcoded.

## On-disk verify: PASS
- `npx tsc --noEmit` exit 0
- Targeted 5 files: 37/37 (7+14+6+5+5 exact)
- `npm test`: 631/631 in 5.36s, 86 files
- `grep expo-sqlite` in FlashcardsScreen.tsx + DailyRushScreen.tsx: 0 matches

## Belion-fix verified: PASS
- `tests/phase37d2FlashcardsKind.test.ts:164,205` now destructure `{ plan, todo, poolSize } = flashcardsTodoForWeek1()` (helper in test module).
- `tests/phase37bLessonKind.test.ts:115,214` replaced `flashcardTodo.target` with `resolveCardPool(flashcardTodo.pool ?? 'week', 1).cardIds.length`; tests 4 + 7 carry the 3-todo plan shape with `totalCount=3`.

## Flashcards kind wiring: PASS
- De-dup: `practiceProgressStore.ts:228-230` — `priorReviewed.includes(cardId) ? priorReviewed : [...priorReviewed, cardId]` (test d covers triple-review).
- Persist: `:303-308` — `saveExtendedProgress` writes `nextTodoStates`, `weekTodosInitialized[weekNumber]=true`, `nextEventCounts.flashcardReviews[weekNumber]`.
- Recompute: `:267-288` filters `todo.kind === 'flashcards'`, intersects reviewed ∩ `resolveCardPool(...).cardIds`, clamps to target (resolves target=0 via `pool.expectedTarget`).
- Gate guard: `FlashcardsScreen.tsx:192` and `DailyRushScreen.tsx:147` both `if (isTodoFeatureEnabled() && store/practiceStore)`; 37c LessonsScreen gate unchanged.
- Wiring uses option B (call-site after `answerFlashcard`), not inside the service.

## 37b test shape updates: PASS
- Test 4 (line 104-145): 3 todos completed, `resolveCardPool` for flashcards target, asserts `completedCount=3, totalCount=3, allDone=true`.
- Test 7 (line 189-252): fullPayload seeds all 3 todos complete via resolver-computed pool size, asserts `isWeekUnlocked(2, …) === true`.
- Test 3 (line 79-102): partial state asserts `totalCount=3`.

## New P0/P1 issues
None. Code is consistent with 37d-1 pattern (same call-site guard, same save shape, same option B wiring).

## QC verdict: PASS

## Recommendation: ship 37d-2
