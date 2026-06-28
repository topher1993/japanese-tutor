# Phase 21 — Content Density + Android-First Distribution + UI Polish Completion

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task. Each task is 2–5 minutes of focused work, ends with a test, ends with a commit.

**Goal:** Move the Japanese Tutor app from "looks better, but feels thin" to a public, content-rich Android release on Google Play, with iOS TestFlight queued behind the missing Apple Developer Program.

**Architecture:** Three concurrent workstreams. (1) **Content** — push N5 vocab/kanji/sentences from candidates to approved, with Sensei review. (2) **UI/UX completion** — finish the design system rollout to every screen, lock visual regressions with render snapshots. (3) **Distribution** — Android Play Console first, iOS TestFlight blocked on Apple account, web stays as a development surface.

**Tech Stack:** Expo SDK 54, React Native 0.81, react-native-reanimated 4.1.1, react-native-worklets 0.5.1, expo-haptics 15.0.8, expo-sqlite 16.0.10, Vitest. No new top-level deps without explicit approval.

---

## Current Context

### Where we are (as of 2026-06-25)

- **Phase 19** (iOS TestFlight): *Prepared, pending Apple/EAS account setup.* Blocked on Chris's Apple Developer Program enrollment. No code work to do here until account exists.
- **Phase 20 A–F** (lesson progression, spaced repetition, study plan, placement, kanji section, review mode): Tests exist, features ship, but **no completion report**. Effectively "done but undocumented."
- **Phase 18D1–5** (large N5 vocab, N5 kanji, example sentences, quiz questions, N4 expansion): Candidate packs exist, awaiting Sensei review → approved-for-beta → wire-in to UI.
- **Undocumented live work** (the stuff we just did this session):
  - Design system foundation: tokens (`hero`, `kanji`, `primary`, `primarySoft`, `surfaceMuted`), primitives (Button, Card, Chip, Icon, Badge, etc.), ScreenScaffold, ScreenHeader, TabBar with icons.
  - Flashcard 3D flip animation (reanimated 4 + worklets + haptics).
  - Flashcard `key={card.id}` reset fix.
  - Card overflow fix + contrast (border, hero typography, FRONT/ANSWER chips).
- **Open bugs from this session's screenshots:**
  - Long Japanese words can still wrap awkwardly at hero size — `numberOfLines: 2` is a band-aid, not a real solution.
  - Back face tint is barely visible — the user said "more contrast" but the current solution is subtle.
- **Tests:** 296 passing across 44 files. Type scale and design-system tests lock regressions.
- **Distribution:** No Play Store listing, no Expo Application Services (EAS) build profile, no iOS bundle ID. Android is the realistic near-term path.

### Constraints (hard)

1. **No Apple Developer Program** → no TestFlight, no App Store, no iOS beta distribution. Phase 19 stays blocked.
2. **No Expo Account / EAS project** → can't run `eas build` from CI yet. Need to verify whether Chris has or can create a free Expo account.
3. **Per memory (2026-06-20):** Japanese Tutor content rule — vocab/kanji/sentence/quiz candidates follow `candidate → sensei-review-needed → approved-for-beta → connect to app`. Do **not** auto-wire into Flashcards/Lessons/Kanji UI without explicit approval.
4. **Per memory:** Chris wants *exponentially broadened* content (500+ vocab, 100+ kanji, 300+ examples/quizzes per level), not tiny seed packs. Sensei mentors Japanese; Beru coordinates learning strategy.
5. **Per memory:** Response shape: lead with the actionable artifact before any justification. Pause only for true hard blockers.

### Owners (per agent governance)

- **Igris / Engineering:** architecture, code, tests, builds, release engineering, UI/UX design system.
- **Kaisel / Tool Division:** EAS config, Google Play Console wiring, Android signing, scripts.
- **Sensei (under Beru):** Japanese content review and approval.
- **Beru:** learning strategy coordination, content sequencing.
- **Tusk:** QC and verification — Yellow/Red/protected/coding/structure changes require Tusk review when practical.
- **GREED:** N/A for this phase (no financial impact).

---

## Proposed Approach

