# Tusk QC Report — User Profile Plan (Phase 28)

**Reviewer:** Tusk (QC authority)
**Inputs:** Beru pedagogical report + Igris engineering report + Belion integration
**Repo verified at:** `C:/Users/tophe/japanese-tutor-mobile-app`
**Date:** 2026-06-26

---

## Section 1: Codebase verification

All claims below were verified by reading source (not taken on faith).

| Claim from Igris | Verified? | Evidence |
|---|---|---|
| `src/repositories/` holds `sqliteLearningRepository.ts` + `inMemoryLearningRepository.ts` | ✅ | Listed; both files exist |
| `src/services/learningContext.tsx` exists | ✅ | 126 lines, exports `LearningRepositoryProvider` + `useLearningContext()` |
| `src/db/schema.ts` is the single source of truth for table DDL | ✅ | Exports `createTablesSql` const array, re-run on every boot |
| `src/services/keyValueStorage.ts` provides reusable async KV over `kv_preferences` | ✅ | Exports `createSqliteKeyValueStorage(db)` and `createInMemoryKeyValueStorage()` |
| `sqliteLearningRepository.initialize()` uses a migration pattern | ❌ | `initialize()` only re-runs `createTablesSql`; **no `schemaVersion` row, no migration table, no `(oldRow) => newRow` pipeline anywhere in `src/`** (grepped) |
| `onboardingPreferenceService.ts` exists and is the legacy adapter | ✅ | Key is literally `'japanese-tutor:onboarding-preference:v1'` — matches Igris's migration target |
| `LearnerLanguage` already exists in `src/types/onboarding.ts` | ✅ | Defined as `'en' \| 'vi' \| 'tl'` |
| `practiceProgressStore.completeCurrentLesson` is the lesson-completion write path | ✅ | Sole caller in `src/`; takes `(lessonId, score, date)` |
| SRS `review()` lives on `persistentSrsStore` (native) and `inMemorySrsStore` (web) | ✅ | Both wrappers delegate to `inner.review(...)` — injection point is clear |
| `learningContext.resetAll()` returns `{ srsRowsCleared: number }` today | ✅ | Will need to extend return shape to `{ srsRowsCleared, profileRowsCleared }` — trivial |
| `progressDashboardService` reads streak from `LearnerProgress` today | ✅ | `buildProgressDashboard(progress, lessons)` — `progress.streak.currentStreak`. Phase 2 swap is well-scoped |
| `studyPlanService` daily-minute granularity (existing) | ⚠️ | `studyPlanService` is **per-task** minutes (10/15/20/25/30); it does **not** have a 5/10/15/20 chip enum. Belion's C3 chose Beru's 2/5/10/15/30 chip labels — fine, but the plan needs to clarify these are chip **labels**, not coupled to `studyPlanService.buildDailyPlan` |
| `expo-notifications` is available | ❌ | **Not in `package.json` dependencies** — Phase 3 reminder work needs `expo install expo-notifications` before implementation |
| Vitest is the test runner | ✅ | `package.json` `"test": "vitest run"`, 50+ tests in `tests/` |
| No existing `ProfileScreen.tsx` | ✅ | `search_files` for `Profile\|profile` in `src/**/*.tsx` returned 0 — greenfield, no collisions |

---

## Section 2: Findings

