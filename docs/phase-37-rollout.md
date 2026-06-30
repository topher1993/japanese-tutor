# Phase 37g — Weekly Todo Rollout Plan

Phase: **37g — Rollout** (the three-tier / four-tier rollout phase)
Baseline: `2867c1b` — `docs(phase37f): final QC gate PASS — 37a..37e ships clean across 9 sections`
Status at start of phase: schema migrated (37a), data + service for all six todo kinds wired (37b, 37c, 37d-1..37d-5, 37e), QC passed on every step (37f). Everything behind a feature flag.

This document is the operative plan for flipping `todoFeatureEnabled` from its shipped-off default to on. It is the "safe path" Chris has available the moment a learner is ready to see the gate.

---

## 0. Current state anchors

- `todoFeatureEnabled` lives in `src/services/practiceProgressStore.ts` and currently exports `false`. Committed at `57631de` (Phase 37a dirty-state batch). Phase 37g does NOT change this default — production builds still ship with the gate invisible.
- The store exposes `setTodoFeatureEnabled(next: boolean)` and `isTodoFeatureEnabled(): boolean`. Both take effect immediately at module level (the named binding is mutated, not a getter into a config table) — see `src/services/practiceProgressStore.ts:16-22`.
- Every recorder (`completeCurrentLesson`, `recordDailyRushComplete`, `recordFlashcardReview`, `recordKanjiGood`, `recordQuizAttempt`, plus the `example-sentences` view counter added in 37d-5) early-returns when the flag is off. No data is written behind the gate while the flag is off, so flipping it on is safe; flipping it off after it's been on is non-destructive to persisted state — see §5.
- Android dev menu screen is the canonical flip site once Tier 1 wires it; `src/dev/featureFlagDevMenu.ts` (new in 37g) is the helper that wraps the store call with a `console.warn` banner. Nothing imports it yet at the end of 37g.

---

## 1. Tiers

The proposal §8 phase-37g spells out three phases. This doc splits step 4 into two real options so Chris can pick the production posture on the day of full rollout.

### Tier 1 — Dev menu only

**Audience:** nobody in production. Only `__DEV__` builds via the Settings screen.

**Flip site:** `src/screens/SettingsScreen.tsx`. The new "Dev" section renders two `Button`s:
- "Enable weekly todos" → `enableWeeklyTodos()` from `src/dev/featureFlagDevMenu.ts`.
- "Disable weekly todos" → `disableWeeklyTodos()`.

**Build behavior:**
- `__DEV__` true (Expo dev / `expo start` / debug build): the section renders. Buttons flip the flag at runtime.
- `__DEV__` false (any release / TestFlight / Play Store build): the section does not render. The bundle tree-shakes the unused imports.

**Risk:** zero production user impact. Only devs and internal testers see the controls.

**Time on this tier:** indefinite. Stay here until Chris says "turn it on for real learners." There is no clock-driven promotion.

**Acceptance to exit this tier:**
- `npx tsc --noEmit` passes (no unused-import lint).
- `npm test` is 657/657 (no source changes outside SettingsScreen, as required).
- Manual: in a `__DEV__` build, the two buttons toggle the flag and the console banner is observable. In a release build (`expo start --no-dev`), the section is absent from the rendered tree.

**Commit anchor for this tier:** the 37g commit (this PR, tip-of-branch at time of merge). Date stamp: filled in on merge.

---

### Tier 2 — Enable for new learners only

**Audience:** learners with zero completed lessons. Existing mid-curriculum learners are still on the legacy path.

**Behavior gate:** at app boot, `practiceProgressStore` checks `repo.getProgress().completedLessonIds.length === 0`. If zero AND the flag is set to `true` at the session level (still defaults to `false` at module init), the gate UI is shown for this learner.

**Mechanism note:** this tier is NOT auto-wired at module init. The flag must be flipped to `true` for the cohort (e.g. via a one-off test-plan callback from the dev menu, or a future Cohort selector in the dev menu). For the first cohort of new learners, recommended procedure:
1. Chris opens the dev menu on a fresh install and hits "Enable weekly todos".
2. Verifies the gate UI renders on Lessons tab + Home + Progress.
3. Walks the learner through Week 1 onboarding while watching `console.warn` banners and the persisted state.

