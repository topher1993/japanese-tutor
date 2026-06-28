# Phase 16B — Week 2 Content Expansion

## Verdict

GO — completed and validated.

## Owner

Igris, Engineering Director

## Purpose

Expand the Japanese Tutor beta from a minimal Week 1 sample into a stronger workplace-survival beginner pack while beta tester feedback is still pending.

This phase intentionally avoided backend/API changes and kept feedback local-only.

## Added content

### Week 2 lessons

Added five N5 workplace-survival lessons:

1. Workplace Requests and Clarifying Instructions
2. Schedule, Time, and Shift Questions
3. Tools, Equipment, and Broken Items
4. Health, Safety Problems, and Supervisor Help
5. Simple Polite Conversation at Work

Each lesson includes multilingual learner content:

- Japanese
- Romaji
- English
- Vietnamese
- Filipino/Tagalog
- Japanese example sentence
- English example sentence

### Survival phrases

Expanded workplace survival phrases from 18 to 50 entries.

Covered categories:

- Greetings
- Asking for Help
- Safety Instructions
- Schedule and Time
- Tools and Equipment
- Break Time
- Absence and Tardiness
- Health and Body
- Directions and Places
- Polite Basics
- Emergency Phrases

### Quiz

Expanded the quick quiz from 3 questions to 15 questions.

Question coverage now includes:

- greetings
- polite phrases
- help/clarification
- safety commands
- fire/emergency reporting
- break/schedule questions
- overtime
- broken equipment
- gloves/PPE
- health/sickness
- supervisor help
- directions/exit
- confirmation phrases

## Files changed

- `src/data/mockSenseiLessons.ts`
- `src/data/workplaceSurvivalPhrases.ts`
- `src/data/quizzes.ts`
- `src/types/workplaceSurvival.ts`
- `tests/phase16bContentExpansion.test.ts`

## TDD proof

RED test first:

```text
Phase 16B test failed because:
- Week 2 lessons: expected 5, received 0
- Survival phrases: expected >= 40, received 18
- Quiz questions: expected >= 15, received 3
```

GREEN after implementation:

```text
✓ tests/phase16bContentExpansion.test.ts (3 tests)
```

## Full validation

```text
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-web-phase16b-content --clear
npx expo install --check
npx expo-doctor@latest
```

Results:

```text
Typecheck: passed
Test files: 17 passed
Tests: 60 passed
Export: dist-web-phase16b-content generated
Expo dependencies: up to date
Expo Doctor: 18/18 checks passed
```

## Visual/browser smoke

Static export opened successfully.

Confirmed visible app content:

- Lessons screen contains Week 2 lesson titles, including:
  - `Workplace Requests and Clarifying Instructions`
  - `Simple Polite Conversation at Work`
- Quiz screen shows:
  - `Question 1 of 15`
- Workplace Survival screen shows new categories:
  - `Health and Body`
  - `Directions and Places`
  - `Polite Basics`

## Beta status impact

Current beta remains stable.

Phase 16B does not change:

- Expo SDK 54 target
- Expo Go testing path
- local-only feedback behavior
- bottom navigation structure
- backend/API posture

## Next decision

If beta feedback reports blockers or important issues:

```text
Phase 16A — Broader Beta Polish Sprint
```

If beta feedback is clean:

```text
Phase 17 — Review System / Spaced Repetition
```

Optional later spike:

```text
Japanese learning API feasibility review
```
