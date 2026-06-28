# Phase 13 — Beta Feedback Intake + Polish Queue

## Owner
Igris — Engineering Division

## Status
Completed

## Goal
Turn raw internal beta notes into classified feedback that can be prioritized during the beta cycle.

## Problem
Before Phase 13, the Beta Feedback screen could save local notes and ratings, but all issues were flat. It did not clearly distinguish:

- beta blockers
- important polish
- minor polish
- content expansion requests
- device-layout issues
- bugs

## Implementation

### New triage service
Added:

```text
src/services/betaFeedbackTriageService.ts
```

It provides:

- `feedbackSeverities`
- `feedbackCategories`
- `classifyBetaFeedbackEntry()`
- `buildFeedbackPolishQueue()`

### Updated feedback data model
Updated:

```text
src/types/betaFeedback.ts
src/services/betaFeedbackService.ts
```

Feedback entries can now include:

```text
severity: blocker | important | minor
category: ui-polish | content | device-layout | learning-flow | bug
```

Stored entries remain local-only through browser/local device storage.

### Updated visible Beta Feedback screen
Updated:

```text
src/screens/BetaFeedbackScreen.tsx
```

The screen now includes:

- severity chips: Blocker, Important, Minor
- category chips: UI polish, Content, Device layout, Learning flow, Bug
- rating selection
- note field
- local save button
- Feedback Summary
- Polish Queue counts
- next-action guidance
- top queued items

## TDD evidence
Added failing test first:

```text
tests/phase13BetaFeedbackTriage.test.ts
```

Verified RED:

```text
Cannot find module '../src/services/betaFeedbackTriageService'
```

Then implemented service/types/UI and verified GREEN.

## Validation
Passed:

```bash
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-web-phase13-feedback-triage --clear
npx expo install --check
npx expo-doctor@latest
```

Result:

```text
14 test files passed
51 tests passed
Expo Doctor: 18/18 checks passed
```

## Browser smoke
Verified exported web app flow:

1. Opened Progress.
2. Opened Beta Feedback.
3. Confirmed severity/category chips render.
4. Confirmed lower page sections render by scrolling the inner ScrollView.
5. Saved sample feedback:

```text
Severity: Important
Category: Device layout
Note: Title is near the phone status bar
```

6. Confirmed queue updated:

```text
Important: 1
• Important / Device layout — Workplace Survival
```

## Tester use
During beta, testers should classify each issue:

- Blocker: app cannot be used, crash, lesson cannot open, data loss
- Important: usability/layout issue that should be fixed soon
- Minor: polish request, wording preference, small spacing issue
- Content: missing phrase, unclear translation, lesson improvement
- Device layout: phone-specific spacing, clipping, status-bar/bottom-safe-area issue
- Learning flow: quiz/lesson/progress confusion
- Bug: broken behavior or runtime error

## Next recommended phase
Phase 14 — Beta Feedback Review + First Polish Sprint

Use the collected queue to fix the highest priority blocker/important issues first, then content/polish requests.
