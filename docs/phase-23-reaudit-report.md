# Phase 23 — Re-Audit Report

**Date:** 2026-06-25
**QC Authority:** GPT-5.5 (via openai-codex provider, Codex Plus subscription)
**Engineering:** MiniMax M3
**Orchestrator:** Belion (MiniMax M3)
**Routing verified:** CODEX_ROUTING_OK
**Baseline tests:** 329/329 green (50 files)

## Verdict

**APPROVED-WITH-CONDITIONS** — ship-blockers are reduced, wiring is real, test signal is honest about its limits, but two material regressions plus one previously-undisclosed gap must be addressed before beta ships to a real learner.

**Score: 72/100** (up from 47/100 — net delta +25).

## What GPT-5.5 confirmed closed ✅

| Item | Status |
|---|---|
| P0-01 onboarding storage | ✅ Closed (real persistence, async + SQLite-backed, honest about on-device verification gap) |
| P0-02 SQLite wiring | ✅ Closed for HomeScreen / ProgressScreen / LessonsScreen; **partial for FlashcardsScreen** (see new finding) |
| P0-04 tab labels | ✅ Closed (Home / Lessons / Flashcards / Quiz / Progress — internally consistent noun set) |
| P1-05 width cap | ✅ Closed (480 dp cap on tablets, phones use full width) |
| P1-07 bundle split | ✅ Closed (dynamic import chunks N5/N4 packs) |
| P1-08 query-param gate | ✅ Closed (all 4 hatch params gated behind __DEV__) |
| P1-09 dependency audit | ✅ Closed (script + pinned versions + 0 critical / 0 high / 17 moderate) |

## New findings from the re-audit

### P0-new-1 — App.tsx `<T>` ambiguous in .tsx context (BLOCKING)
- `App.tsx` lines 116-117 use `getAllAsync: <T>(...)` which Metro may fail to parse or silently strip generics.
- 2-line fix: wrap the cast or extract a typed helper.
- **This is a production-build blocker** that vitest doesn't catch.

### P0-new-2 — Settings "Reset all progress" is a no-op on React Native (BLOCKING)
- `clearOnboardingPreference()` only knows about `window.localStorage` — on RN it returns a silent no-op.
- `practiceProgressStore` has no `reset()` method.
- `persistentSrsStore` has no `clearAll()` method.
- `sqliteLearningRepository` has no `DELETE FROM` methods.
- **The SettingsScreen promises to clear everything; on RN it clears nothing.** User-facing lie.
- Multi-file fix required: add `reset()` to the store, add `clearAll()` to SRS, add `deleteAll*` methods to repo, plumb the SQLite-backed storage into the Settings onReset callback.

### P1-new-3 — FlashcardsScreen SRS data does not persist (BLOCKING)
- `FlashcardsScreen.tsx:51` instantiates a fresh in-memory `createSpacedRepetitionScheduler()`.
- `rateCard` (lines 89-99) writes to that scheduler only.
- Visible "due" count (line 76) is computed from the in-memory scheduler.
- The persistent `srs` from `useLearningContext()` is never used.
- **Learner rates 50 cards → all SRS state lost on cold start.** Same failure shape as Phase 22's P0-02, narrower in scope.
- Fix: replace local scheduler with `srs` from context; call `srs.createCard` / `srs.review`.

### P2-new-4 — Hardcoded display dates in data layer (POLISH)
- `flashcardService.ts:9-10` and `candidateFlashcardAdapter.ts:38,53` hardcode `'2026-06-18'` / `'2026-06-24'` for `nextReviewDate`.
- Use `todayIso()` everywhere.

### P3-new-5 — Audit report renders `[object Object]` (COSMETIC)
- `docs/phase-22-dependency-audit.md` line 16: `report.metadata.dependencies` is an object, not a number.

### P3-new-6 — Fragile assertion in SRS test (COSMETIC)
- `tests/phase22P0SrsPersistence.test.ts:116` uses un-awaited `expect(...).resolves.toBe(1)` which vitest 4.x auto-awaits but future majors may not.

## Conditions for next cycle (Phase 24 → APPROVED)

GPT-5.5 conditions for flipping to APPROVED:

1. Fix `App.tsx` lines 116-117 — remove `<T>` ambiguity in `.tsx`. Verify with `npx tsc --noEmit` returning zero errors.
2. Implement a real reset path: `practiceProgressStore.reset()` → `repo.deleteAllProgress()` (DELETE FROM progress, streaks, settings), `persistentSrsStore.clearAll()` (DELETE FROM kv_srs_cards), and pass the SQLite-backed adapter into Settings onReset.
3. Replace the in-memory SRS scheduler in `FlashcardsScreen.tsx` with `srs` from `useLearningContext()` — for both `dueCount` and `createCard`/`review`.
4. Add a "Review N due cards now" CTA on HomeScreen that navigates to Flashcards with due subset pre-filtered.
5. On-device smoke test on Android + iOS: complete lesson → kill → relaunch → assert complete; rate flashcard → kill → relaunch → assert SRS row persists.
6. Fix `[object Object]` in audit report.

## Production-readiness assessment (verbatim from GPT-5.5)

> *"Would I ship this to a real Japanese learner today? **No — not as-is**, but with the six conditions above addressed, **yes for an internal/closed beta (≤50 learners)**. For a public-release (App Store) launch, additional Phase 24/25 work is needed: tablet layout, complete the P2-P4 backlog, get the 17 moderate advisories down, run a TestFlight beta with at least 10 external learners, and add a privacy policy / data handling disclosure because the app now persists learner state across installs."*

## What this means

- **Phase 22 → Phase 23 was a real win** (+25 points, all P0/P1 touched).
- **But Phase 23 introduced 3 blocking issues** that didn't exist in Phase 22: 1 TypeScript parse risk, 1 user-facing reset lie, 1 narrower-but-real SRS persistence gap.
- **Phase 24 (next) is the closeout cycle**: fix the three blockers, run the on-device smoke test, and re-audit. That should land APPROVED.
- The re-audit loop is doing its job — the same model that returned 47/100 returned 72/100 with three real blockers it caught itself.

## Files (raw)

- Audit brief: `C:\Users\tophe\AppData\Local\Temp\phase23-reaudit-brief.txt`
- Audit response: `C:\Users\tophe\AppData\Local\Temp\phase23-reaudit-response.txt` (22,649 bytes, 224 lines)
- Phase 23 implementation report: `docs\phase-23-implementation-report.md`