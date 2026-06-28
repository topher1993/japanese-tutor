# Phase 22 — Independent Engineering Audit Report (Phase 1)

**Date:** 2026-06-25
**Orchestrator:** Belion (MiniMax M3)
**QC Authority:** GPT-5.5 (via openai-codex provider, Codex Plus subscription)
**Engineering Division:** MiniMax M3 (subordinate to Belion)
**Verdict:** ❌ **NOT APPROVED**
**Score:** 47 / 100
**Phase:** Phase 1 — Read-only audit (no implementation in this phase)

---

## ROLE SEPARATION (verified per BELION DIRECTIVE)

| Role | Model | Status |
|---|---|---|
| Orchestrator | MiniMax M3 (Belion) | ✅ Used for routing, manifest building, dispatch |
| Engineering | MiniMax M3 | ✅ Did NOT review or approve; only built infrastructure |
| **QC Authority** | **GPT-5.5** (openai-codex) | ✅ Rendered every verdict in this report |

Routing verified by smoke test: `hermes -p default -m openai-codex/gpt-5.5 -z "..."` returned `CODEX_ROUTING_OK`.

---

## 1. EXECUTIVE SUMMARY

The Japanese Tutor app is a React Native + Expo SDK 54 build with a well-organised service layer (3,200 LOC of authored content, 296 passing tests, a SQLite repository scaffold) **whose screens never reach that layer at runtime**. Onboarding is silently discarded on cold start; learner progress, completed lessons, streaks, and SRS state all live in React `useState` and reset every cold start; no deterministic spaced-repetition scheduler surfaces in the navigation; bottom-tab labels mix temporal, activity, and meta metaphors.

The skeleton is the right shape — small, purposeful component kit (`ScreenHeader`, `StreakFlame`, `ProgressRing`, `FlipCard`, `TabBar`), coherent design tokens, a tested repository layer waiting to be wired. The wiring is what's missing. Engineering has built UI shells and content packs but stopped short of the integrations that turn a content browser into a tutor.

Four P0 blockers gate this release: P0-01 onboarding storage returns undefined on React Native; P0-02 the SQLite repository is built but never imported by any screen; P0-03 no SRS scheduler surfaces in the app; P0-04 bottom-tab labels are incoherent. Five P1 issues follow (responsive width cap, no QA reset affordance, monolithic content bundle, dev-only query-param shell escape hatches, no dependency vulnerability scan). All are tractable in a single engineering phase because the scaffolding exists.

The dominant risk is qualitative, not cumulative: a learner who picks Vietnamese gets reset to English on every cold start, which is worse than a crash because it is silent. Until P0-01 and P0-02 ship, this app is a content browser that forgets everything — and a learning app that forgets everything does not deliver its core promise. Architecture is sound; UX is consistent; pedagogy is correct in shape but empty of a scheduler; tests measure the suite, not the product. **Production Readiness Score: 47 / 100. Verdict: NOT APPROVED.** Re-audit after the four P0s and the five P1s close against on-device integration tests.

---

## 2. ARCHITECTURE REPORT

**Layering:** Three layers are visible — presentation (`src/screens/*`, `src/components/*`), application services (`src/services/*`), and a data/repository layer (`src/data/`, `src/db/`). The seams are correct. Screens do not import SQLite directly; they would (when wired) consume services, which delegate to the repository. This is the right pattern for a small offline-first app and matches the offline-first product contract.

**Service surface:** `preferenceStore`, `practiceProgressStore`, `appNavigationService`, `onboardingPreferenceService` are well-named and single-purpose. The factory pattern in `createBrowserOnboardingStorage()` advertises intent — it is the implementation that contradicts the name (see P0-01). `appNavigationService` is the right home for tab/screen constants; it is correctly factored.

**Repository layer:** `PersistentLearningRepository` plus a separate schema file exists. Schema files decoupled from runtime migrations is the conventional SQLite-on-React-Native shape. The repository was scaffolded and tested in earlier phases but never imported at the App.tsx level — which means the screens that should read/write learner state have no path to it. This is a **wiring gap, not an architecture gap.**

