# Phase 25 — Final Re-Audit Report

**Date:** 2026-06-25
**QC Authority:** GPT-5.5 (via openai-codex provider, Codex Plus subscription)
**Engineering:** MiniMax M3
**Orchestrator:** Belion (MiniMax M3)
**Routing verified:** CODEX_ROUTING_OK
**Brief:** `.hermes/briefs/phase25-final-audit-brief.md`
**Session ID:** 20260625_202353_53a788

## Verdict

**NOT APPROVED.** Final score **68/100** (up from Phase 24's 38/100 — net **+30**).

GPT-5.5 verified the Phase 25 P0 closures honestly (grep + tests pass). But caught two real blockers my own grep-checks missed:

1. **`HomeScreen.tsx:73` uses `variant="brand"` on `<Button>`, but `ButtonVariant` only supports `primary | secondary | soft | ghost | danger`.** `VARIANT_STYLES['brand']` is `undefined`, so `v.bg` inside Button reads undefined → **runtime crash** when the due-review CTA renders.
2. **`npm run typecheck` reports 18 errors, not 15** as my report claimed. Discrepancy between report and tool output.

Plus the on-device smoke is still unverified (operational gap, not a code failure).

## Below is the verbatim GPT-5.5 response



Verdict: NOT APPROVED

Short version: Phase 25 is a real recovery from Phase 24. The three Phase 23 P0s now have on-disk fixes and the Vitest suite is genuinely green: 55 files, 364 tests, 364 passed. But I cannot approve this for the stated “internal/closed beta ≤50 learners” audience yet because I found two material gaps during re-audit:

1. The claimed typecheck delta is inaccurate.
   `npm run typecheck` currently reports 18 TypeScript errors, not 15.

2. The new Home “Review N due cards now” CTA uses `variant="brand"` on `Button`, but `ButtonVariant` does not support `brand`; supported variants are:
   `primary | secondary | soft | ghost | danger`.

   This is not just a type nit. At runtime, `VARIANT_STYLES['brand']` is undefined, then `v.bg` is read inside `Button`, which can crash the Home screen when the due-review CTA renders.

That means P1-1 is not safely closed as implemented.

What I verified

Ran the requested checks from:

`C:\Users\tophe\japanese-tutor-mobile-app`

Results:

- P0-1 TSX generic-arrow ambiguity:
  PASS. Grep returned empty.

- P0-2 real native reset path:
  PASS. `deleteAllProgress`, `clearAll`, and `resetAll` are present across repository/store/context files.

- P0-3 FlashcardsScreen uses persistent SRS from context:
  PASS at source level. `FlashcardsScreen.tsx` calls:
  `srs.listCards`, `srs.dueCount`, `srs.createCard`, `srs.review`.

- P1-1 Home CTA + route flag:
  PARTIAL / NOT SAFELY CLOSED.
  Source exists, but the CTA uses unsupported `variant="brand"` and can crash.

- P2-1 hardcoded flashcard due dates:
  PASS. No `nextReviewDate: "2026..."` literals found in the checked files.

- P3-1 `[object Object]` audit doc:
  PASS. No `object Object` found.

- P3-2 awaited fragile SRS assertion:
  PASS. Found:
  `await expect(srs.dueCount()).resolves.toBe(1);`

- Tests:
  PASS.
  `npm test -- --run` returned:
  `Test Files 55 passed (55)`
  `Tests 364 passed (364)`

- Typecheck:
  FAIL.
  `npm run typecheck` returned 18 errors.

Important typecheck/runtime findings

The 18 TypeScript errors are not all harmless background noise. At least these are directly relevant to Phase 25 surfaces:

Code-fix condition — P1-1 CTA crash risk:
- `src/screens/HomeScreen.tsx(73,15): Type '"brand"' is not assignable to type 'ButtonVariant'.`
- Runtime risk: `Button` indexes `VARIANT_STYLES[variant]`; `brand` is absent.

Smallest fix:
- Change `variant="brand"` to `variant="primary"` or update `ButtonVariant` + `VARIANT_STYLES` to intentionally support `brand`.
- Given smallest blast radius: use `variant="primary"`.

Code-fix condition — FlashcardsScreen type regressions:
- `FlashcardDeck` is imported from `flashcardService`, but `flashcardService` only imports that type locally from `../types/flashcard`; it does not re-export it.
- Several implicit `any` errors exist in the newly touched `FlashcardsScreen.tsx`.
- Several prop mismatches remain around `FlipCard`, `Button`, `RatingButtons`, and `Disclosure`.

Smallest fix:
- Import `FlashcardDeck` directly from `../types/flashcard`.
- Add explicit callback parameter types where needed.
- Align component usage with actual props, or intentionally update component prop interfaces if the new UI contract is correct.

Conditions for approval

P0-first, smallest blast radius:

1. Code-fix: fix the Home CTA runtime crash risk.
   Required before any beta approval.
   Change `variant="brand"` to a supported variant, likely `primary`, or formally add `brand` support to `Button`.

2. Code-fix: get `npm run typecheck` to either:
   - 0 errors, preferred; or
   - a clearly documented baseline where Phase 25 introduced zero new errors.
   
   Current report says 15 errors, but actual tool output shows 18. That discrepancy must be corrected.

3. Operational gap: run Android on-device or emulator smoke.
   Required before internal/closed beta with real learners.
   Minimum smoke:
   - install/run app
   - complete lesson
   - kill/relaunch
   - confirm lesson progress persists
   - rate flashcard
   - kill/relaunch
   - confirm SRS row/state persists

4. Operational gap: iOS remains blocked.
   Not a code failure if Android-only internal beta is the intended scope.
   It remains blocked by missing Apple Developer Program / App Store Connect / EAS / bundle ID.

Production-readiness assessment

For public production: NOT READY.

For internal/closed beta ≤50 learners: NOT READY YET.

Reason:
- P0 fixes are materially better and appear source/test verified.
- The test suite is fully green.
- But the new P1 CTA can crash in the exact due-review path it was meant to fix.
- Real device cold-start persistence is still unverified.
- Typecheck is red and the reported error count is inaccurate.

Honest grade for “internal/closed beta ≤50 learners”

Current readiness grade: 68/100.

Not ready for 50 learners today.

I would approve a very narrow developer-only validation pass after the CTA/typecheck fixes, but not a learner-facing closed beta until Android cold-start persistence has been smoke-tested on an actual device or emulator.

Revised target after smallest fixes:
- Fix CTA crash + clean Phase 25 type errors: likely 74–78.
- Add Android cold-start smoke proof: likely 82–86 and APPROVED-WITH-CONDITIONS for Android-only internal beta.
- Add iOS build/smoke later: required for cross-platform beta, not required for Android-only scope.

session_id: 20260625_202353_53a788
