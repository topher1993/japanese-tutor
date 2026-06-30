# Phase 37a — Work Card

Status: BLOCKED on dirty-state inventory. Cannot start 37a code safely until prior uncommitted work is committed or stashed.

## Goal (per proposal §8 phase-37a)

SQLite migration behind a feature flag with no learner-visible behavior change:

1. Add `CURRENT_SCHEMA_VERSION = 2` constant + 3 new JSON-blob columns to `progress` table (`todoStates`, `weekTodosInitialized`, `todoEventCounts`).
2. `sqliteLearningRepository.ts`: update `createInitialProgress` defaults, `getProgress` JSON parsing, `saveProgress` 8-tuple. Parse failures fall back to `{}` with `console.warn`.
3. `practiceProgressStore.ts`: add no-op `todoFeatureEnabled` flag (default `false`).
4. Tests at `tests/phase37aSqliteMigration.test.ts` using in-memory DB path (`db.tables` map at `sqliteLearningRepository.ts:27`).

QC round 2 P1s to fix as part of this phase:
- P1-2: `CURRENT_SCHEMA_VERSION` constant doesn't exist today — must be invented in `db/schema.ts` rather than "bumped" (proposal wording was misleading).
- P1-4: `todoFeatureEnabled` must be readable by both `practiceProgressStore` AND `LessonsScreen` (gate UI) — name the consumer contract in the new code.

## Blocker — repo state

`git status --short` shows **45 modified files** with uncommitted work:

```
M App.tsx
M package.json
M src/components/ScreenScaffold.tsx
M src/data/candidates/exampleSentenceCandidatePack.ts
M src/data/mockSenseiLessons.ts
M src/screens/DailyLessonScreen.tsx
M src/screens/DailyRushScreen.tsx
M src/screens/ExampleSentencesScreen.tsx
M src/screens/HomeScreen.tsx
M src/screens/LessonsScreen.tsx
M src/screens/ProgressScreen.tsx
M src/screens/SettingsScreen.tsx
M src/services/candidateFlashcardAdapter.ts
M src/services/candidateQuizAdapter.ts
M src/services/candidateReviewAdapter.ts
M src/services/dailyFlashcardRushService.ts
M src/services/practiceProgressStore.ts            ← 37a touches this same file
M src/services/progressDashboardService.ts
M src/services/studyPlanService.ts
M src/services/supportLanguageService.ts
... 25 more M files ...
```

Critical overlap: **`src/services/practiceProgressStore.ts` is modified by prior uncommitted work AND is one of the 37a target files**. Direct conflict.

Last commit on `main`: `a4a34e4 feat: wire all learning materials into app practice`.

Untracked includes `docs/phase-37-todo-gated-progression-proposal.md` (proposal itself, expected), `docs/qc-reports/phase-37-*` (QC reports), `AGENTS.md`, `docs/current-tunnel-qr.png`, `graphify-out/` (build artifact), `.hermes/skills/graphify/` (skill install).

## Igris delivery plan (after unblock)

Sequence (Paced mode per `engineering-division` skill rule "Paced Multi-Phase Execution" — Chris said "A. Igris picks up 37a immediately"; this is one bounded phase, fits one subagent budget round):

1. **Read & verify.** Read `src/repositories/sqliteLearningRepository.ts`, `src/db/schema.ts`, current `src/services/practiceProgressStore.ts` (the modified version), and `tests/` shape. Confirm migration test infrastructure (vitest setup, in-memory db helpers).
2. **Implement.** Write 4 files per §8 phase-37a plan. Preserve all existing functionality. The `todoFeatureEnabled` flag default `false` means no learner-visible change.
3. **Test.** Write `tests/phase37aSqliteMigration.test.ts` per spec (in-memory DB path, JSON-parse failure tolerance, roll-forward meta row).
4. **Verify.** Run `npm run typecheck`, focused test, full `npm test`, capture evidence.
5. **Report.** File list, test counts, typecheck result, npm test summary. Do NOT touch the 45 unrelated modified files.

## Risks for this phase

- **Dirty state overlap on `practiceProgressStore.ts`.** Even with `todoFeatureEnabled = false`, the file edit collides with prior uncommitted work. If that prior work is mid-flight and not yet stable, my edit could make merge conflicts harder for whoever finishes it.
- **Schema migration in tests.** The in-memory `db.tables` path is a test seam, not a runtime seam. If the existing test setup mocks `expo-sqlite` differently, I may need to discover and follow that pattern rather than invent one.

## Out of scope (deferred to later phases)

- Phase 37b: types, `weeklyTodoService.ts`, `weeklyPlansService.ts`, `weeklyCardPoolService.ts`, `lesson`-kind wiring
- Phase 37c: `LessonsScreen.tsx` gate UI
- Phase 37d-1..5: per-kind event wiring
- Phase 37e: Home + Progress integration
- Phase 37f: full QC gate
- Phase 37g: rollout tiers

## Decision needed before dispatch

Four options for how to handle the 45-file dirty state before Igris starts 37a:

- **A. `git stash --include-untracked` everything → Igris works on clean HEAD → `git stash pop` after.** Untracked docs/graphify artifacts come back. Modified source files come back. Conflicts on `practiceProgressStore.ts` must be resolved by hand or by whoever owns the prior work. Risky if the prior work is in-flight.
- **B. `git commit -m "wip: pre-37a dirty state snapshot"` the current dirty tree → Igris works on committed HEAD → resolve conflict on `practiceProgressStore.ts` when 37a is done.** Creates a "wip" commit in history. Safer than stash but pollutes log.
- **C. Cherry-pick just the modified files Igris must read into a clean worktree → 37a work happens on a branch off `a4a34e4` → merge later.** Slowest. Cleanest history.
- **D. Pause 37a. Chris decides what to do with the 45 modified files first (probably they were from another in-flight phase that should commit before 37a starts).** Defers the work.