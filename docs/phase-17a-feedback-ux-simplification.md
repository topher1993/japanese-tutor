# Phase 17A — Feedback UX Simplification

## Owner

Igris — Engineering Division

## Goal

Make beta feedback friendly for learner testers while preserving useful triage data for Belion, Igris, and the beta polish queue.

## Decision

The old feedback flow exposed too many internal concepts to testers:

```text
screen
severity
category
rating
note
```

That was useful for engineering triage but too complex for casual learners.

Phase 17A changes the default feedback flow to simple language first.

## New default learner flow

The tester now starts with:

```text
What do you want to tell us?
```

Options:

```text
Report a problem
Confusing / hard to use
Translation or Japanese issue
Suggestion / idea
```

Then they choose:

```text
Where did it happen?
What happened?
Optional rating
```

## Internal mapping

The app still stores triage metadata automatically.

### Report a problem

If tester says it stopped them from using the app:

```text
Severity: Blocker
Category: Bug
```

If not:

```text
Severity: Important
Category: Bug
```

### Confusing / hard to use

```text
Severity: Important
Category: Learning flow
```

### Translation or Japanese issue

```text
Severity: Important
Category: Content
```

### Suggestion / idea

```text
Severity: Minor
Category: UI polish
```

## Advanced mode

Developer testers can still open:

```text
Advanced details for developer testers
```

This exposes manual severity and category controls.

## Files changed

```text
src/types/betaFeedback.ts
src/services/simpleFeedbackUxService.ts
src/services/betaFeedbackService.ts
src/services/betaFeedbackTriageService.ts
src/services/broaderBetaTrialService.ts
src/services/internalBetaLaunchService.ts
src/screens/BetaFeedbackScreen.tsx
tests/phase17aFeedbackUxSimplification.test.ts
tests/phase11InternalBetaLaunch.test.ts
tests/phase15bBroaderBetaTrial.test.ts
docs/beta/internal-beta-feedback-workflow.md
docs/beta/broader-beta-trial-1-tester-instructions.md
docs/phase-17a-feedback-ux-simplification.md
```

## TDD validation

RED test added first:

```text
tests/phase17aFeedbackUxSimplification.test.ts
```

Initial failure:

```text
Cannot find module '../src/services/simpleFeedbackUxService'
```

Then implementation was added and the focused test passed.

## Browser smoke

Verified in exported web preview:

- Stats / Progress opens Beta Feedback.
- Feedback screen starts with four simple choices.
- “Translation or Japanese issue” maps to `Important / Content`.
- Saving sample feedback wrote local storage with:

```json
{
  "screen": "Lessons",
  "rating": 4,
  "note": "Sample smoke test: translation wording seems unclear.",
  "createdAt": "2026-06-19",
  "severity": "important",
  "category": "content",
  "feedbackType": "translation"
}
```

- Feedback Summary updated to `Entries: 1`.
- Polish Queue updated to `Important: 1`.

## Result

The feedback algorithm remains useful internally, but the tester-facing UX is now much simpler.
