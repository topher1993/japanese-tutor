# Phase 36 — Beta Scale Readiness Checklist

Date: 2026-06-30
Project: Japanese Tutor mobile app
Owner split: Belion coordinates, Igris implements, Sensei/Beru owns language/content correctness, Tusk verifies P0/P1 readiness.

## Current recommendation

Do not scale by adding more raw flashcards or lessons yet. The app already has enough learner material for beta. Scale the experience, reliability, content gates, and progress clarity first.

## Must-pass before broader beta

### 1. Learner smoke run

Core paths to open on web/phone:

- Onboarding
- Home
- Lessons
- Daily Lesson
- Flashcards
- Daily Flashcard Rush
- Quiz/Test
- Review Mode
- Progress/Profile
- Settings reset
- Helper-language modes: English, Vietnamese, Filipino/Tagalog

Pass criteria:

- no blank screens
- no JS console errors
- no learner-visible `(pending ...)` helper text
- tabs are accessible before completing a daily task
- Daily Rush shows 10 cards, 10 seconds per card, and one `Again` per timeout
- Progress title shows real lesson total, not `0 of 0 lessons done`

### 2. Content quality gates

Automated gates now live in:

- `tests/phase36ScaleReadinessContentGates.test.ts`

They block:

- duplicate lesson IDs
- incomplete lesson Japanese/romaji/English/example fields
- learner-visible pending helper translations
- duplicate flashcard IDs
- duplicate Daily Rush visible choices
- quiz questions with duplicate choices or missing correct answer
- Review Mode items with duplicate choices or invalid correct index
- kanji cards without meanings/examples

### 3. App guidance / progress clarity

Automated UX gate now lives in:

- `tests/phase36ScaleReadinessUx.test.ts`

Home now needs to keep a visible `Today's focus` block with:

- next action
- daily plan cue
- lesson progress count
- Daily Rush cue

Progress must show the real bundled lesson total on fresh start.

### 4. Profile-driven personalization — next phase

Recommended next implementation target after current gates:

- use JLPT target, daily minutes, and study goal to shape Home recommendations
- use weak areas / due cards to prioritize Daily Rush
- show next milestone on Progress/Home
- separate beginner/workplace/daily-life recommendations

### 5. Account/login decision

Current app remains local-only. Do not add login casually.

Recommended beta stance:

- stay local-only for near-term beta polish
- keep profile/progress data shaped so cloud sync can be added later
- treat login/cloud sync as a separate architecture phase

### 6. Analytics/crash visibility — before many external testers

Before broad beta, choose and add:

- crash reporting
- basic screen/event analytics
- Daily Rush completion event
- lesson completion event
- reset event
- feedback/report flow

### 7. Release hygiene

Before committing/releasing:

- keep Graphify/generated artifacts either intentionally committed or ignored
- do not commit temporary scripts/tests
- keep content docs in `docs/`, never Desktop
- run focused tests, typecheck, full suite
- rebuild Graphify
- run GPT-5.5/Tusk QC for P0/P1 blockers

## Latest smoke finding fixed in this phase

Smoke found Progress displayed `0 of 0 lessons done` on web fresh start. Root cause: the in-memory repository had no saved lesson catalog, so `PracticeProgressStore.getDashboard()` built against an empty lessons array. Fix: `practiceProgressStore` falls back to bundled `getAllLessons()` when the repository has no lesson catalog.

## Latest content blockers fixed in this phase

The new content gates found real invalid practice choices:

1. Candidate quiz item `quiz-0104` had four identical choices (`五人`) and was marked approved. The quiz adapter now filters approved candidate questions to app-ready rows with four unique visible choices and a valid correct choice.
2. Review Mode had duplicate visible choices for at least `candidate-review-n4-vocab-0038`. The review adapter now selects distractors by normalized unique English choice text.
