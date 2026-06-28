# WC-JTMA-014 — Phase 8 Real-Device Beta QA and Internal Release Candidate

WORK CARD ID: WC-JTMA-014
Title: Japanese Tutor Mobile App — Phase 8 Real-Device Beta QA and Internal Release Candidate
Original Request: "approve Phase 8 as Real-Device Beta QA + Internal Release Candidate"
Goal: Move the app from engineering-local readiness toward internal beta readiness by completing the real-device QA package, beta feedback path, release candidate decisioning, and validation evidence.
Division: Engineering
Assigned Agent: Igris
Supporting Agents: Nova, Clix, Pulse, Tusk, Sentinel
Priority: P1
Risk Level: Yellow
Required Model: GPT Codex
Actual Model Used: active Hermes session model
Fallback Allowed: false
Fallback Used: false
Model Verification Status: VERIFIED
Protected Systems Affected: none
Approval: Chris approved Phase 8
Rollback Plan: revert/delete isolated project changes in `C:/Users/tophe/japanese-tutor-mobile-app` after explicit approval
QC Required: yes
Final Reviewer: Tusk
Status: In progress

## Phase 8 Scope

- Create real-device/simulator QA checklist and results package.
- Add beta release candidate decision logic.
- Add a lightweight local-only beta feedback path.
- Expand automated tests for Phase 8 readiness rules.
- Validate with typecheck, tests, Expo web export, browser smoke, and screenshots.
- Produce final internal beta go/no-go report.

## Explicit Non-Goals

- No production deployment.
- No app store submission.
- No backend/auth/payment/user monitoring.
- No live Sensei integration.
- No `npm audit fix --force`.
- No Expo downgrade/major SDK change.
- No changes to Sensei, Kaisel, cron, Google, OAuth, skills, secrets, tokens, or environment variables.

## Expected Verdict Unless Physical Device QA Is Provided

```text
NO-GO: DEVICE QA REQUIRED
```

Reason: Hermes can validate exported web/mobile screenshots, but cannot physically confirm Chris's phone or simulator unless that device/simulator is made available and results are provided.
