
session_id: 20260701_072441_c2ef6a
Everything checks out. Max-merge at L482-483, threshold=70 at L523, completedAt-on-first-cross at L531 (uses `prior?.completedAt ?? Date.now()` — first cross sets it, subsequent preserves the original timestamp).

## On-disk verify: PASS
- `npx tsc --noEmit` exit 0
- Focused suite: 49/49 (37d4:6, 37d3:6, 37d2:7, 37d1:6, 37b:14, 37c:5, 37a:5)
- `npm test`: 643/643 across 88 files, 5.45s

## Design invariants honored: PASS
1. PASS — max-merge at `practiceProgressStore.ts:483` (`Math.max(priorBest, score)`); test b confirms higher replaces lower (85→60 stays 85) and lower does not replace higher.
2. PASS — `passThreshold = 70` at `practiceProgressStore.ts:523`; tests c (69→no complete) and d (70→complete) confirm.
3. PASS — below-threshold sets `progress: 0` and `completedAt: undefined` at L525,531; test c asserts `completedAt` undefined.
4. PASS — at-threshold sets `progress: min(1,target)` and `completedAt: prior?.completedAt ?? Date.now()` at L525,531; test d asserts `completedAt` is a number.
5. PASS — clamp `Math.min(1, target)` at L525 + first-cross `prior?.completedAt ?? Date.now()` at L531 — same pattern as 37d-1/37d-2/37d-3.
6. PASS — `QuizScreen.tsx:61` guards `if (!isTodoFeatureEnabled() || !practiceStore) return;` before L75 call.
7. PASS — fingerprint `${result.score}:${result.total}` at L57, state-held `quizRecordedFingerprint` at L52; same value → early-return at L60; distinct → re-fire.
8. PASS — all 5 record* intact: `completeCurrentLesson` (L31), `recordDailyRushComplete` (L105), `recordFlashcardReview` (L212), `recordKanjiGood` (L337), `recordQuizAttempt` (L465). 49/49 + 643/643 prove no regression.

## Existing methods preserved: PASS
- completeCurrentLesson, recordDailyRushComplete, recordFlashcardReview, recordKanjiGood, recordQuizAttempt — all five present and behaviorally intact (49 focused + 643 full green).

## New P0/P1 issues
None. One optional nit (not blocking): `passThreshold` is a local const at L523; if `WeekTodo.passThreshold` is added later, the call sites and tests will need a small update. Comment at L523 already calls this out.

## QC verdict: PASS

## Recommendation: ship 37d-4 — proceed to 37d-5

Word count: ~380.
