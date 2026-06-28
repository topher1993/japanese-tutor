# Post-Phase 16 Beta Forward Plan

> **For Hermes:** Use Engineering Division workflow. Belion coordinates; Igris owns engineering planning/execution; Nova, Pulse, Clix, Sensei/content review, Vector, and Sentinel join only when their gate is active.

**Goal:** Move the Japanese Tutor Mobile App from Phase 16 completion into controlled beta feedback, stabilization, and then the next learning/content roadmap.

**Architecture:** Keep the current Expo/React Native app stable while testers use it through Expo Go/tunnel. Do not add large features during the beta waiting period unless feedback exposes a blocker. Capture, triage, fix, validate, and only then expand scope.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Vitest, Expo Go, local/broader beta docs.

---

## Current Status

Phase 16 is effectively complete. The app now has:

- Bottom navigation: `Home | Lessons | Cards | Quiz | Stats`
- Lessons categories:
  - Workplace
  - Daily Conversation
  - Shopping
  - Safety / Emergency
  - Directions
  - Grammar Basics
- Helper-language personalization:
  - English
  - Vietnamese
  - Filipino/Tagalog
- Translation visibility rules:
  - selected helper language first
  - English fallback kept
  - unrelated translations hidden by default
- Latest known validation from Phase 16H:
  - Typecheck passed
  - 23 test files passed
  - 79 tests passed
  - Expo export passed
  - Expo install check passed
  - Expo Doctor passed, `18/18`

## Operating Rule During Beta Wait

Do not keep adding major product features while waiting for testers.

The app should enter a **feedback-stabilization mode**:

1. Keep the tunnel/server available when testers need it.
2. Collect feedback and screenshots.
3. Triage blockers first.
4. Fix only what affects usability, comprehension, crashes, layout, or beta confidence.
5. Defer big curriculum expansion until after beta results.

---

## Phase 17 — Beta Feedback Intake and Triage

**Owner:** Igris  
**Support:** Pulse, Nova, Clix, Sensei/content review

### Goal

Turn tester feedback into a clean fix queue instead of reacting randomly.

### Trigger

Start when Chris receives tester screenshots, notes, or local feedback entries.

### Tasks

1. Create or update a beta feedback log.
   - Suggested file: `docs/beta/beta-feedback-log.md`
2. Classify every item by:
   - severity: Blocker / Important / Minor
   - category: Bug / Device layout / UI polish / Content / Learning flow
   - screen: Home / Lessons / Cards / Quiz / Stats / Onboarding / Feedback
3. Decide outcome for each item:
   - fix now
   - defer
   - needs clarification
   - duplicate
4. Build a Phase 17 fix list.
5. Run a validation gate after any fix batch.

### Validation

Run after changes:

```bash
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-phase17 --clear
npx expo install --check
npx expo-doctor@latest
```

### Exit Gate

Phase 17 is complete when:

- unresolved blockers: `0`
- unresolved important issues: `2 or fewer`
- at least 3 testers complete one study session, if broader beta proceeds
- all required screens are opened by at least one tester
- no SDK compatibility errors occur

---

## Phase 18 — Beta Polish Sprint

**Owner:** Igris  
**Support:** Clix, Nova, Pulse

### Goal

Fix the highest-value UI/UX issues reported by testers without expanding the app’s scope.

### Likely Work

- spacing and layout polish
- long-text wrapping fixes
- status-bar/title safe-area issues
- bottom navigation readability
- confusing button labels
- feedback screen clarity
- visual hierarchy improvements

### Files likely to change

- `App.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/LessonsScreen.tsx`
- `src/screens/WorkplaceSurvivalScreen.tsx`
- `src/screens/FlashcardsScreen.tsx`
- `src/screens/QuizScreen.tsx`
- `src/screens/StatsScreen.tsx`
- styles inside affected screens
- focused tests under `tests/`

### Validation

- focused tests for changed behavior
- full Vitest suite
- TypeScript check
- browser smoke
- Expo Go/device check if layout/device issue was involved