**Why "new learners only":** they have no legacy prior weeks. The `isLegacyWeek` render path is irrelevant. We are validating that the recompute + persistence + UI loop holds for the simplest cohort: one week, six kinds, no migration debt.

**Watch for:** crashes on first lesson completion (the recompute path runs once per lesson), data corruption in `todoStates` JSON blobs (`saveExtendedProgress` round-trip), UI races between `LessonCompleteModal` and the gate tile.

**Time on this tier:** ~one full QA cycle (proposal says "after one full QA cycle"). For the project, that's roughly a week of internal tester runs across multiple devices.

**Rollback:** flip the flag to `false`. Learners on this tier return to the legacy Lessons tab. Persisted `todoStates` and `todoEventCounts` are frozen — they don't grow while the flag is off, but they're also never deleted. Re-enabling resumes from the frozen state.

**Commit anchor for this tier:** TBD on promotion. Date stamp: TBD.

---

### Tier 3 — Enable for existing learners on week 1 (isLegacyWeek render)

**Audience:** learners already mid-curriculum, but only their *current* week's todos are gated. Prior weeks render via the `isLegacyWeek === true` path.

**Render contract** (per proposal §3.4 step 4 + §11.1): `isLegacyWeek` is true when `weekTodosInitialized[weekNumber]` is false — i.e. the learner completed that week under the old rules and we never recomputed it. The UI shows a "Completed under old rules" badge instead of a gate tile and the week card stays unlocked.

**Trigger:** flip flag to `true` for the cohort. On the next cold start, `practiceProgressStore.boot()` (or the equivalent lazy init on `getDashboard()`) seeds only the current week via the `weekTodosInitialized` gate. Prior weeks stay `weekTodosInitialized[N] = false` → `isLegacyWeek === true` → rendered as legacy, unlocked, badge visible.

**Why this matters:** this is the tier where we find out whether the `isLegacyWeek` rule actually reads correctly on real data. Anything that assumes "every week has todos seeded" will mis-render here.

**Watch for:**
- `isLegacyWeek` rendering correctly for all prior weeks on first launch after flip.
- `weekTodosInitialized` writes only happening on the current week (not on past weeks).
- No regression in the "completed under old rules" copy / badge for prior weeks.

**Time on this tier:** ~one more QA cycle (proposal §8 phase-37g step 3).

**Commit anchor for this tier:** TBD on promotion. Date stamp: TBD.

---

### Tier 4 — Full rollout: two options

Pick one. Both are valid; the decision is a product posture choice, not a technical one.

#### Option A — Flip default to true

- Edit `src/services/practiceProgressStore.ts` line 16: `export let todoFeatureEnabled = true;`
- Production builds ship with the gate on for every new install and every legacy learner.
- The dev menu flag flips become "temporarily disable for a QA session" rather than "turn it on for the first time."
- Migration concern: existing mid-curriculum learners wake up to a Week 1 gate tile + legacy badge for prior weeks. This was already validated in Tier 3.

**When to pick A:** the team is confident Tier 3 produced no field reports for at least one cycle, and Chris wants to remove the "dev menu only" mental model from production builds.

#### Option B — Keep default false, require explicit opt-in

- Default stays `false` in production.
- "Opt-in" mechanism: a first-launch one-time prompt, an in-app Settings toggle, or a Cohort selector on the dev menu.
- Pros: zero surprise for legacy learners; maximum reversibility; the gate can be A/B'd against control.
- Cons: extra friction; learners who want the new path have to know to look.

**When to pick B:** the team wants telemetry to compare gated vs ungated cohorts before committing the whole population. Or if Tier 3 surfaced a localized bug we want to patch without re-flipping the whole cohort.

#### Decision rule

Default to **Option A** unless Chris asks for an A/B hold. Option A is the path of least surprise once Tier 3 is green, and the dev menu still exists in `__DEV__` builds if we need to back out in a hurry.

**Commit anchor for Tier 4:** TBD on promotion (separate PR after the Tier 3 cycle closes). Date stamp: TBD.

---

## 2. Rollback plan

