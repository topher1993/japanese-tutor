
session_id: 20260701_073447_e8a3c4
650/650. All on-disk verifies pass. Now write the QC report.

## On-disk verify: PASS
- npx tsc --noEmit: exit 0
- focused vitest: 56/56 pass (37d-5:7, 37d-4:6, 37d-3:6, 37d-2:7, 37d-1:6, 37b:14, 37c:5, 37a:5)
- npm test: 650/650 pass (89 files)

## Design invariants honored: PASS
1. Short-circuit pattern — PASS: practiceProgressStore.ts:587 (gate-off), :588 (saveExtendedProgress missing), :591 (no weekPlan) — all early-return repo.getProgress(), mirrors 37d-1..4.
2. De-dup — PASS: practiceProgressStore.ts:602-604 re-viewing same sentenceId yields priorViewed unchanged (test: "re-viewing same sentenceId does not double-count").
3. Clamp + completedAt-on-first-cross — PASS: practiceProgressStore.ts:649 (Math.min clamp), :656 (completedAt set on reached, preserved if already set via ?? Date.now()). Matches 37d-1..4 semantics.
4. Screen wiring INSIDE guard — PASS: ExampleSentencesScreen.tsx:110 `if (!isTodoFeatureEnabled() || !practiceStore) return;` wraps the sole markExampleViewed call at :118.
5. Debounce — PASS: exampleSentencesViewTracking.ts:17 EXAMPLE_VIEW_DEBOUNCE_MS=2000ms; test "5 calls in 100ms with same id yields 0 reports" passes (filter at :35: `last != null && now - last < EXAMPLE_VIEW_DEBOUNCE_MS`).
6. Pure-helper .ts extraction — PASS: exampleSentencesViewTracking.ts is dependency-free (no react-native imports); test imports it directly without dragging the .tsx module graph.
7. No regression of 5 sibling methods — PASS: completeCurrentLesson:31, recordDailyRushComplete:105, recordFlashcardReview:212, recordKanjiGood:337, recordQuizAttempt:465 all present; 650/650 full pass proves behavior intact.

## Existing methods preserved: PASS
6 record*/mark* methods present in practiceProgressStore.ts:
- completeCurrentLesson (line 31)
- recordDailyRushComplete (line 105)
- recordFlashcardReview (line 212)
- recordKanjiGood (line 337)
- recordQuizAttempt (line 465)
- markExampleViewed (line 586, new)

## New P0/P1 issues
None.

Minor nit (not blocking): practiceProgressStore.ts:648 progressCount = nextViewed.length counts ALL distinct viewed sentences, not intersection with a week's curated example set. Author's explicit choice (see comment :638-641) — caller is trusted. Acceptable for 37d-5; if 37e introduces per-week example-set whitelisting, revisit.

## QC verdict: PASS

## Recommendation: ship 37d-5

Files cited: src/services/practiceProgressStore.ts:586-682, src/screens/ExampleSentencesScreen.tsx:82-125, src/screens/exampleSentencesViewTracking.ts:17-40, tests/phase37d5ExampleSentencesKind.test.ts (7 tests).
