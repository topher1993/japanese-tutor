# Phase 8 Real-Device Beta QA Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Move the Japanese Tutor Mobile App from engineering-local readiness to internal beta readiness by completing real-device QA, beta feedback plumbing, and a release candidate package.

**Architecture:** Phase 8 should not add large new product features. It should harden what already exists: run Expo Go/simulator QA, capture evidence, add a lightweight feedback model/service/screen if appropriate, and generate a beta release candidate checklist. The phase ends with a clear go/no-go verdict for internal learner beta.

**Tech Stack:** Expo React Native, TypeScript, Vitest, React Native Web export, Chrome headless screenshots, project-local markdown reports.

---

## Current Context

Phase 7 completed:

- persistent onboarding preference
- beta checklist service
- dependency audit decision service
- Phase 7 screenshots
- full validation: `npm run typecheck`, `npm test`, `npx expo export --platform web --output-dir dist-web-phase7`

Remaining Phase 7 blocker:

```text
Real-device Expo Go or simulator QA has not been performed yet.
```

Dependency status:

```text
moderate: 10
high: 0
critical: 0
```

Decision remains:

```text
Do not run npm audit fix --force.
```

Reason: dry-run would downgrade Expo to `expo@46.0.21`.

---

## Proposed Phase 8 Name

**Phase 8 — Real-Device Beta QA and Internal Release Candidate**

---

## Success Criteria

Phase 8 is complete when:

1. A real-device/simulator QA checklist exists and is filled with evidence.
2. At least one small mobile viewport and one larger mobile viewport are validated.
3. If Chris can provide/operate Expo Go, actual device observations are recorded.
4. If real-device execution is not available from Hermes, the blocker is explicitly marked as requiring Chris/manual device validation.
5. A beta feedback collection path exists.
6. All tests/typecheck/export pass.
7. Updated screenshots are captured.
8. A final internal beta go/no-go report is written.

---

## Files Likely to Change

Create:

- `docs/phase-8-work-card.md`
- `docs/device-qa/phase-8-device-qa-checklist.md`
- `docs/device-qa/phase-8-device-qa-results.md`
- `docs/internal-beta-release-candidate.md`
- `docs/phase-8-completion-report.md`
- `docs/screenshots/phase-8/00-ui-contact-sheet-phase-8.png`
- `tests/phase8BetaReleaseCandidate.test.ts`

Potentially create if adding lightweight feedback plumbing:

- `src/types/betaFeedback.ts`
- `src/services/betaFeedbackService.ts`
- `src/screens/BetaFeedbackScreen.tsx`

Potentially modify:

- `App.tsx`
- `src/types/navigation.ts`
- `docs/internal-beta-checklist.md`

---

## Task 1: Create Phase 8 Work Card

**Objective:** Establish official Igris-owned Phase 8 scope and protected-system boundaries.

**Files:**

- Create: `docs/phase-8-work-card.md`

**Steps:**

1. Create work card with:
   - phase title
   - scope
   - risk level Yellow
   - protected systems untouched
   - rollback plan
   - QA requirement
2. State that Phase 8 is not a production deployment.
3. State that no secrets/OAuth/cron/Google/Sensei automation may be touched.

**Verification:**

Run:

```bash
ls docs/phase-8-work-card.md
```

Expected: file exists.

---

## Task 2: Add Failing Phase 8 Tests

**Objective:** Use TDD before adding beta release candidate logic.

**Files:**

- Create: `tests/phase8BetaReleaseCandidate.test.ts`

**Test behaviors:**

1. Builds a device QA checklist containing:
   - Small Android 360x640
   - Standard mobile 390x844
   - Large mobile 430x932
   - Expo Go Android
   - iPhone simulator/physical iPhone
2. Produces a go/no-go verdict of `blocked` when real-device QA is missing.
3. Builds beta feedback prompts for testers.
4. Produces a release candidate summary with blockers/warnings separated.

**Expected RED:**

Run:

```bash
npm test -- tests/phase8BetaReleaseCandidate.test.ts
```

Expected failure:

```text
Cannot find module '../src/services/betaReleaseCandidateService'
```

---

## Task 3: Implement Beta Release Candidate Service

**Objective:** Add pure TypeScript service logic for beta QA and go/no-go decisions.

**Files:**

- Create: `src/services/betaReleaseCandidateService.ts`

**Implementation should export:**

- `buildPhase8DeviceQaChecklist()`
- `buildBetaFeedbackPrompts()`
- `evaluateInternalBetaReadiness(input)`
- `buildReleaseCandidateSummary(input)`

**Rules:**

- If real-device QA is missing, verdict must be `blocked`.
- If high/critical dependency findings exist, verdict must be `blocked`.
- Moderate dependency findings are warnings, not blockers, if documented.
- Web screenshot QA alone is not enough for learner beta.