The flag is the only gate. Data is additive.

### Fast rollback (within a session)

```ts
// in a __DEV__ build, from the dev menu:
disableWeeklyTodos();
// or programmatically (e.g. emergency ship):
import { setTodoFeatureEnabled } from './src/services/practiceProgressStore';
setTodoFeatureEnabled(false);
```

Effect: every recorder early-returns on `if (!todoFeatureEnabled)`. Persisted state on disk is untouched. The Lessons tab + Home + Progress fall back to the legacy render. The `isLegacyWeek` path takes over for all weeks because `weekTodosInitialized[N]` stays `false`.

### Recovery for a learner whose todos already incremented

The flag is the only gate; data was written additively. To recover a learner who is "stuck" because their todos haven't completed yet:

**For new learners (Tier 2):**
1. Disable the flag globally (or for the cohort).
2. Verify the Lessons tab is back to legacy.
3. Either let the learner continue under legacy rules, or:
4. Re-enable the flag and have the learner complete the missing todos.

**For existing learners (Tier 3):**
1. Disable the flag. `isLegacyWeek` is true for all weeks automatically.
2. The learner resumes under the old rules. No data deletion required.

**Data repair:** if a recorder wrote bad JSON (corrupted blob) or wrong progress values:
- `practiceProgressStore.reset()` (per §11.5) wipes `todoStates`, `weekTodosInitialized`, `todoEventCounts` and re-seeds the current week from current `weeklyPlans.ts`.
- For a single learner, run `reset()` from the existing Reset-all-progress flow on Settings. Verified end-to-end by 37a tests.
- For a fleet-level wipe, ship a migration in a future phase that runs `reset()` server-side (not in scope for 37g).

### What we never do

- We never `git revert` a production commit just to disable the gate. The flag is the lever.
- We never delete `todoStates` rows unilaterally — they're additive. Disabled flag means "no new writes," not "wipe."

---

## 3. Monitoring — metrics to watch

These are the leading indicators for whether the gate is helping or harming retention/progression. None of these require new instrumentation; they map onto the §5 store methods + the analytics already exported.

| Metric | Source | Why it matters |
|---|---|---|
| Lesson completion rate | `completeCurrentLesson` call frequency vs cohort total | Did the gate slow lesson completion? Tier 2 expectation: roughly flat. Tier 3+: tolerance ±5%. |
| Weekly quiz pass rate | `recordQuizAttempt` events with `score >= 70` | If learners are failing the quiz three times to clear the gate, the §6.2 threshold is wrong. Tier 2/3 target: ≥ 90% pass within 2 attempts. |
| Daily Rush completion rate | `recordDailyRushComplete` event frequency vs lesson-day count | Did the daily-rush todo make Daily Rush feel mandatory rather than optional? Tier 2 target: at least one rush per week per active learner. |
| Example-sentences view rate | `exampleSentencesViewed` event count | Did the target=5 default (§11.2) feel like busywork? Watch for drop-off before sentence 5. |
| Daily Lesson next-week unlock time | `weekNumber` change in dashboard | How long from Week N's first lesson to Week N+1's first lesson? Tier 3 target: within the same calendar week for ≥ 70% of learners. |
| Flashcard Good-rate (kanji only) | `recordKanjiGood` events | Did the kanji todo make the marker harsher? Tier 2 watch: any spike in `kanjiGoodAnswers` after the flag flips on. |
| Crash rate (per cohort) | app-level telemetry on `record*` call sites | Any unhandled exception in the recompute path or `saveExtendedProgress` round-trip. Tier 2 expectation: zero crashes attributable to the flag. |
| `isLegacyWeek` render rate | telemetry on the badge render | All prior weeks on Tier 3 learners should render legacy badge. Any `isLegacyWeek === false` for a prior week means we wrote `weekTodosInitialized[N] = true` — bug. |

### Alert thresholds (Tier 2/3)

- Crash rate > 0.1% of sessions with the flag on → flip flag to off, write postmortem.
- Lesson completion rate drops > 15% week-over-week during Tier 3 → consider Option B (opt-in) for Tier 4 instead of Option A.
- Daily Lesson next-week unlock time increases > 2x the pre-flag baseline → re-evaluate §6 defaults.

