# WC-JTMA-013 — Phase 7 Beta Readiness / Device QA / Dependency Pass

WORK CARD ID: WC-JTMA-013
Title: Japanese Tutor Mobile App — Phase 7 Beta Readiness / Device QA / Dependency Pass
Original Request: "lets implement phase 7"
Goal: Prepare the app for internal beta by adding persistent onboarding preference, dependency audit decisioning, beta checklist, expanded regression tests, and updated validation evidence.
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
Approval: Chris approved Phase 7 by asking to implement it
Rollback Plan: revert/delete isolated project changes in `C:/Users/tophe/japanese-tutor-mobile-app` after explicit approval
QC Required: yes
Final Reviewer: Tusk
Status: In progress

## Phase 7 Scope

- Add persistent onboarding completion/support-language preference.
- Inspect npm audit findings without force-fixing Expo dependencies.
- Add beta readiness checklist and summary service.
- Expand automated tests for beta readiness regressions.
- Validate with typecheck, tests, web export, and screenshot smoke.

## Out of Scope Without Additional Approval

- `npm audit fix --force`
- Expo SDK downgrade/major upgrade
- production deployment
- app store submission
- touching Sensei/Kaisel/cron/Google/OAuth/secrets systems