**Content vs. code separation:** 3,200 LOC of literal candidate content lives in TS source files. This is a bundling choice, not an architectural defect, but it does mean that an N5 learner carries N4/N3/N2 content in the JS payload (P1-07). Moving per-level content to JSON assets loaded via `expo-asset` would not change the architecture; it would change the build artifact.

**Navigation:** A single discriminated-union-ish navigation state (`tab`, `screen`, `showFeedback`, `showSources`) plus onboarding co-variates. Five `useState` calls in App.tsx are arguably two pieces of state split five ways (P2-12). A `useReducer` or a state object would clarify without changing runtime behaviour.

**What the architecture does NOT include:** no backend, no auth, no sync layer, no analytics, no crash reporting. None of these are blockers for a beta. A learning app at this scope does not need them; production hardening would add Sentry (P4-20) and a crash-free-rate SLO, but they are not P0.

**Overall:** The architecture is the right one for the product. It is a small offline-first React Native app with a clean three-layer split and a service layer that names things honestly. The failure mode is not architectural — it is operational. **The seams exist; the wiring across them does not.**

---

## 3. CODE QUALITY REPORT

**Naming:** Service names are honest (`practiceProgressStore`, `appNavigationService`). Token names are consistent (`ds.colors.brand`, `ds.spacing.md`, `ds.touch.min`). The one exception is `createBrowserOnboardingStorage`, which lies about its native-runtime behaviour (P3-15). Component names are descriptive and not over-abstracted.

**Component discipline:** `ScreenHeader`, `StreakFlame`, `ProgressRing`, `FlipCard`, `Button`, `TabBar` form a small, purposeful kit. `FlipCard` at 168 lines is the largest component; it sits at the edge of size discipline but is acceptable for an animated component (P2-14). Extracting Reanimated shared-value plumbing into a `useFlipAnimation` hook would be a clean refactor, not a structural one.

**State management:** Five `useState` calls in `App.tsx` could be a discriminated-union state object (P2-12). Two are navigation flags, two are co-varying onboarding flags, one is a per-flow modal flag. None of this is broken; it is simply more verbose than it needs to be. The fix is mechanical and has zero behavioural risk.

**Token discipline:** `colors.primary` and `colors.brand` are duplicates (`#2A6F97`); `primarySoft` and `brandSoft` are duplicates (`#E0F2FE`). Drift risk on future updates (P2-11). Pick one set — recommend `brand.*` — and deprecate the aliases.

**Test discoverability:** Test files named by engineering phase (`phase4*`, `phase7*`, `phase21*`) instead of by feature (P2-10). 296 green tests is a strong signal about the test suite; it is a weak signal about the product because the unwired persistence layer is the test suite's own layer.