### F1 — Schema migration pipeline is **invented**, not described [Red / P0]
**Claim:** "schemaVersion on the row. `userProfileRepository.initialize()` compares to `CURRENT_PROFILE_SCHEMA_VERSION` constant, applies pure `(oldRow) => newRow` migrations in order."
**Reality:** Grep for `schemaVersion`, `schema_version`, `migration` in `src/` → **zero hits**. No table, no constant, no migration runner exists. The existing boot path just re-runs `createTablesSql`; column additions have always been done by appending to that array (see Phase 22's `kv_srs_cards` add).
**Fix:** Pick one concrete pattern and write it down. Recommended: add a single `user_profile_schema_version(key TEXT PK, version INTEGER)` row, store payload as JSON in a single `user_profile(key TEXT PK, value TEXT)` row, and define `MIGRATIONS: ((old: any) => any)[]` constant with a `CURRENT = 1` for the v1 shape. Phase 1 only needs v1 — `MIGRATIONS = []` and `CURRENT = 1` — so "concrete migration pipeline" can be a Phase 2 enhancement rather than a Phase 1 deliverable, but the report must not pretend the pattern exists.

### F2 — Single-row, payload-as-JSON is OK but conflicts with the "split AsyncStorage for prefs" line [Yellow / P1]
Igris splits storage: identity+static+dynamic+meta go into a new SQLite `user_profile` table, but `preferences` go into the existing `kv_preferences` table under key `user-profile-preferences:v1`. The interface declares them under one `UserProfile` object, so `update(patch)` needs to merge across two storage backends atomically.
**Fix:** Document the merge semantics in the repo (`update` reads both, applies patch, writes both, returns merged object). Otherwise `editPreferences` followed by `editStatic` can race on web where the in-memory stores are independent `Map`s.

### F3 — XP-injection into `practiceProgressStore.completeCurrentLesson` will create a circular dep [Red / P1]
Igris's plan: "`practiceProgressStore.completeCurrentLesson` — gets an injected callback `userProfileService.recordStudyActivity({ xpGained: 10, lessonId })` after existing save."
**Reality:** Today `practiceProgressStore` is a 13-line file with zero imports from the user-profile stack. Injecting the callback at the call site (i.e., in the screen that calls `completeCurrentLesson`) is fine. Injecting it inside the store itself is not — it would make `practiceProgressStore` import `userProfileService`, which imports `userProfileRepository`, which is fine, **but** `learningContext.tsx` already constructs the store. The wiring then becomes `LearningRepositoryProvider` must also construct `userProfileService`, which the screens must consume via a sibling `UserProfileProvider`. That's exactly the layering Igris describes — fine.
**But:** the SRS `review()` injection point is inside `persistentSrsStore.review()` (line 84–88), which is **not** constructed with a callback parameter today. Adding `userProfileService` as a constructor arg to `createPersistentSrsStore` is a breaking change to the `LearningRepositoryProvider` wiring. The plan acknowledges this ("recordStudyActivity injected callback") but doesn't name the **breaking signature change** to `createPersistentSrsStore`.
**Fix:** Spell out: `createPersistentSrsStore(db, opts?: { onReview?: (rating) => Promise<void> })`. Default `onReview` is a no-op so existing tests stay green. Then `LearningRepositoryProvider` constructs both services and threads the callback in.

### F4 — `resetAll()` return shape extension is a quiet breaking change [Yellow / P2]
`LearningContextValue.resetAll` returns `{ srsRowsCleared: number }` (used by `SettingsScreen.doReset`). Adding `profileRowsCleared` is additive and non-breaking, but the type signature must be updated and the SettingsScreen summary string regenerated. Easy to forget.
**Fix:** Update both `learningContext.tsx` and `SettingsScreen.tsx` in the same Phase 1 commit.

### F5 — Legacy `onboardingPreferenceService` migration path is real but one-way [Yellow / P1]
Igris: "Legacy `kv_preferences: japanese-tutor:onboarding-preference:v1` migrates into profile row in Phase 1."
**Reality:** The key exists; the read path in `App.tsx` (line 152) goes through `createOnboardingPreferenceStore(storage).load()`. The migration is genuinely: on `userProfileService.load()`, if profile row missing AND kv_preferences row exists, seed the profile with `{ onboarded: pref.onboarded, nativeLanguage: pref.language, ...defaults }`, then delete the kv row. This is **destructive one-way** — no rollback.
**Fix:** Confirm with Chris that deleting the kv_preferences row after migration is acceptable. Add a one-line comment in the migration site: "Legacy kv_preferences row deleted post-migration; rerun triggers no-op." Don't store the legacy row indefinitely in `kv_preferences` — that defeats the purpose.

### F6 — Workplace discriminated union is well-formed but adds a sub-type [Yellow / P2]
Igris's integration decision C1: Beru's `workplace` field + Igris's 4-value `studyGoal` enum → discriminated union where `workplace` sub-type activates only when `studyGoal='workplace-survival'`.
**Concrete shape needed in the type:**
```ts
type StudyGoal = 'workplace-survival' | 'daily-conversation' | 'jlpt-prep' | 'travel-basics';
interface UserProfileStatic {
  studyGoal: StudyGoal;
  workplace: { industry: string; role: string; commonSituations: string[] } | null;
}
```
This is **simpler** than a true discriminated union and avoids type-narrowing gymnastics in the ProfileScreen UI. Recommend this over the union; document the invariant `studyGoal === 'workplace-survival' ⇒ workplace !== null` in a one-line comment.
**Fix:** Pick nullable + invariant comment over true TS discriminated union. Less surface area.

### F7 — Web parity is viable but the in-memory repo needs a `close()` no-op [Yellow / P3]
Igris plans `inMemoryUserProfileRepository` for "tests + web." Today `inMemoryLearningRepository` works the same way and the pattern is proven (`learningContext.tsx` line 64–71 branches on `Platform.OS === 'web'`). Fine.
**But:** the existing `learningContext` opens the SQLite db eagerly in the provider `useEffect`. The user-profile provider will need its own `Platform.OS` branch to skip SQLite on web. Just make sure the new provider's provider-tree nesting doesn't break the web fallback that already exists.
**Fix:** Mirror the existing `Platform.OS === 'web'` short-circuit exactly.

### F8 — `expo-notifications` not in deps [Yellow / P3]
Phase 3 (deferred) but flagged here: reminder time → `expo-notifications` will require `expo install expo-notifications` plus the iOS/Android notification permissions dance. Not a Phase 1 blocker, but Phase 3 entry criteria must include the install step.
**Fix:** Add `expo install expo-notifications` to the Phase 3 entry checklist in the plan.

### F9 — `LearnerProgress.streak` and `UserProfile.dynamic.streak` are two writers for one fact [Red / P1]
**Reality today:** `LearnerProgress.streak` is computed inside `progressService.completeLesson` from the lesson-completion history (greppable). `UserProfile.dynamic.streak` would be a *parallel* streak stored in the profile row. These can drift if XP is awarded from SRS `review()` but not from `completeCurrentLesson`, or vice versa.
**Igris acknowledges this:** "Phase 2 — Dashboard consolidation: `progressDashboardService` reads streak from `UserProfile` instead of `LearnerProgress`." Good — that means Phase 1 ships with **two** streak writers and Phase 2 collapses them.
**Fix:** Add a Phase 1 test that asserts the two streaks stay in sync after a `completeCurrentLesson` + `recordStudyActivity` pair. Otherwise Phase 2 will debug a phantom drift bug.

### F10 — Beru's "Workplace context (industry, role, commonSituations)" is unconstrained text [Yellow / P2]
The plan lets the learner type any string for `industry` / `role` / `commonSituations`. Without a controlled vocabulary or a max-length cap, this is an open input on a phone keyboard, which is a UX trap.
**Fix:** Either (a) make these enums with a curated list (e.g., `industry: 'manufacturing' | 'hospitality' | 'construction' | 'retail' | 'office' | 'other'`), or (b) cap input length (e.g., 40 chars) and explicitly mark the field "free text — optional." Pick one in Phase 1, don't punt.

### F11 — `studyGoal` enum divergence: 'workplace-survival' vs 'workplace' [Yellow / P3]
Igris's enum uses `'workplace-survival'`; Beru's section 2 uses `'workplace'`. The C1 integration says Beru's "rich workplace field + Igris's 4-value enum" — i.e., the enum values come from Igris. But the report never explicitly states `'workplace'` is dropped. Pick one.
**Fix:** State in the type comments: `// 'workplace-survival' replaces Beru's draft 'workplace'.`

### F12 — Open questions for Chris are real blockers but mostly non-critical [Green / P2]
JLPT thresholds (Q1), goal taxonomy (Q2), XP yes/no (Q4), and goal-change side effect (Q5) are all open. None are Phase 1 blockers:
- JLPT thresholds are only consumed by the JLPT progress bar (Phase 2).
- Goal taxonomy: `'jlpt-prep' + targetLevel: 'N4'` vs `'jlpt-n4-prep'` — design call, can ship Phase 1 with the looser form and tighten later.
- XP yes/no: if Chris says no, **delete the field from the type**; if yes, wire the +10/+2/+3 injection. Either way, Phase 1 should ship without XP recording and add it when Chris decides.
- Goal-change side effect: Phase 1 doesn't ship GoalUpdateScreen, so it's a Phase 2 design call.

**Fix:** Don't block Phase 1 on these. Put them on the Phase 2 checklist with explicit owner.

### F13 — No `ProfileScreen` stub is risky if storage can't be opened [Yellow / P2]
The existing `LearningRepositoryProvider` falls back to in-memory stores if SQLite open fails (`learningContext.tsx` lines 90–98). The user-profile provider must mirror this exact fallback pattern, otherwise a SQLite boot failure would also break the Profile screen **and** the "Reset" affordance because the user-profile row would never exist.
**Fix:** Copy the `try/catch → in-memory fallback` pattern verbatim from `learningContext.tsx`. Add a comment: "User profile must always be readable; a SQLite failure must not block the Profile screen."

---

## Section 3: Score

**87 / 100**

Calibration:
- Phase 25 (persistent SRS): 80/100
- Phase 26 (Sensei content review): 84/100

This plan is more thorough than both — it names concrete file paths, defines both repository and service interfaces, identifies circular-dep risk in the XP-injection call site, and surfaces open questions explicitly. It loses points for F1 (invented migration pipeline), F3 (signature break on `createPersistentSrsStore` not named), and F9 (two streak writers without a sync test). None of these are Phase 1 ship-stoppers if the fixes in this report are applied.

---

## Section 4: Final verdict

# **APPROVED WITH CONDITIONS**

Phase 1 may proceed **only after** the following P0/P1 conditions are met in the plan (not necessarily in code yet, but the plan must commit to them):

### P0 (must address before Phase 1 implementation starts)
1. **F1:** Replace the aspirational "schemaVersion + `(oldRow) => newRow` migrations" paragraph with a concrete v1 plan: single `user_profile(key, value)` row + JSON payload, `CURRENT_PROFILE_SCHEMA_VERSION = 1` constant, `MIGRATIONS = []`. Migration pipeline is a Phase 2 deliverable.
2. **F9:** Add a Phase 1 test name: "user-profile streak stays in sync with LearnerProgress.streak after completeCurrentLesson." Two writers, one test.

### P1 (must address before Phase 1 ships)
3. **F3:** Spell out the breaking signature change to `createPersistentSrsStore(db, opts?: { onReview?: (rating) => Promise<void> })`. Default `onReview` is a no-op so existing tests stay green.
4. **F2:** Document the atomicity contract for `update()` and `editPreferences()` across SQLite `user_profile` + `kv_preferences` partitions. One paragraph in the repo header comment.
5. **F5:** Confirm deletion of legacy `kv_preferences: japanese-tutor:onboarding-preference:v1` after migration is acceptable. Add the one-line migration-site comment.
6. **F13:** User-profile provider must mirror the SQLite-open-fail → in-memory fallback from `LearningRepositoryProvider`. Add a sentence to the Phase 1 task list.

### P2/P3 (track, don't block)
- F4, F6, F7, F8, F10, F11, F12 — add to Phase 2/3 entry checklists.

**Score: 87/100. Verdict: APPROVED WITH CONDITIONS.**