---

## 4. What we're shipping (per proposal §11)

Locked-in v1 defaults — these match what 37b–37e already implemented.

| Section | Default | Rationale |
|---|---|---|
| §11.1 Gating strictness | **B. Hard block + preview** | Pairs cleanly with the `isLegacyWeek` render rule; QC round 1 flagged pure hard block as hostile to existing mid-curriculum learners. Next week's lessons are visible (read-only) but `Continue` is disabled with copy "Finish Week N's todos to unlock Week N+1." |
| §11.2 Per-kind thresholds | flashcards = pool size; daily-rush = 1; quiz = 1 attempt at ≥70% (best score wins); lesson = `lessonIds.length`; kanji = `kanjiSet.length`; example-sentences = 5 (placeholder, tunable per week) | `target` defaults via resolver `expectedTarget` fallbacks — authors can omit `target` on flashcards/kanji todos. |
| §11.3 Skip mechanism | **A. No skip for v1** | `skipped?: boolean` field exists in `TodoState` from day one so v2 can add XP-skip or attest-skip without a migration. |
| §11.4 Mid-week content edits | Accept asymmetry (existing todoStates stay; new todos appear at progress=0; removed todos are ignored) | Re-seeding is gated by `weekTodosInitialized[weekNumber]`. |
| §11.5 Reset | Wipe everything (`todoStates`, `weekTodosInitialized`, `todoEventCounts`) | Already implemented in `practiceProgressStore.reset()` per §6.5. |

## 5. What's deferred (not in v1)

- **XP-skip / attest-skip**: `skipped?: boolean` field exists; UI affordance does not. v2.
- **Per-todo `passThreshold` override**: store uses 70 default; the `WeekTodo.passThreshold` field is supported if added later but is not in `WeekTodo` yet. Trivial future extension.
- **§6.1 Option A (pure hard block) / C / D**: not chosen for v1. Option B is the gate.
- **§6.3 skip kinds B / C / D**: not chosen for v1. Option A (no skip) is the behavior.
- **Server-side fleet wipe**: out of scope for client-only app.
- **Telemetry hooks for the §3 metrics above**: instrumentation is the next phase after Tier 4 stabilizes.
- **A "Peek ahead" card on Lessons tab** (proposal §13.1 "Ideas for future work"): deferred.
- **2-day and 7-day spaced review of lesson vocabulary** (proposal §13.2): deferred. SRS exists; the gating is independent.

---

## 6. Date stamps and commit anchors

Fill these in as each tier actually ships. Today (Phase 37g merge) the only anchor is the baseline.

| Tier | Promoted on (date) | Commit hash | Tier duration |
|---|---|---|---|
| Baseline (Tier 0 — shipped off) | already shipped | `2867c1b` | n/a |
| Tier 1 — Dev menu only | merged with 37g | TBD-37g | indefinite |
| Tier 2 — New learners | TBD | TBD | ~one QA cycle |
| Tier 3 — Week-1 + isLegacyWeek | TBD | TBD | ~one QA cycle |
| Tier 4 — Full rollout (A or B) | TBD | TBD | permanent |

---

## 7. Cross-references

- `docs/phase-37-todo-gated-progression-proposal.md` §8 phase-37g — original rollout outline.
- `docs/phase-37-todo-gated-progression-proposal.md` §11 — proposed defaults (B / no-skip / per-kind targets).
- `docs/phase-37-todo-gated-progression-proposal.md` §3.4 step 4 — `isLegacyWeek` render rule.
- `docs/phase-37-todo-gated-progression-proposal.md` §5 — todo-kind progress rules.
- `src/services/practiceProgressStore.ts` — the flag itself (`todoFeatureEnabled`, `setTodoFeatureEnabled`, `isTodoFeatureEnabled`).
- `src/dev/featureFlagDevMenu.ts` — the helper wrapping `setTodoFeatureEnabled` with `console.warn` banners. Not auto-imported anywhere yet.
- `src/screens/SettingsScreen.tsx` — the dev section (dev-menu calls live here). `__DEV__`-gated; tree-shakes from release builds.