Three workstreams running in parallel, each self-contained, each with a clear "done" signal. No workstream blocks another.

### Workstream A — Content density (Sensei + Igris)

Promote the existing candidate packs through the governance gate into the live app. This is the highest-impact work because the app currently shows "a few cards per lesson" when it should show hundreds.

**Key files to touch (read-only first, no edits without Sensei approval):**
- `src/data/candidates/n5VocabularyCandidateData.ts` → approved data
- `src/data/candidates/n5VocabularyCandidatePack.ts`
- `src/data/candidates/n5KanjiCandidateData.ts`
- `src/data/candidates/n5KanjiCandidatePack.ts`
- `src/data/candidates/exampleSentenceCandidateData.ts`
- `src/data/candidates/exampleSentenceCandidatePack.ts`
- `src/data/candidates/quizQuestionCandidateData.ts`
- `src/data/candidates/quizQuestionCandidatePack.ts`
- `src/data/candidates/n4CandidatePack.ts` (next after N5)
- `src/data/candidates/n4KanjiCandidateData.ts`
- `src/data/candidates/n4VocabularyCandidateData.ts`

**Workflow per pack:** review → mark `approved-for-beta` → Igris wires to UI → Igris adds UI render tests → Igris commits → Tusk verifies on real device.

### Workstream B — UI/UX completion (Igris)

Finish the design system rollout started in the live session. Add the remaining screens to the new layout, lock the visual baseline with tests, and fix the residual flashcard overflow/contrast complaints.

**Key files to touch:**
- `src/screens/LessonScreen.tsx`
- `src/screens/KanjiScreen.tsx`
- `src/screens/QuizScreen.tsx`
- `src/screens/ProgressScreen.tsx`
- `src/screens/OnboardingScreen.tsx`
- `src/screens/SourcesScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/components/Flashcard.tsx` — apply the same hero/contrast/border treatment as FlipCard
- `src/components/FlashcardsScreen.tsx` — non-flip variant alignment
- `src/components/LessonCard.tsx`, `KanjiCard.tsx`, `QuizCard.tsx`

### Workstream C — Android distribution (Kaisel + Igris)

Set up EAS, configure Android build profiles, configure signing, and submit a Play Console internal testing track. This is the realistic "get it on devices" path since iOS is blocked.

**Key files to touch (most are NEW):**
- `eas.json` — new
- `app.json` — add EAS project ID, Android package, version code
- `android/` — generated by EAS prebuild
- `play-store-listing/` — new, with short description, long description, screenshots, content rating
- `docs/phase21-android-distribution.md` — new
- `tests/phase21EasConfig.test.ts` — new, locks build profile shape

---

## Step-by-step Plan

### Phase 21.A — Content density (Sensei-led)

#### Task 21.A.1 — Audit N5 vocabulary candidate pack

**Objective:** Confirm the size and shape of the N5 vocab candidates before Sensei reviews.

**Files:**
- Read: `src/data/candidates/n5VocabularyCandidateData.ts`
- Read: `src/data/candidates/n5VocabularyCandidatePack.ts`
- Read: `tests/phase18d1LargeN5Vocabulary.test.ts`

**Steps:**
1. Run `wc -l` on both files to know pack size.
2. Run `npm test -- tests/phase18d1LargeN5Vocabulary.test.ts` to see what the test currently asserts.
3. Report pack size + test coverage to Beru for Sensei scheduling.
4. Pause. Do not edit any candidate data without Sensei approval.

**Expected outcome:** A short report ("N5 vocab pack: 580 words, 4 categories, tested for uniqueness and JLPT alignment. Ready for Sensei review batch 1.").

#### Task 21.A.2 — Sensei review batch 1: N5 vocab (200 words)

**Objective:** Get the first 200 N5 vocab words through Sensei's review → `approved-for-beta` status.

**Owner:** Sensei (delegated to via Beru).

**Steps:**
1. Beru splits the 580 N5 candidates into batches of 200 / 200 / 180.
2. Sensei reviews batch 1 (200 words), marks each as `approved` / `needs-fix` / `reject` in the candidate data file (or a sidecar review log).
3. Beru reports back with the count of approved words and a list of any flagged issues.
4. Pause until Beru reports. **Do not wire into UI until approved count is ≥ 150.**

