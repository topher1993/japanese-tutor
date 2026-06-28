# Phase 24 — Re-Audit Report

**Date:** 2026-06-25
**QC Authority:** GPT-5.5 (via openai-codex provider, Codex Plus subscription)
**Engineering:** MiniMax M3
**Orchestrator:** Belion (MiniMax M3)
**Routing verified:** CODEX_ROUTING_OK
**Brief:** `.hermes/briefs/phase24-reaudit-brief.md`
**Session ID:** 20260625_152642_5aa3c4

## Verdict

**NOT APPROVED.** Effective score **38/100** (down from Phase 23's 72/100, **−34**).

GPT-5.5 re-verified on disk: Phase 24 shipped no meaningful fixes. The `<T>` issue is no longer theoretical — `npm run typecheck` fails hard with JSX parse errors. The blocker was under-counted in Phase 23: the same defect exists in `src/services/learningContext.tsx:72`. Vitest coverage is green but does not exercise the failing native/TSX build path.

## Below is the verbatim GPT-5.5 response



I re-verified on disk. The disclosure is accurate: Phase 24 shipped no meaningful fixes, and the effective score should be lower than Phase 23’s 72/100.

Current effective score: 38/100

Why lower than 72:
- Phase 23’s 72/100 was “approved-with-conditions,” assuming immediate remediation of 3 blockers.
- Phase 24 did not deliver those conditions.
- The App.tsx `<T>` issue is not theoretical anymore: `npm run typecheck` currently fails hard with JSX parse errors.
- The same `<T>` `.tsx` generic parse defect also exists in `src/services/learningContext.tsx:72`, so the original blocker was under-counted.
- The app still has green Vitest coverage, but those tests are not exercising the failing native/TSX build path.

Verified evidence:
- `npm test -- --run`: 50 files passed, 329 tests passed.
- `npm run typecheck`: FAILED.
- `App.tsx`: `<T>` still at lines 117 and 176.
- `src/services/learningContext.tsx`: `<T>` also at line 72.
- `FlashcardsScreen.tsx`: still imports and uses `createSpacedRepetitionScheduler()` in-memory at lines 15, 51, 92, 96.
- `SettingsScreen` reset still delegates to App’s `onReset`, which only calls `clearOnboardingPreference()`.
- `clearOnboardingPreference()` is explicitly web/localStorage-only; native returns no-op when `window` is unavailable.
- `practiceProgressStore.ts`: no `reset()`.
- `persistentSrsStore.ts`: no `clearAll()`.
- `HomeScreen` shows due count text, but no actionable “Review N due cards now” CTA or navigation target.
- `docs/phase-22-dependency-audit.md` still contains `[object Object]`.
- `tests/phase22P0SrsPersistence.test.ts:116` still has the un-awaited `.resolves`.
- No Phase 24 files found by `phase24|Phase 24|phase-24` search.
- Note: the project directory is not currently a git repo from this environment’s view, so I could not verify via git diff/history.

Recommendation:
Close Phase 24 as a NO-OP / failed remediation phase, then roll the conditions forward into Phase 25.

Do not recommission Phase 24 under the same number. Keeping Phase 24 as a no-op is cleaner audit accounting:
- Phase 23: approved-with-conditions, 72/100.
- Phase 24: no-op / failed delivery, 38/100 current product readiness.
- Phase 25: focused remediation phase with the smallest scope to flip to APPROVED.

Revised Phase 25 conditions, smallest blast radius

P0-1 — Restore build/typecheck safety across `.tsx`
Required:
- Fix all generic arrow functions in `.tsx`, not only `App.tsx`.
- Confirm at minimum:
  - `App.tsx:117`
  - `App.tsx:176`
  - `src/services/learningContext.tsx:72`
- Preferred low-blast fix:
  - replace `<T>(...) => ...` with either `<T,>(...) => ...`, or typed helper functions outside JSX-heavy object literals.
- Verification:
  - `npm run typecheck` must return zero errors.
  - Add or update a source regression test that scans `.tsx` adapter literals for ambiguous `getAllAsync: <T>(...)` patterns.

P0-2 — Make “Reset all progress” true on native
Required:
- Add `repo.deleteAllProgress()` or equivalent to the persistent repository.
- Add `practiceProgressStore.reset()`.
- Add `persistentSrsStore.clearAll()`.
- Add onboarding preference clearing through the same native SQLite key-value adapter used by app startup, not `window.localStorage`.
- Pass the actual store/SRS/repo/storage path into Settings reset instead of only calling `clearOnboardingPreference()`.
- User-facing reset must clear:
  - onboarding preference
  - completed lessons/progress rows
  - SRS review cards
- Verification:
  - Unit/integration test proves native-style SQLite/in-memory adapter has data before reset and zero progress/SRS/onboarding after reset.
  - No reset button no-op path on React Native.

P0-3 — Replace FlashcardsScreen in-memory SRS with persistent context SRS
Required:
- Remove `createSpacedRepetitionScheduler()` from `FlashcardsScreen.tsx`.
- Use `srs` from `useLearningContext()` for:
  - due count
  - create card
  - review/rating
  - display of current review metadata where practical
- The screen must not lose a learner’s card rating after cold start.
- Verification:
  - Test rates a card through the screen/service path, recreates the store/context, and proves the row persists.
  - Due count must be sourced from persistent `srs.dueCount()`, not local `scheduler.dueCards()`.

P0-4 — Real device persistence smoke test
Required:
- Android smoke:
  - complete lesson
  - kill app
  - relaunch
  - completed lesson still present
  - rate flashcard
  - kill app
  - relaunch
  - SRS row/due count still present
- iOS smoke:
  - same path, if iOS environment is available.
- If iOS remains blocked by missing Apple/EAS/TestFlight setup, document it as an environment blocker, not as passed.
- Verification artifact:
  - write a short Phase 25 QA note with exact command/device path and observed result.

P1-1 — Add Home “Review N due cards now” CTA
Required:
- When `dueCount > 0`, Home must show an actionable button/card CTA, not only text.
- CTA should navigate to Flashcards.
- Flashcards should open in a due-review mode/subset where practical.
- Smallest acceptable version:
  - Home button switches active tab to Flashcards.
  - Flashcards uses persistent due count and prioritizes due cards.
- Verification:
  - Source/test assertion proves CTA exists and invokes a real navigation handler, not `undefined`.

P1-2 — Fix stale hardcoded flashcard dates
Required:
- Replace hardcoded `nextReviewDate: '2026-06-18'` and `'2026-06-24'` in:
  - `src/services/flashcardService.ts`
  - `src/services/candidateFlashcardAdapter.ts`
- Use a shared `todayIso()` helper or injected date for tests.
- Keep deterministic tests by passing date explicitly where needed.
- Verification:
  - tests cover default date uses today/injected date.
  - no production flashcard data-layer hardcoded 2026 review dates remain.

P2-1 — Fix audit report `[object Object]`
Required:
- Fix `docs/phase-22-dependency-audit.md` line 16.
- Fix any report generator path if this was produced by `scripts/audit-report.mjs`.
- Verification:
  - grep docs for `[object Object]` excluding node_modules and intentional discussion in audit reports.
  - generated report renders human-readable dependency count/metadata.

P2-2 — Await the Vitest `.resolves` assertion
Required:
- Change `tests/phase22P0SrsPersistence.test.ts:116` to `await expect(...).resolves.toBe(1)`.
- Verification:
  - `npm test -- --run` cleanly passes without Vitest warning.

P2-3 — Write Phase 25 implementation report
Required:
- Document exactly what changed, what passed, what remains blocked.
- Must include:
  - typecheck result
  - test result
  - Android/iOS smoke result or explicit blocker
  - reset behavior evidence
  - SRS persistence evidence

Updated production-readiness assessment

Current status: NOT production-ready / NOT beta-ready for trustworthy learner data.

The app has useful functional surface and 329 green unit tests, but the current release candidate cannot be treated as production-ready because:

1. TypeScript build gate is red.
   `npm run typecheck` fails with TSX parse errors. This alone blocks approval.

2. Reset button is a user-facing lie on native.
   A destructive “Reset all progress” control that does not clear native progress/SRS data is worse than no reset button, because it tells QA and learners that data has been cleared when it has not.

3. Flashcard SRS ratings are still session-local in the screen.
   The persistent SRS store exists, but the actual FlashcardsScreen rating path does not use it. This breaks a core learning promise.

4. Device persistence is unproven.
   No current Android/iOS cold-start smoke evidence exists for the specific flows that matter: lesson completion and SRS review persistence.

5. Test suite is green but insufficient.
   The 329/329 result is real, but it is currently masking build/runtime gaps:
   - no TSX generic parse gate coverage
   - no screen-level persistent SRS flow test
   - no native reset integration test
   - no real-device persistence smoke

Final recommendation:
Close Phase 24 as NO-OP / failed remediation. Start Phase 25 as a narrow remediation phase. Do not add features beyond the listed conditions until P0s are green.

Approval target for Phase 25:
- `npm run typecheck`: 0 errors
- `npm test -- --run`: 329+ tests passing, no un-awaited resolves warning
- native reset actually clears onboarding/progress/SRS
- Flashcards uses persistent SRS
- at least Android cold-start smoke verified
- iOS smoke verified or explicitly blocked by environment

If Phase 25 delivers only those items with evidence, I would expect the score to move from 38/100 to roughly 82–88/100 depending on real-device results.

session_id: 20260625_153004_1b6fbb
