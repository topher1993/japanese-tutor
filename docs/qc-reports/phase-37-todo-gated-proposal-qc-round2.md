
session_id: 20260701_052803_b8b9a6
Critical findings to feed into the QC report:

1. **`progress` table is a 5-tuple claim is true** — line 48: `INSERT OR REPLACE INTO progress VALUES (?, ?, ?, ?, ?)`. Schema at line 7 confirms 5 columns. Good — the proposal's migration plan is grounded.
2. **`db.tables` location cited at `sqliteLearningRepository.ts:27`** — confirmed.
3. **`getLessonCategoryCards`** — proposal §3.1 references this for pool resolution. It does NOT exist (only referenced in 2 places, neither a definition). This is a real issue: the proposal says "filter getAllLessons() then getLessonCategoryCards(...)" but that function isn't there. Cards come from `createFlashcardDeck` not from a `getLessonCategoryCards` helper.
4. **`CURRENT_SCHEMA_VERSION` constant** — does not exist in `schema.ts`. The proposal §3.3 says `db/schema.ts` bump version `1 → 2` via this constant — but the file today has no version concept. The migration logic will have to invent the version mechanism from scratch; the claim that it merely "bumps" is slightly misleading.
5. **`createFlashcardDeck` is what builds cards from lessons + supplemental** (line 14 of `flashcardService.ts`). The pool resolver would need to consult THIS, not `getLessonCategoryCards`.
6. **`FlashcardReviewCard`** doesn't have a `kind` field today (line 3 of `flashcard.ts` confirmed). It has `category` which may suffice for `kind: 'kanji' | 'vocab'` discrimination, but the claim about `card.kind === 'kanji'` needs an explicit `kind` field per the proposal.
7. **`answerFlashcard` (line 21) is a pure transform** that returns a new deck — it does NOT persist to `LearnerProgress`. The proposal correctly notes this in §5 and the risk row, and the plan wires it through the store. OK.
8. **`quiz_questions` table** has no `week_number` column (line 6 of schema.ts) — `practiceProgressStore.recordQuizAttempt(weekNumber, ...)` would be a pure in-store call with no schema impact. OK.

I have enough to write the round-2 review now. Total word target: ≤600.

## Phase 37 — Round 2 QC Review

## Round-1 P0 addressed

1. **P0-1 (lesson-vs-todo conflation / `isWeekUnlocked` consults wrong service)** — **yes.** §4.1 explicitly states `isWeekUnlocked` takes only `todoBoards`; §4 has a comment block flagging the original confusion. Concrete algorithm given at lines 261–265. Strong fix.
2. **P0-2 (SQLite migration was hand-wavey / no test strategy)** — **yes.** §3.3 lays out 6 concrete steps with a `meta` table for `schemaVersion`, JSON-blob columns with parse-fail fallback, and §8 phase-37a mandates an **in-memory DB path test** (not `expo-sqlite`) seeded via the legacy 5-tuple at `src/repositories/sqliteLearningRepository.ts:48`. Fix is tight.
3. **P0-3 (§5 hooks overstated; no honest map of READY vs NEW-METHOD)** — **yes.** §5 is now a per-kind table with explicit **READY / READY\*** / **NEW METHOD** status and exact wire-at site locations (e.g. `DailyRushScreen.tsx:117-122`, `flashcardService.ts:21`). The recommended read of anyround-1 reviewer could verify each cited line directly.

## Round-1 P1 addressed

1. **P1-1 (`learners/`-week render rule absent)** — **yes.** §3.4 step 4 + `isLegacyWeek` in §4 + §11.1-B preview-but-locked + §9 risk row covers the prior-week render surface. Single `isLegacyWeek` boolean unifies both paths.
2. **P1-2 (skip mechanism unresolved)** — **yes.** §11.3 proposes A (no skip for v1); `skipped?: boolean` field added in §3.2 so v2 needs no migration. Implementation deferred without blocking.
3. **P1-3 (mid-week content edit asymmetry)** — **yes.** §11.4 lists the four edit cases explicitly (existing/new/removed todos) with the snapshot rule gated by `weekTodosInitialized`.
4. **P1-4 (per-kind thresholds undefined)** — **yes.** §11.2 locks defaults for all 6 kinds with rationale.
5. **P1-5 (rollout / migration-bricking risk)** — **yes.** §8 phase-37g is a three-tier rollout (dev-only → new learners → week-1 learners → full), gated behind feature flag from §3.3 step 6. Risk row at §9 reinforces.
6. **P1-6 (verification gate = full audit rule)** — **yes.** §8 phase-37f names exact QC files (`weeklyTodoService`, `practiceProgressStore`, `sqliteLearningRepository`, `LessonsScreen`) and the explicit "GPT-5.5 unreachable → STOP 'QC BLOCKED'" clause at line 500.

## New P0 issues

None. The revisions did not introduce critical contradictions.

## New P1 issues

1. **Card-pool resolver cites a function that does not exist.** §3.1 says "filter `getAllLessons()` then `getLessonCategoryCards(...)`" — no such helper exists in `src/services/`. The actual card source is `createFlashcardDeck` at `src/services/flashcardService.ts:14`, which merges `lesson.items` (not by `category`) with `supplementalFlashcards`. The `kanji` discrimination via `card.kind === 'kanji'` is therefore double-broken: `kind` field is missing from `FlashcardReviewCard` (`src/types/flashcard.ts:3`), and the resolver path is mis-cited. Plan has the right idea, citations need correcting before 37d-2/37d-3 code lands.
2. **`CURRENT_SCHEMA_VERSION` constant does not exist** in `src/db/schema.ts` today. §3.3 step 1 says "bump from 1 → 2" implying it exists — it does not. The migration scaffolding will have to invent the version mechanism. Not blocking, but the phrasing is misleading.
3. **`answerFlashcard` is a pure transform** (`flashcardService.ts:21`) — it returns a new deck and never touches the store. §5's "wire into store" depends on the caller doing the write. §5.1's contract is fine but should explicitly name the call-site (likely the screen, not `flashcardService`) so 37d-2 doesn't wire a place that already discards the result.
4. **`todoFeatureEnabled` short-circuit** is in `practiceProgressStore`, but §8 phase-37b step 5 says "flip flag to `true` for this phase" — the flag must also be readable by `LessonsScreen` (the gate UI). §8 doesn't name the consumer. Minor.

## Feasibility verdict: **GO-WITH-CONDITIONS**

## Recommendation
Ship — but resolve the four P1s above (especially the missing `getLessonCategoryCards` / `kind` field) as part of phase-37a/37b documentation, not as surprises during 37d code. The P0/P1 issues from round 1 are genuinely closed; the proposal is implementable after citation corrections.
