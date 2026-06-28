# Phase 14 — Beta Feedback Review + First Polish Sprint

## Owner
Igris — Engineering Division

## Status
Completed

## Goal
Convert classified beta feedback into an actionable first polish sprint so Chris/testers can see what should be fixed now vs queued for later.

## Trigger
Chris approved the Phase 12 safe-area polish and Phase 13 classified feedback intake, then requested Phase 14 execution.

## Scope
- Keep feedback local-only.
- Add fixed screen quick-pick options to reduce inconsistent tester labels.
- Add a first-polish-sprint planner from existing classified feedback.
- Show active sprint capacity and priority readiness guidance inside the Beta Feedback screen.
- Preserve Expo SDK 54 compatibility.

## TDD evidence
Created failing test first:

```text
tests/phase14BetaPolishSprint.test.ts
```

Verified RED:

```text
Cannot find module '../src/services/betaPolishSprintService'
```

Implemented minimal service and UI, then verified GREEN.

## Implementation

### New service
Added:

```text
src/services/betaPolishSprintService.ts
```

Provides:

- `betaFeedbackScreenOptions`
- `buildFirstPolishSprint()`
- `summarizeSprintReadiness()`

### Updated visible Beta Feedback screen
Updated:

```text
src/screens/BetaFeedbackScreen.tsx
```

Added:

- screen quick-pick chips:
  - Home
  - Lessons
  - Flashcards
  - Workplace Survival
  - Quiz
  - Progress
  - Beta Feedback
  - Onboarding
- First Polish Sprint card
- active sprint capacity
- readiness guidance
- active item status:
  - `ready-to-fix`
  - `ready-to-polish`
  - `queued-for-later`

## Validation
Passed:

```bash
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-web-phase14-polish-sprint --clear
npx expo install --check
npx expo-doctor@latest
```

Result:

```text
15 test files passed
54 tests passed
Expo Doctor: 18/18 checks passed
```

## Browser smoke
Verified exported web app:

1. Opened Home.
2. Opened Stats/Progress.
3. Opened Beta Feedback.
4. Confirmed screen quick-pick chips render.
5. Confirmed severity/category chips render.
6. Saved sample feedback:

```text
Severity: Important
Category: Device layout
Note: Phone status bar spacing check
```

7. Confirmed queue and sprint updated:

```text
Polish Queue
Important: 1
• Important / Device layout — Workplace Survival

First Polish Sprint
Polish 1 important issue before broad beta.
Active sprint capacity: 1/3
• ready-to-polish: Important / Device layout — Workplace Survival
```

## Current beta operating model
- Testers record local feedback.
- Severity/category classify the issue.
- Polish Queue counts total risk.
- First Polish Sprint shows which items should be fixed first.
- Broad beta should wait if blocker/important counts are high.

## Next recommended phase
Phase 15 — Week 2 Content Expansion or Broad Beta Trial

Decision point:

- If Chris/testers find more UI issues: execute another polish sprint.
- If feedback remains minor only: expand Week 2 content and begin broader beta trial.
