# Phase 35 Learning Materials Wiring QC

## Scope

Wired the remaining available learning material pools into active app practice surfaces:

- Test tab / `quizService`
  - `getQuickQuiz()` now returns the starter quiz plus approved candidate quiz questions.
  - Candidate quiz entries are adapted into the app `QuizQuestion` type.
  - Current active test question pool: 15 starter + 351 candidate = 366 questions.

- Review Mode / `reviewModeService`
  - Review Mode now builds sessions from approved N5/N4 vocabulary candidates.
  - Current review pool: 1,130 vocabulary items.
  - Level chips still filter sessions: N5 uses N5 candidates; N4 includes N5+N4 for cumulative review.

- Daily Flashcard Rush / `DailyRushScreen`
  - Daily Rush now loads the full flashcard material pool: base lesson cards plus approved candidate vocabulary cards.
  - Fallback remains safe: if candidate loading fails, the base lesson deck is still usable.

- Test stability
  - Extended `phase27MetroWasmExportConfig.test.ts` timeout to 15s because the full suite repeatedly showed this Metro config require taking >5s under parallel load, while the focused test passed.

## TDD evidence

RED:
- `npm test -- tests/phase35LearningMaterialsWiring.test.ts` failed before implementation:
  - Test quiz had only 15 questions.
  - Review Mode had only 24 hardcoded items instead of the 1,130 candidate pool.
  - Daily Rush did not load candidate flashcards.

GREEN:
- Focused tests passed:
  - `tests/phase35LearningMaterialsWiring.test.ts`
  - `tests/quizService.test.ts`
  - `tests/phase20fReviewMode.test.ts`
  - `tests/phase32DailyRushProfileKanji.test.ts`
  - `tests/phase27MetroWasmExportConfig.test.ts`
  - 5 files / 21 tests passed.

Full verification:
- `npm run typecheck` passed.
- `npm test` passed:
  - 74 files
  - 554 tests

Graphify:
- Rebuilt before final QC:
  - 2,174 nodes
  - 3,373 edges
  - 172 communities

## Tusk / GPT-5.5 QC

**PASS** — no unresolved P0/P1 blockers.

Evidence from QC:
- `src/services/quizService.ts`: Successfully integrates `buildCandidateQuizQuestions`, ensuring candidate quiz content is included.
- `src/services/candidateQuizAdapter.ts`: Correctly filters `approved-for-beta` quiz questions and adapts them to the `QuizQuestion` format.
- `src/services/candidateReviewAdapter.ts`: Retrieves both N5 and N4 vocabulary, filtering for `approved-for-beta` status, and properly builds `ReviewItem`s.
- `src/services/reviewModeService.ts`: Consumes `buildCandidateReviewItems` as expected, indicating correct data flow for review mode.
- `src/screens/DailyRushScreen.tsx`: Demonstrates explicit import and integration of `buildCandidateFlashcardCards` into the flashcard deck, which is crucial for including new learning materials in the Daily Rush UI.
- `tests/phase35LearningMaterialsWiring.test.ts`: This dedicated test suite directly addresses the "learning materials wiring" task. It includes assertions for candidate quiz questions, candidate review items, and checks for the inclusion of `buildCandidateFlashcardCards` in `DailyRushScreen.tsx`. This provides good coverage for the specified wiring.
- `tests/phase27MetroWasmExportConfig.test.ts`: This file is unrelated to the current QC task and has no bearing on the learning materials wiring.