#### Task 21.A.3 — Wire approved N5 batch 1 into the Flashcard deck

**Objective:** Show the approved 150+ words in the Flashcard Practice screen.

**Files:**
- Modify: `src/services/candidateFlashcardAdapter.ts` (filter by approval status)
- Modify: `src/screens/FlashcardsScreen.tsx` (already wired, may need a category filter chip)
- Test: `tests/phase21N5ContentWiring.test.ts` (new)

**Steps:**
1. Add `isApprovedForBeta` predicate to the candidate data shape (if not already there).
2. Update `buildCandidateFlashcardCards()` to filter to `approved` only.
3. Add a render test that asserts the Flashcard deck contains ≥ 150 approved cards.
4. Run `npm test` — expect 297+ tests passing.
5. Run `npx expo start --tunnel` and visually confirm in Expo Go that Practice shows the new cards.
6. Commit: `feat(content): wire approved N5 vocab batch 1 into Practice`.

**Expected outcome:** Practice screen now shows 150+ Japanese flashcards instead of the current ~30.

#### Task 21.A.4 — Sensei review batches 2 & 3: remaining N5 vocab

**Objective:** Complete N5 vocab review.

**Steps:** Same shape as 21.A.2, repeated for batches 2 (200) and 3 (180). Igris wires each batch into the UI in turn.

#### Task 21.A.5 — N5 kanji Sensei review + wiring

**Objective:** Promote the N5 kanji candidate pack to `approved-for-beta` and wire into the Kanji section.

**Files:**
- Read: `src/data/candidates/n5KanjiCandidateData.ts`
- Read: `src/data/candidates/n5KanjiCandidatePack.ts`
- Read: `tests/phase18d2LargeN5Kanji.test.ts`
- Modify: `src/screens/KanjiScreen.tsx`
- Test: `tests/phase21N5KanjiWiring.test.ts` (new)

**Steps:** Same pattern as 21.A.2 → 21.A.3.

**Expected outcome:** Kanji screen shows 100+ N5 kanji with on/kun readings and example compounds.

#### Task 21.A.6 — Example sentences + quiz questions

**Objective:** Approve and wire example sentences and quiz questions.

**Files:**
- `src/data/candidates/exampleSentenceCandidateData.ts`
- `src/data/candidates/exampleSentenceCandidatePack.ts`
- `src/data/candidates/quizQuestionCandidateData.ts`
- `src/data/candidates/quizQuestionCandidatePack.ts`
- `src/screens/QuizScreen.tsx`

**Steps:** Same pattern. Expected: 300+ example sentences, 300+ quiz questions, all with Sensei approval.

#### Task 21.A.7 — N4 expansion

**Objective:** Begin the N4 content track (next JLPT level up).