**Verification:**

Run:

```bash
npm test -- tests/phase8BetaReleaseCandidate.test.ts
```

Expected: focused test passes.

---

## Task 4: Add Device QA Checklist Docs

**Objective:** Create the manual/real-device QA checklist Chris or Igris can fill.

**Files:**

- Create: `docs/device-qa/phase-8-device-qa-checklist.md`

**Checklist sections:**

- Install/run instructions
- Device matrix
- Onboarding checks
- Navigation checks
- Lessons checks
- Flashcards checks
- Workplace Survival checks
- Quiz checks
- Progress checks
- Accessibility/readability checks
- Pass/fail notes

**Important:** Include a clear field:

```text
Actual Expo Go / simulator device tested: yes/no
```

---

## Task 5: Decide Whether to Add In-App Feedback Screen

**Objective:** Keep Phase 8 practical; add feedback screen only if useful for beta.

**Recommended decision:** Add a lightweight local-only feedback screen/service if it can be done without backend/auth.

**If implemented, files:**

- Create: `src/types/betaFeedback.ts`
- Create: `src/services/betaFeedbackService.ts`
- Create: `src/screens/BetaFeedbackScreen.tsx`
- Modify: `src/types/navigation.ts`
- Modify: `App.tsx`
- Add tests in `tests/phase8BetaReleaseCandidate.test.ts`

**Constraints:**

- No backend.
- No network submission.
- No employee monitoring.
- No personal data collection beyond tester notes typed locally.
- Local-only export/copy model is acceptable.

**Alternative:** If too much for Phase 8, keep feedback as markdown prompts only.

---

## Task 6: Run Full Validation

**Objective:** Prove Phase 8 changes did not regress the app.

Run:

```bash
npm run typecheck
npm test
rm -rf dist-web-phase8
npx expo export --platform web --output-dir dist-web-phase8
```

Expected:

- TypeScript passes.
- All tests pass.
- Web export succeeds.

---

## Task 7: Capture Phase 8 Screenshots

**Objective:** Produce updated visual evidence.

**Files:**

- Create: `docs/screenshots/phase-8/*.png`
- Create: `docs/screenshots/phase-8/00-ui-contact-sheet-phase-8.png`

**Screens:**

- onboarding welcome
- onboarding language
- onboarding workplace goal
- onboarding daily habit
- Home
- Lessons
- Flashcards
- Workplace Survival
- Quiz
- Progress
- Feedback screen, if added

**Verification:**

Use visual QA to confirm:

- no horizontal clipping
- bottom nav readable
- new feedback screen readable, if added

---

## Task 8: Complete Device QA Results Report

**Objective:** Record what was actually tested versus what remains manual.

**Files:**

- Create: `docs/device-qa/phase-8-device-qa-results.md`

**Must include:**

- Web/mobile screenshot QA result
- Any real-device QA result
- If real-device QA was not possible from Hermes, state that clearly
- Remaining manual steps for Chris
- Pass/fail table by screen

---

## Task 9: Write Internal Beta Release Candidate Report

**Objective:** Produce final Phase 8 go/no-go decision.

**Files:**

- Create: `docs/internal-beta-release-candidate.md`
- Create: `docs/phase-8-completion-report.md`

**Verdict options:**

- `GO FOR INTERNAL BETA` only if real-device QA is complete and no blocking issues remain.
- `NO-GO: DEVICE QA REQUIRED` if real-device QA is still missing.
- `NO-GO: BLOCKING DEFECTS` if tests/export/device QA fail.

**Likely current expected verdict:**

```text
NO-GO: DEVICE QA REQUIRED
```

unless Chris provides real-device/simulator evidence during Phase 8.

---

## Validation Commands

Final gate:

```bash
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-web-phase8
```

Optional audit check:

```bash
npm audit --json > phase8-npm-audit.json || true
```

Do not run:

```bash
npm audit fix --force
```

---

## Risks and Tradeoffs

### Risk: Hermes cannot physically run Expo Go on Chris’s phone

Mitigation: Create exact manual QA instructions and mark beta as blocked until Chris confirms device results.

### Risk: Adding a feedback screen bloats Phase 8

Mitigation: Keep it local-only and minimal, or defer to Phase 9.

### Risk: Dependency audit remains moderate

Mitigation: Continue tracking; do not break Expo compatibility for moderate-only findings.

---

## Recommended Phase 8 Decision

Proceed with Phase 8 as:

```text
Real-Device Beta QA and Internal Release Candidate
```

Primary goal:

```text
Resolve the beta blocker from Phase 7 by proving the app on device or explicitly producing the manual device-QA package Chris must run.
```

Recommended implementation stance:

```text
Do not add major learning features in Phase 8. Harden, test, document, and prepare beta readiness.
```