### Exit Gate

- no blocker layout issues
- no unreadable or clipped primary text
- bottom navigation remains usable
- tester workflow still fits in the current app structure

---

## Phase 19 — Content Quality Review

**Owner:** Igris  
**Support:** Sensei/content review, Pulse

### Goal

Improve learning accuracy and naturalness before adding more quantity.

### Scope

Review current Japanese, romaji, English, Vietnamese, and Filipino/Tagalog content for:

- unnatural phrasing
- incorrect romaji
- missing politeness context
- unclear workplace usage
- misleading translations
- phrase difficulty mismatches for N5 learners

### Files likely to change

- `src/data/additionalLessonCategoryContent.ts`
- workplace/survival content data files
- quiz content files, if content issues are reported
- tests validating key phrase fields

### Exit Gate

- high-risk translation issues fixed
- no known incorrect Japanese remains in beta-critical content
- content docs updated if phrasing changes are significant

---

## Phase 20 — Learning Flow Upgrade

**Owner:** Igris  
**Support:** Nova, Clix, Pulse

### Goal

Make the app feel more like a guided tutor instead of a phrase library.

### Candidate Features

Choose only after beta feedback confirms direction:

1. Daily study path
   - one suggested lesson
   - one flashcard session
   - one quiz
2. Better progress/streak meaning
   - completed categories
   - daily practice count
   - weak areas
3. Category-specific quiz links
   - Shopping quiz after Shopping lesson
   - Directions quiz after Directions lesson
4. Review mode
   - mistakes or weak phrases come back later

### Recommended First Feature

Daily study path.

Reason: it improves perceived usefulness without needing a huge content expansion.

---

## Phase 21 — Quiz Localization and Category Quizzes

**Owner:** Igris  
**Support:** Sensei/content review, Pulse

### Goal

Remove the current honest limitation where quiz explanations are English-only.

### Scope

- Add localized quiz explanation data:
  - English
  - Vietnamese
  - Filipino/Tagalog
- Add quiz filtering by category.
- Keep English fallback.
- Add tests that prevent missing localized explanations.

### Files likely to change

- quiz data files
- `src/screens/QuizScreen.tsx`
- helper-language service usage
- tests for localized quiz behavior

---

## Phase 22 — Packaging Path Decision

**Owner:** Igris  
**Support:** Vector, Nova, Sentinel

### Goal

Decide how the next tester group receives the app.

### Options

1. Continue Expo Go tunnel beta.
   - fastest
   - least setup
   - URL can change
2. Build an Android preview package.
   - more app-like
   - more setup
   - better for repeat testing
3. Prepare app-store style release later.
   - not needed yet

### Recommendation

Stay with Expo Go/tunnel until at least one broader tester cycle finishes.

Move to Android preview packaging only after:

- core screens are stable
- no onboarding/navigation blockers remain
- content quality is acceptable
- testers ask to reuse the app repeatedly

---

## Immediate Next Actions While Waiting

1. Keep the current app stable.
2. Do not start Phase 20+ until tester feedback arrives.
3. When tester feedback arrives, start Phase 17 triage.
4. If testers cannot open the app, treat it as a Vector/Nova blocker and fix runtime/tunnel/device access first.
5. If testers can open it but complain about layout, run Phase 18 polish.
6. If testers question phrase accuracy, run Phase 19 content review.

## Recommended Command to Chris

When feedback comes in, use:

```text
Belion, hand this to Igris for Phase 17 triage. Here are the tester notes/screenshots: ...
```

Igris should then produce:

- categorized feedback log
- blocker list
- important issue list
- recommended fix batch
- validation plan

---

## Do Not Do Yet

Avoid these until after beta feedback:

- adding N4/N3/N2 curriculum
- large redesign
- backend sync
- account/login system
- app-store packaging
- voice/audio generation
- complex spaced repetition engine

Reason: those are valuable later, but they can distract from validating whether the current beta app is understandable and usable.