**Steps:** Beru + Sensei plan the N4 scope (likely 800 vocab, 200 kanji, 400 sentences, 400 quizzes per Chris's exponential goal). Then same review → wire cycle as 21.A.2–21.A.6.

### Phase 21.B — UI/UX completion (Igris-led)

#### Task 21.B.1 — Design system rollout: Lesson, Kanji, Quiz screens

**Objective:** Apply the new design system tokens, primitives, and layout to the three main study screens.

**Files:**
- Modify: `src/screens/LessonScreen.tsx`
- Modify: `src/screens/KanjiScreen.tsx`
- Modify: `src/screens/QuizScreen.tsx`
- Modify: `src/components/LessonCard.tsx`
- Modify: `src/components/KanjiCard.tsx`
- Modify: `src/components/QuizCard.tsx`
- Test: `tests/phaseDesignSystem.test.ts` (extend to cover new screens)

**Steps:**
1. Replace ad-hoc hex colors with `ds.colors.*` tokens (use the existing aliases: `primary`, `primarySoft`, `surfaceMuted`).
2. Replace raw `margin: 16` with `ds.spacing.md` (8px scale) and use `gap` on flex containers.
3. Wrap each screen body in `ScreenScaffold` and add `ScreenHeader` at the top.
4. Add a test per screen that asserts no ad-hoc hex colors remain.
5. Run `npm test` — all pass.
6. Hot-reload on phone and visually confirm the new look.
7. Commit per screen.

**Expected outcome:** All three screens have the same card style, typography scale, and spacing as Practice.

#### Task 21.B.2 — Onboarding, Progress, Sources, Settings screen refresh

**Objective:** Apply the design system to the remaining secondary screens.

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`
- Modify: `src/screens/ProgressScreen.tsx`
- Modify: `src/screens/SourcesScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx`

**Steps:** Same as 21.B.1.

#### Task 21.B.3 — Fix long-Japanese word overflow for real

**Objective:** Replace the `numberOfLines: 2` band-aid with adaptive sizing.

**Files:**
- Modify: `src/components/FlipCard.tsx`
- Test: `tests/phaseFlipAnimation.test.ts` (extend)

**Steps:**
1. Use `onLayout` on the Japanese text to measure available width.
2. If the romaji length implies a 2-line word, auto-shrink `jp` font from 32px down to 24px to fit on one line.
3. Add a render test that asserts a 7-character word still fits on one line.
4. Visual check on phone with a long card like 遠慮深い表.
5. Commit.

#### Task 21.B.4 — Stronger back-face contrast

**Objective:** Make the back face visually distinct enough that users feel "this is the answer side" without flipping.

**Files:**
- Modify: `src/components/FlipCard.tsx`

**Steps:**
1. Change back face background from `ds.colors.surfaceMuted` (`#F8FAFC`) to a slightly warmer tint, e.g. `ds.colors.brandSoft` (`#E0F2FE`).
2. Or: add a left-edge colored stripe (4px wide, `ds.colors.primary`).
3. Add a render test.
4. Visual check.
5. Commit.

#### Task 21.B.5 — Lock visual baseline with snapshot tests

**Objective:** Catch visual regressions before they ship.

**Files:**
- Add: `tests/phaseVisualBaseline.test.ts` (new, uses `react-test-renderer` or snapshot)
- Add: `__snapshots__/phaseVisualBaseline.test.ts.snap` (new)

**Steps:**
1. Render each redesigned screen to a string tree.
2. Compare to a checked-in snapshot.
3. Run `npm test` and confirm snapshots match the current good state.
4. Commit the snapshot.

**Expected outcome:** Any future code change that breaks the design system (wrong color, wrong spacing) fails the test.

#### Task 21.B.6 — Update the design system docs

**Objective:** Document the design system so future contributors don't reinvent it.

**Files:**
- Modify: `docs/design-system.md` (new, or update existing)
- Add: a `/docs/screenshots/` reference folder with annotated PNGs of each screen

**Steps:**
1. Document each `ds.colors.*` and `ds.spacing.*` token with its purpose.
2. Add "do this, not that" examples for: card padding, button height, type scale.
3. Commit.

### Phase 21.C — Android distribution (Kaisel + Igris)

#### Task 21.C.1 — Audit Android distribution prerequisites

**Objective:** Confirm what we have vs need for Play Store internal testing.

**Steps:**
1. Verify Chris has (or can create): Google account, Google Play Console developer account ($25 one-time), Expo account (free).
2. Verify `app.json` has: `android.package`, `android.versionCode`, `expo.android.icon` (or `expo.icon` fallback).
3. Report blockers. If Apple Developer is also missing (we know it is), note that Phase 19 is still blocked.
4. Pause for Chris to confirm/deny.

#### Task 21.C.2 — Create EAS project and `eas.json`

**Objective:** Configure Expo Application Services for Android builds.

**Files:**
- New: `eas.json`
- Modify: `app.json` (add `extra.eas.projectId`)

**Steps:**
1. `npx eas init` (will prompt for Expo login + project creation).
2. Edit `eas.json` to define three build profiles: `development`, `preview` (internal), `production`.
3. Add a test that asserts the `preview` profile has `distribution: "internal"` and `android.buildType: "apk"`.
4. Commit.

#### Task 21.C.3 — Run first EAS preview build

**Objective:** Confirm the Android build pipeline works end-to-end.

**Steps:**
1. `npx eas build --profile preview --platform android`.
2. Wait for build to complete (5–15 min).
3. Download the `.apk`.
4. Side-load to a physical device and smoke-test the full app flow.
5. Commit any build-config tweaks.

#### Task 21.C.4 — Set up Play Console internal testing track

**Objective:** Get the app installable by invited testers via Play Store.

**Steps:**
1. Create the Play Console app listing (title, short description, long description, icon, feature graphic, 2–8 screenshots).
2. Upload the signed AAB from EAS.
3. Create an "internal testing" release and add Chris's Google account as a tester.
4. Accept the testing invite on the device and confirm the app installs and runs.
5. Document the tester invitation flow in `docs/phase21-android-distribution.md`.

#### Task 21.C.5 — Recruit 5–10 Android beta testers

**Objective:** Real-device feedback before any wider release.

**Steps:**
1. Chris identifies 5–10 testers (friends, family, Discord, etc.).
2. Send each tester the Play Store internal-testing opt-in link.
3. Each tester completes the on-device flow: onboarding → lesson → flashcard → quiz → progress.
4. Feedback collected via the in-app feedback flow (Phase 17A).
5. Tusk triages feedback weekly.

### Phase 21.D — iOS TestFlight (BLOCKED)

**Status:** Blocked on Chris's Apple Developer Program enrollment. No work this phase. Re-evaluate in Phase 22.

### Phase 21.E — Documentation + handoff

#### Task 21.E.1 — Write the Phase 21 completion report

**Objective:** Same shape as every prior `phase-N-completion-report.md`.

**Files:**
- New: `docs/phase-21-completion-report.md`
- New: `docs/phase-21-work-card.md`

**Steps:**
1. List every file added/modified.
2. List every test added (with names + counts).
3. List the version numbers (reanimated 4.1.1, worklets 0.5.1, etc.).
4. List the open known issues (e.g. iOS still blocked).
5. Commit.

#### Task 21.E.2 — Update `internal-beta-release-candidate.md`

**Objective:** Reflect the new Android internal-testing path alongside the still-blocked iOS path.

**Files:**
- Modify: `docs/internal-beta-release-candidate.md`

**Steps:**
1. Add a section "Android internal testing (Phase 21)" with tester opt-in instructions.
2. Keep the iOS section but mark it "blocked on Apple Developer Program."
3. Commit.

---

## Files Likely to Change (summary)

### New files
- `tests/phase21N5ContentWiring.test.ts`
- `tests/phase21N5KanjiWiring.test.ts`
- `tests/phase21EasConfig.test.ts`
- `tests/phaseVisualBaseline.test.ts`
- `__snapshots__/phaseVisualBaseline.test.ts.snap`
- `eas.json`
- `docs/phase-21-completion-report.md`
- `docs/phase-21-work-card.md`
- `docs/phase-21-android-distribution.md`
- `docs/design-system.md` (or update existing equivalent)

### Modified files
- `src/data/candidates/n5VocabularyCandidateData.ts` (Sensei approval marks)
- `src/data/candidates/n5VocabularyCandidatePack.ts`
- `src/data/candidates/n5KanjiCandidateData.ts`
- `src/data/candidates/n5KanjiCandidatePack.ts`
- `src/data/candidates/exampleSentenceCandidateData.ts`
- `src/data/candidates/exampleSentenceCandidatePack.ts`
- `src/data/candidates/quizQuestionCandidateData.ts`
- `src/data/candidates/quizQuestionCandidatePack.ts`
- `src/data/candidates/n4CandidatePack.ts`
- `src/data/candidates/n4KanjiCandidateData.ts`
- `src/data/candidates/n4VocabularyCandidateData.ts`
- `src/services/candidateFlashcardAdapter.ts`
- `src/screens/FlashcardsScreen.tsx`
- `src/screens/LessonScreen.tsx`
- `src/screens/KanjiScreen.tsx`
- `src/screens/QuizScreen.tsx`
- `src/screens/OnboardingScreen.tsx`
- `src/screens/ProgressScreen.tsx`
- `src/screens/SourcesScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/components/Flashcard.tsx`
- `src/components/LessonCard.tsx`
- `src/components/KanjiCard.tsx`
- `src/components/QuizCard.tsx`
- `src/components/FlipCard.tsx`
- `app.json`
- `package.json` (potentially, if EAS CLI is added)
- `docs/internal-beta-release-candidate.md`

---

## Tests / Validation

After each task, the full test suite must remain green:

```bash
npm test
```

Expected baseline: 296 tests, 44 files.

After Phase 21.A.3 (N5 vocab wired): expect ≥ 300 tests.
After Phase 21.B.1 (3 screens redesigned): expect ≥ 305 tests.
After Phase 21.B.5 (snapshot tests): expect ≥ 320 tests.

Manual verification per task:
- Hot-reload on phone (Expo Go) for every UI change.
- Side-load APK to a physical Android device for every build change.
- Tusk pre-flight review for any Yellow/Red/protected/coding/structure change (governance rule).

---

## Risks, Tradeoffs, and Open Questions

### Risks

1. **Sensei review is the bottleneck.** Without Sensei's approval, the content workstream is stuck. Need a reliable cadence (daily or every 2 days) from Beru to keep content flowing.
2. **EAS builds cost money.** Expo's free tier gives a limited number of builds per month. If we exceed, we either pay or self-host. Need to set the build cadence conservatively.
3. **Play Console requires a $25 one-time fee.** Trivial, but Chris needs to actually pay it.
4. **Reanimated 4 + worklets is still on a hair trigger.** Any new package that introduces Hermes bytecode may break the bundle. Watch for: precompiled native modules, `node_modules` with `.hbc` files, anything depending on `expo export`.
5. **The flashcard card still has cosmetic complaints.** The 2-line Japanese wrap and weak back-face contrast are band-aids, not solutions. Phase 21.B.3 and 21.B.4 address them properly.

### Tradeoffs

1. **Android-first means we lose iOS users in the short term.** But iOS is blocked regardless, so this is forced. We get Android users in return.
2. **Web stays a dev surface, not a release target.** Expo web works, but shipping a "web app" version means a separate Play Store listing (PWA) or a web hosting setup. Not in scope for Phase 21.
3. **Content density vs. quality.** Sensei's review is the only thing that keeps quality high. Pushing 1000 vocab through a non-Sensei pipeline would be a mistake. We accept slower throughput for higher quality.
4. **Snapshot tests are sensitive.** They catch regressions but also break on every intentional UI change. Worth it for the design system, but commit the new snapshot alongside the UI change.

### Open questions for Chris

1. **Apple Developer Program** — are you enrolling? If yes, when? If no, Phase 19 stays blocked indefinitely. (Doesn't block Phase 21.)
2. **Play Console account** — do you have one, or do you need help creating it?
3. **Expo account** — same question.
4. **Beta testers** — who are the 5–10 people? Igris can prep the Play Store listing and tester invite flow while you decide.
5. **Sensei cadence** — how often can Sensei review batches? Daily? Weekly? This sets the content workstream's pace.
6. **N4 scope** — confirm the 800/200/400/400 numbers (vocab/kanji/sentences/quizzes) for N4, or revise.

---

## Execution Handoff

Plan complete. Ready to execute using subagent-driven-development:

- **Workstream A (content):** delegated to Beru + Sensei, with Igris as the wiring engineer.
- **Workstream B (UI/UX):** delegated to Igris in 2–5 minute TDD tasks, one screen at a time.
- **Workstream C (Android distribution):** delegated to Kaisel for tooling, Igris for code, Tusk for verification on real device.

Per Chris's "avoid being stacked" rule: tasks are batched so no single turn exceeds ~10–15 tool calls. Pause only for true hard blockers (Apple/Google/Play accounts, missing Sensei review). Report ONCE per workstream at completion, not per task.

Shall I proceed with Workstream B (UI/UX) first, since it has the fewest external dependencies and the live session already laid the groundwork?
