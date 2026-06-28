# Phase 15B — Broader Beta Trial

## Owner
Igris — Engineering Division

## Status
Completed

## Verdict

```text
READY FOR LIMITED BROADER BETA
```

## Goal
Move from Chris/control-device internal beta into a small broader beta trial while keeping the risk bounded.

## Trial limits

```text
Trial name: Broader Beta Trial 1
Max testers: 5
Duration: 3 days
Runtime: Expo Go SDK 54
URL: exp://zujugea-anonymous-8081.exp.direct
Remote/local note: use the `exp.direct` URL for testers outside Chris's Wi-Fi; use `exp://192.168.10.109:8081` only for same-network local testing.
```

## Cohorts

1. Chris control device
2. 1-2 close testers
3. 2-3 additional learners/helpers

## Required screens

Each trial should cover:

- Onboarding
- Home
- Lessons
- Flashcards
- Lessons → Workplace / Workplace Survival
- Quiz
- Progress
- Beta Feedback

## Daily tester checklist

- Open app in Expo Go
- Complete or review onboarding
- Study one lesson or survival phrase set
- Try one quiz interaction
- Check Progress/Stats
- Save classified Beta Feedback
- Send screenshot for any blocker or important issue

## Feedback instructions

- Every tester must save at least one local Beta Feedback entry or send one screenshot/note.
- Classify each issue as Blocker, Important, or Minor.
- Classify each issue as UI polish, Content, Device layout, Learning flow, or Bug.
- Send screenshots immediately for blocker or important device-layout issues.

## Exit criteria

- 0 unresolved blockers
- No more than 2 unresolved important issues
- At least 3 testers complete one study session
- Every required screen has been opened by at least one tester
- No SDK compatibility errors on tester devices

## TDD evidence

Created failing test first:

```text
tests/phase15bBroaderBetaTrial.test.ts
```

Verified RED:

```text
Cannot find module '../src/services/broaderBetaTrialService'
```

Then implemented service and visible app checklist.

## Implementation

Added:

```text
src/services/broaderBetaTrialService.ts
tests/phase15bBroaderBetaTrial.test.ts
```

Updated:

```text
src/screens/ProgressScreen.tsx
```

The Progress/Stats screen now shows:

- Broader Beta Trial status
- tester limit
- trial duration
- SDK/runtime
- Expo URL
- daily checklist
- exit gate

## Validation

Passed:

```bash
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-web-phase15b-broader-beta --clear
npx expo install --check
npx expo-doctor@latest
```

Result:

```text
16 test files passed
57 tests passed
Expo Doctor: 18/18 checks passed
```

## Visual/browser smoke

Verified exported app:

1. Home renders.
2. Stats/Progress opens.
3. Broader Beta Trial card appears.
4. Top section shows status/testers/duration/SDK/URL.
5. Inner scroll exposes remaining checklist, exit gate, and Open beta feedback button.
6. Browser console shows no errors.

## Next phase options

### If broader beta finds blockers/important issues
Execute:

```text
Phase 16A — Broader Beta Polish Sprint
```

### If broader beta is clean
Execute:

```text
Phase 16B — Week 2 Content Expansion
```