**Test-as-quality-proxy:** This is the single most important quality finding of this audit. 296 passing tests on a feature that is not wired to any screen is a measurement of the test runner, not the product. Engineering must add at least one end-to-end cold-start persistence test (per P2-10's reorganisation) and one SRS integration test before re-audit.

**Code health overall:** Sound. No dead code, no obvious smells, no premature abstractions. The codebase reads as a small app that has been kept tidy. The problem is not code quality — it is **integration coverage**. The parts that exist are well-built; the parts that connect them are missing.

---

## 4. SECURITY AUDIT

**Threat surface:** This is an offline-first single-player learning app with no backend, no auth, no network egress, no third-party data collection. The threat surface is correspondingly small. The relevant risks are local-data integrity and dev-only escape hatches, not adversarial attack vectors.

**Local data integrity:** AsyncStorage / SQLite on-device storage is unencrypted by default. For a learning app storing completed-lesson counts and SRS state, this is acceptable — there is no PII, no auth token, no payment data. The SQLite repository layer follows the standard local-only pattern. If a future iteration adds account sync or paid content, encryption-at-rest (Keystore on Android, Keychain on iOS) becomes a P1; today it is N/A.

**Onboarding storage:** `createBrowserOnboardingStorage()` returns `undefined` on React Native. This is not a security defect per se — it is a silent no-op (P0-01). A silent no-op is worse than a loud crash because it is invisible to QA. The fix is platform-branch the factory; no security primitive needs to change.

**Query-param shell escape hatches:** `App.tsx` reads `?tab=`, `?screen=`, `?skipOnboarding=1`, `?onboarding=` unconditionally in production (P1-08). This is a low-severity integrity concern: a malicious or accidental deep link can force the user past onboarding or jump to a feedback modal. The fix is a 2-line `if (__DEV__) { ... }` gate. No credential exposure, no privilege escalation — the worst case is "user lands on the wrong screen" and then the next interaction corrects it.

**Dependency hygiene:** No automated dependency vulnerability scan in the pipeline (P1-09). For an Expo SDK 54 + Reanimated 4 + Worklets 0.5 stack, transitive dependency churn is real. Add `npm audit --omit=dev` to the release checklist; pin Reanimated/Worklets/Expo versions in lockfile.

**Permissions:** No runtime permission requests visible — no camera, no microphone, no location, no contacts, no notifications. This is correct for a learning app at this scope and avoids the permission-fatigue anti-pattern.

**Privacy:** No analytics, no crash reporting, no third-party SDKs that phone home (P4-20). For a beta this is acceptable; for production hardening, add Sentry or equivalent with an opt-out flag.

**Summary:** Security posture is acceptable for a beta. The one production-grade concern is the dev-only query-param shell escape hatches (P1-08). The one hygiene concern is the missing dependency vulnerability scan (P1-09). Neither blocks a beta; both should close before production.

---

## 5. PERFORMANCE AUDIT

**Cold start:** Cannot measure from manifest. After persistence is wired (P0-02), repository initialisation must be lazy — `useEffect` with a splash fallback, never synchronous in render. Today's `App.tsx` reads `preferenceStore.load()` in render which is fine for a single key but must not be the pattern for the SQLite-backed `practiceProgressStore`. A splash screen branch while the repo initialises is required (P2-13). Target: < 1500 ms JS-init-to-first-paint on a mid-tier Android (Pixel 4a class). No measurement on a real device today (P3-18).

**Frame rate:** `FlipCard` uses Reanimated 4 + Worklets 0.5 worklets for the flip animation. Worklets run on the UI thread, so JS-thread blocking should not drop the flip animation. Cannot measure without a device. The Reanimated 4 stack is young; any 4.x-to-5.x jump must be regression-tested on device.

**Bundle size:** 3,200 LOC of literal candidate content in the JS payload (P1-07). For a phone with a 30 MB JS bundle target, this is meaningful — split per-JLPT-level JSON files loaded via `expo-asset` will reduce the initial download by roughly (N-1)/N where N is the number of JLPT levels the app targets. Measure with `npx expo export` + `du -sh dist/`.

**API efficiency:** N/A (no backend).

**Memory:** Holdover concern — if SQLite is wired without bounding the practice history table, the progress dashboard query will eventually scan a long history. Add a retention policy (e.g. keep 365 days of completed lessons; archive older).

**Startup:** `App.tsx` does synchronous JSON parsing in render via `preferenceStore.load()`. For a single key, this is fine. After wiring SQLite, **must** lazy-init the repository off the critical path (await in `useEffect`, render a splash).

**DB queries:** Schema file exists but is unused at runtime. When wired, ensure index on `(lessonId, completedAt)` for dashboard queries.

---

## 6. UX AUDIT

**UI consistency:** Tokens look consistent. Card-style containers, pill CTAs, soft shadows, primary blue + warm orange + green/danger accents — these read as a deliberate system. Confirmed via design tokens.

**Responsiveness:** `maxWidth: 360, alignSelf: 'center'` on the root and body containers. **This is a problem.** On a 390–430 px iPhone, 360 px screens get centred with grey margins — that is "looks like a phone app on a phone" and is also wrong on Android where widths vary more (small Androids are 360 dp wide; this will eat all horizontal real estate). Either remove the cap entirely or apply it only via a media-query-style check (e.g. only constrain on tablets/large foldables via `useWindowDimensions`). On Android Go-class devices this also gives a cramped feel.

**Accessibility:** Not assessed from manifest. Check that all `Button` components set `accessibilityRole`, `accessibilityLabel`, and that touch targets meet the 48 dp minimum (the token `ds.touch.min: 48` is correct in intent). Verify with TalkBack / VoiceOver on device.

**Component structure:** Sound. `ScreenHeader`, `StreakFlame`, `ProgressRing`, `Button`, `FlipCard`, `TabBar` form a small, purposeful kit.

**State management:** Five `useState` calls in App.tsx that overlap conceptually (Belion's flag #2 is correct). Two of them are "navigation flags" (`tab`, `showFeedback`, `showSources`) that should be one discriminated union. `onboarded` and `supportLanguage` are co-varying and could be one state object. Worth refactoring but secondary to the persistence bugs.

**User journeys:**
- **Onboarding: BROKEN** (see P0-01). Learner completes onboarding → app backgrounded → cold start → forced through onboarding again.
- **Lessons:** Likely works in-session; not assessable from manifest.
- **Quizzes:** Score computed, not persisted (see P0-02).
- **Review:** No "Review" tab; SRS review queue not visible in `appNavigationService.ts`. Either intentionally hidden (acceptable) or never built (problem).
- **Progress:** Dashboard built from in-memory state — resets every cold start (see P0-02).
- **Settings:** No settings screen visible in navigation. Acceptable for MVP if documented; a "Reset progress" affordance is still needed for QA testing.
- **Navigation:** `bottomTabs` mismatch — see P0-04.
- **Error handling:** Cannot assess. Look for boundary error states in screens.
- **Friction:** Onboarding multi-step but no skip-on-error recovery visible.

---

## 7. JAPANESE LEARNING AUDIT

**Lesson progression:** Content density (3,200 LOC of candidate data) suggests serious authoring effort. Without a per-level manifest I cannot verify that progression exists beyond "tap the next lesson card."

**Pedagogy:** The 4-pane UX (Home / Lessons / Flashcards / Quiz / Progress) is a textbook spaced-practice structure. This is correct. But the **structure is empty** — spaced repetition requires a deterministic scheduler that the app can show the learner. From the manifest, no SRS engine surfaces in the navigation or in the candidate data files. This is a content-and-test app, not yet a tutor.

**Retention:** A learner needs to come back. Without persistence, no streak can survive a cold start. Without an SRS scheduler that re-surfaces weak items, flashcards will be a random walk through a static deck.

**Spaced repetition:** **Not implemented in any visible way.** No `srsService`, no `sm2Algorithm`, no `leitnerBox`. If candidate data files include SRS metadata it is unused at runtime. **P0.**

**Review flow:** No review surface in navigation. The user has no path to "show me the items I got wrong yesterday." **P0.**

**Learner motivation:** StreakFlame exists as a component (good signal). StreakFlame's underlying counter cannot persist — so the streak will read 0 on every cold start. This will *demotivate* rather than motivate. **Critical.**

**Educational effectiveness:** Cannot score without runtime evidence. The skeleton is the right shape; the wiring is missing.

**Feedback quality:** Quiz screens presumably show correctness feedback in-session. No claims either way from manifest.

---

## 8. TECHNICAL DEBT REPORT

| ID | Title | Priority |
|---|---|---|
| TD-01 | SQLite persistence layer implemented, tested, and not wired at runtime. Highest-impact debt — the scaffolding exists, the wiring doesn't. | P0 |
| TD-02 | `createBrowserOnboardingStorage()` returns `undefined` on React Native, silently dropping onboarding preferences. The factory name suggests intent but the implementation does not match. | P0 |
| TD-03 | No SRS scheduler surfaced. Either hidden or unbuilt. | P0 |
| TD-04 | Test files named by engineering phase (`phase4*`, `phase7*`, `phase21*`) instead of by feature. Discoverability degrades as phase count grows. | P2 |
| TD-05 | `colors` token duplication (`primary`/`brand`, `primarySoft`/`brandSoft`). | P3 |
| TD-06 | App.tsx `maxWidth: 360` cap misaligned with target device widths. | P2 |
| TD-07 | Five `useState` calls in App.tsx could be a discriminated-union state object. | P3 |
| TD-08 | 3,200 LOC of literal candidate content in the JS bundle — content-splitting deferred. | P2 |
| TD-09 | No "Reset progress" QA affordance visible. | P2 |
| TD-10 | Query-param-driven shell (tab, screen, onboarding, skipOnboarding) is convenient for QA but undocumented and not gated. | P3 |

---

## 9. ISSUE TRACKER

### ─── P0 BLOCKERS (gate release) ───

#### **P0-01** — Risk: Red · Priority: P0
**Title:** Onboarding preference is silently discarded on React Native runtime
**Description:** `createBrowserOnboardingStorage()` returns `undefined` when `window` is absent. `App.tsx` constructs `createOnboardingPreferenceStore(undefined)`, which makes `save()` and `load()` no-op. The learner finishes onboarding, the OS reclaims the process, and the next cold start forces the learner through onboarding again with the default language.
**Root cause:** The factory's name advertises a browser contract but no equivalent native adapter is provided or selected. `App.tsx` does not branch on platform.
**Recommendation:** Provide a `createNativeAsyncStorageAdapter()` backed by `@react-native-async-storage/async-storage` (or an in-memory adapter with `expo-sqlite`), and select the right one in `App.tsx` based on `Platform.OS`. Do not silently no-op — if no adapter is available, surface a runtime warning in dev and a non-blocking error toast in prod.
**Implementation:** Add `src/services/onboardingPreferenceService.ts:createNativeAsyncStorageAdapter()`; in `App.tsx`, replace `createBrowserOnboardingStorage()` with a `getOnboardingStorage()` that branches by `Platform.OS` and falls back to AsyncStorage.

#### **P0-02** — Risk: Red · Priority: P0
**Title:** Learner progress, completed lessons, streaks, and SRS state are not persisted
**Description:** `src/services/practiceProgressStore.ts` exists and delegates to `PersistentLearningRepository` (SQLite-backed), but no screen or App.tsx imports it. Completion of a lesson writes to in-memory React state; the next cold start shows zero completed lessons, zero streak, full SRS queue.
**Root cause:** The repository layer was scaffolded and tested in earlier phases but never wired into the screens (LessonsScreen, FlashcardsScreen, QuizScreen, ProgressScreen).
**Recommendation:** Wire `practiceProgressStore` into the lesson-complete, quiz-submit, and flashcard-review flows. Initialise the repository once at app start (lazy, off the critical path) and pass the store through React context. ProgressScreen should read from the store, not from local component state.
**Implementation:** Add a `LearningRepositoryProvider` at the App.tsx level; have `LessonsScreen`, `FlashcardsScreen`, `QuizScreen`, `ProgressScreen` consume the store via `useContext`. Call `repo.initialise()` in a `useEffect` with a splash fallback. Add an integration test that completes a lesson, force-restarts the store (re-import the module), and asserts the dashboard shows the completed lesson.

#### **P0-03** — Risk: Red · Priority: P0
**Title:** No deterministic SRS scheduler is wired
**Description:** For a learning app this is the single most-cited lever for retention (Ebbinghaus, Anki, Wanikani). The manifest contains no `srsService`, no `leitnerBox`, no `sm2Algorithm`, no per-item `dueDate` in the candidate data, and no review queue surfaced in the navigation. Flashcards, if they exist, are a static deck.
**Root cause:** Engineering phases appear to have built UI shells and content packs but the scheduler was either deferred or not in scope.
**Recommendation:** Implement a minimal Leitner/SuperMemo-style scheduler in `src/services/srsService.ts` that takes (item, rating) and returns (nextDueAt, newBox). Store per-item SRS state in the SQLite layer (P0-02's repository). Add a "Review" entry point that surfaces due items ahead of new content.
**Implementation:** Add `srsService.createScheduler()`; persist `srsState` keyed by `(learnerId, itemId)` in the repository; add a `getDueItems(now)` query; add a 6th bottom tab or a Home-screen CTA "X items due for review."

#### **P0-04** — Risk: Yellow · Priority: P0
**Title:** Bottom-tab labels mix metaphors (temporal / activity / meta)
**Description:** `appNavigationService.bottomNavigationTabs` returns: "Today" (temporal), "Learn" (activity), "Practice" (activity), "Test" (activity), "Progress" (meta). Learners must remember which screen does what; "Test" in particular reads as anxiety-inducing and is not the same as quiz-as-self-check.
**Root cause:** Authorial, not technical.
**Recommendation:** Standardise on activity verbs (e.g. "Home / Lessons / Flashcards / Quiz / Progress") or on nouns (e.g. "Today / Library / Cards / Quiz / Stats"). Pick one and apply uniformly. If "Today" is intentionally distinct from "Lessons" because it surfaces a daily plan, document that contract.
**Implementation:** Update `bottomNavigationTabs` in `appNavigationService.ts`; ensure `AppTab` type still maps. No screens need renaming since they are file-based.

### ─── P1 HIGH (fix in same release cycle) ───

#### **P1-05** — Risk: Yellow · Priority: P1
**Title:** App.tsx root width cap of 360 dp misaligned with target devices
**Description:** `styles.app.maxWidth: 360` and `styles.body.maxWidth: 360` centre the entire app with grey gutters on every phone wider than 360 dp. On a 393 dp iPhone 14/15 this leaves 16.5 dp on each side. On a 412 dp Pixel 7 the gutter is 26 dp. On a 360 dp Android Go device the cap matches the device width perfectly.
**Root cause:** Likely intended for a "phone-mockup-on-tablet" aesthetic. But the app is targeted at phones and there is no tablet-specific layout shipped.
**Recommendation:** Remove the cap on phones. If a tablet layout is desired, gate the cap on `useWindowDimensions().width >= 600` (tablet/foldable breakpoint).
**Implementation:** Update `styles.app` and `styles.body` in `App.tsx` to drop `maxWidth` and `alignSelf: 'center'`. Add a tablet branch (tablet → 600 dp cap, phone → no cap).

#### **P1-06** — Risk: Yellow · Priority: P1
**Title:** No "Reset progress" affordance for QA or learner agency
**Description:** Without persistence (P0-02) reset is the default; once persistence lands, QA cannot re-test the cold-start path without uninstall+reinstall. Learners cannot start over without OS-level data wipe.
**Root cause:** Settings/Profile surface not built.
**Recommendation:** Add a minimal Settings screen (modal-style, accessible from Progress or Home) with a "Reset all progress" action gated behind a confirm dialog.
**Implementation:** Add `src/screens/SettingsScreen.tsx`; add a button in `ProgressScreen` footer. Call `repo.clearAll()` then reload the store.

#### **P1-07** — Risk: Yellow · Priority: P1
**Title:** Bundle ships full candidate content to every learner regardless of JLPT target
**Description:** 3,200 LOC of literal data in `src/data/candidates/*Data.ts` is bundled into the JS payload. An N5 learner carries N4/N3/N2 content they will never see.
**Root cause:** Content lives in TS source files, not separate JSON/asset files.
**Recommendation:** Split per-JLPT-level JSON files under `assets/content/<level>.json`, load with `expo-asset` + `require()` (Metro supports JSON natively) or `fetch()` from the app bundle. Or use dynamic `import()` per level. Measure with `npx expo export` + `du -sh dist/`.
**Implementation:** Convert candidates to per-level JSON, replace direct imports with a `contentService.getLevel(level)` that lazy-loads.

#### **P1-08** — Risk: Yellow · Priority: P1
**Title:** Query-param shell escape hatches (`?tab=`, `?screen=`, `?skipOnboarding=1`) ship in production
**Description:** `App.tsx` reads `params.get('tab')`, `params.get('screen')`, `params.get('skipOnboarding')`, `params.get('onboarding')` unconditionally. In production this means a malicious or accidental deep link can force the user past onboarding, jump to a feedback modal, etc.
**Root cause:** Convenience for QA never gated behind `__DEV__`.
**Recommendation:** Gate query-param interpretation behind `__DEV__`. In production, ignore all query params and rely solely on persisted state + push notifications for deep links (none today).
**Implementation:** Wrap the param-reading block in `if (__DEV__) { ... }`; in production branch, default to the persisted tab and `screen: null`.

#### **P1-09** — Risk: Yellow · Priority: P1
**Title:** No automated dependency vulnerability scan in the pipeline
**Description:** Cannot verify from manifest. For an Expo SDK 54 + Reanimated 4 + Worklets 0.5 stack, transitive dependency churn is real.
**Root cause:** No CI configuration visible.
**Recommendation:** Add `npm audit --omit=dev` to a release checklist. Optionally add `osv-scanner` or `snyk test` to CI. Pin Reanimated/Worklets/Expo versions in lockfile.
**Implementation:** Add a `scripts/audit.sh` and document the cadence.

### ─── P2 MEDIUM (next phase) ───

| ID | Title | Recommendation |
|---|---|---|
| P2-10 | Test files organised by engineering phase, not feature | Reorganise tests by feature surface: `tests/onboarding/`, `tests/lessons/`, `tests/srs/`, `tests/progress/`, `tests/persistence/`. Keep `tests/_meta/` for cross-cutting invariants. |
| P2-11 | `colors.primary` and `colors.brand` are duplicates | Pick `brand.*` and remove aliases; document rename. |
| P2-12 | App.tsx has 5 separate `useState` calls where a reducer or state object would be clearer | Replace navigation state with `{ tab, modal }` and onboarding state with `{ onboarded, language }`. |
| P2-13 | No "Splash" / loading state during async repository initialisation | Add `Splash` screen branch while repo initialises; gate main shell on `repoReady`. |
| P2-14 | `FlipCard` at 168 lines is at the edge of component-size discipline | Extract Reanimated shared-value plumbing to `src/hooks/useFlipAnimation.ts`. |

### ─── P3 LOW ───

| ID | Title | Recommendation |
|---|---|---|
| P3-15 | `createBrowserOnboardingStorage` name misleading | Rename to `createLocalStorageOnboardingStorage` or `createWebOnboardingStorage`. |
| P3-16 | No `accessibilityRole` / `accessibilityLabel` audit performed | Add props to `Button`, `TabBar`, `FlipCard`. Test with TalkBack/VoiceOver. |
| P3-17 | No SQL retention policy on the (future) practice history | Add `purgeOlderThan(date)` to repo; call on app start. |
| P3-18 | No measurement of cold-start time, frame rate, or memory on a real device | Add `device-qa/` check with `Performance.now()` from JS init to first paint; target < 1500 ms on Pixel 4a. |

### ─── P4 INFORMATIONAL ───

| ID | Title | Note |
|---|---|---|
| P4-19 | iOS TestFlight blocked — acknowledge as an external dependency | Add `KNOWN_LIMITATIONS.md` entry. |
| P4-20 | No analytics / no crash reporting | Acceptable for beta; add Sentry for production. |

---

## 10. CHANGE HISTORY

| Timestamp | Action | Result |
|---|---|---|
| 2026-06-25 13:35 | Phase 22 audit initiated | Manifest built; QC routed via Codex |
| 2026-06-25 13:36 | Baseline tests verified | 296/296 ✅ |
| 2026-06-25 13:40 | Dispatched audit brief to GPT-5.5 | Response: 300 lines (sections 6-13) |
| 2026-06-25 13:50 | Dispatched continuation to GPT-5.5 | Response: sections 1-5 (verified file path consistency) |
| 2026-06-25 14:00 | Consolidated report | This document |

---

## 11. REMAINING RISKS

1. **Silent-data-loss risk** — Even if P0-01 and P0-02 ship, any future code that touches onboarding or persistence must regression-test the cold-start path. The cost of a regression here is qualitative: a learner who loses progress on every cold start churns out.
2. **No integration test gate** — 296 unit tests do not catch the unwired-persistence defect. Without on-device integration tests in CI (or a documented device-QA gate), a future phase can regress persistence without any red signal.
3. **Content-bundle growth** — P1-07 is P1 because the bundle will only get larger. Each new JLPT level adds 600+ LOC of literal data.
4. **Reanimated 4 stack youth** — Reanimated 4 + Worklets 0.5 are recent. A minor version bump can break the flip animation; pin versions in lockfile and document regression test on upgrade.
5. **Query-param shell escape** — P1-08 is a "tidy up" fix; left in place it is an integrity concern, not a security breach. Document as known limitation if not fixed before next beta.

---

## 12. PRODUCTION READINESS SCORE

| Dimension | Weight | Score | Weighted |
|---|---|---|---|
| Architecture & modularity | 10 | 60 | 6.0 |
| Code quality & maintainability | 10 | 80 | 8.0 |
| Security | 5 | 85 | 4.25 |
| Performance | 5 | 70 | 3.5 |
| UX consistency & responsiveness | 10 | 65 | 6.5 |
| Accessibility (unverified) | 5 | 50 | 2.5 |
| Japanese learning effectiveness | 20 | 30 | 6.0 ← gated by P0-03 (no SRS) |
| Persistence & data integrity | 15 | 10 | 1.5 ← gated by P0-01 / P0-02 |
| Tests as a quality signal | 10 | 75 | 7.5 ← 296 pass, but features untested |
| Documentation | 5 | 80 | 4.0 |
| Tech debt management | 5 | 60 | 3.0 |
| **TOTAL** | **100** | | **52.75 → 47** |

**Production Readiness Score: 47 / 100** (penalised below weighted average for the qualitative severity of the persistence gap — losing learner progress on every cold start is a product-defeating defect, not a maintainability problem).

---

## 13. FINAL VERDICT

# ❌ NOT APPROVED

Four P0 findings gate this release:

1. **P0-01** — Onboarding preference storage returns `undefined` on React Native; preference is silently discarded on every cold start. Data loss.
2. **P0-02** — Learner progress, completed lessons, streaks, and SRS state are not persisted. The SQLite layer is built but never wired. Every cold start is a fresh learner with zero history.
3. **P0-03** — No deterministic SRS scheduler surfaces in the app. This is a learning app; without a scheduler that re-surfaces due items, the product does not deliver its core promise of retention.
4. **P0-04** — Bottom-tab labels mix temporal / activity / meta metaphors and must be unified.

These four are tractable in a single engineering phase because (a) the SQLite repository already exists, (b) the onboarding service already exists, and (c) the bottom-tab list is a 5-line constant. The engineering lift is wiring, not building.

### Conditions for re-audit (Phase 23)
- P0-01, P0-02, P0-03, P0-04 verified by integration test on device (not just unit tests).
- P1-05, P1-06, P1-07, P1-08, P1-09 closed or have a documented deferral with a date.
- Cold-start persistence test added to `tests/persistence/` (per P2-10 reorganisation): complete a lesson, force-kill the app, cold-start, assert the lesson shows completed.
- SRS integration test added: review an item, force a future date, cold-start, assert the item reappears.

### What GPT-5.5 is NOT requiring
- A complete re-architecture.
- A migration off Reanimated 4 or a rewrite of FlipCard.
- A backend or auth system.
- iOS TestFlight (externally blocked; park).

### What GPT-5.5 IS requiring engineering to STOP doing
- Adding new candidate content layers before the scheduler exists. Content without a scheduler is decorative.
- Treating test count as a quality proxy. 296 green tests on a feature that is not wired is a measurement of the test suite, not the product.

---

## Audit trail (extended)

| Timestamp | Agent | Division | Model | Action |
|---|---|---|---|---|
| 2026-06-25 13:35 | Belion | Coordinator | MiniMax M3 | Phase 22 audit started; routed via `hermes -p default -m openai-codex/gpt-5.5` smoke test (`CODEX_ROUTING_OK`) |
| 2026-06-25 13:35 | Belion | Coordinator | MiniMax M3 | Baseline tests verified: 296/296 ✅ |
| 2026-06-25 13:36 | Belion | Coordinator | MiniMax M3 | Built audit manifest, audit brief, and journal |
| 2026-06-25 13:40 | GPT-5.5 | QC Authority | openai-codex/gpt-5.5 | Delivered sections 6-13 (300 lines, 28,941 bytes) |
| 2026-06-25 13:50 | GPT-5.5 | QC Authority | openai-codex/gpt-5.5 | Delivered sections 1-5 (103 lines continuation) after verifying existing file |
| 2026-06-25 14:00 | Belion | Coordinator | MiniMax M3 | Consolidated full report (this document) |

---

**Phase 1 audit complete. Awaiting Chris's review of findings before Phase 2 (engineering implementation).**

Per directive REIVEW PROCESS:
> *"Phase 2: Engineering Division receives GPT-5.5 findings. MiniMax M3 implements requested improvements."*

I will not begin Phase 2 implementation until you confirm. Findings to address first (P0 only): P0-01, P0-02, P0-03, P0-04.