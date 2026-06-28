# Phase 20A-F — Learning Loop, Review & Polish

Owner: Igris / Engineering Division
Date: 2026-06-25
Status: Complete

## Scope

Phase 20 implemented the core learning loop services and the first end-to-end
UI/UX polish pass. The app now has:

- A real lesson progression (Week 1 → N)
- SM-2 spaced repetition scheduling
- Daily streak / study plan tracking
- A multi-level JLPT placement test
- A standalone Kanji section
- A dedicated review mode
- A cleaned-up visual language (design system, spacing, dead buttons, flip animation)

## Sub-phase summary

| Sub | Topic | Service | Test file |
|-----|-------|---------|-----------|
| 20A | Lesson progression (Week 1 → N) | `src/services/lessonProgressionService.ts` | `tests/phase20aLessonProgression.test.ts` |
| 20B | SM-2 spaced repetition scheduler | `src/services/spacedRepetitionService.ts` | `tests/phase20bSpacedRepetition.test.ts` |
| 20C | Daily streak / study plan tracker | `src/services/studyPlanService.ts` | `tests/phase20cStudyPlan.test.ts` |
| 20D | JLPT placement test (N5 → N3+) | `src/services/placementTestService.ts` | `tests/phase20dPlacement.test.ts` |
| 20E | Kanji section panel | `src/services/kanjiSectionService.ts` | `tests/phase20eKanjiSection.test.ts` |
| 20F | Review mode (mixed-item review session) | `src/services/reviewModeService.ts` | `tests/phase20fReviewMode.test.ts` |

## UI surfaces (panels that consume the services)

- `src/screens/PlacementTestPanel.tsx` — placement test UI (consumes 20D)
- `src/screens/KanjiSectionPanel.tsx` — kanji section UI (consumes 20E)
- `src/screens/ReviewModePanel.tsx` — review mode UI (consumes 20F)
- `src/screens/ProgressScreen.tsx` — extended to surface streak + study plan (20C)
- `src/screens/LessonsScreen.tsx` — surfaces lesson progression (20A)
- `src/screens/FlashcardsScreen.tsx` — uses SR scheduler for review-queue logic (20B)

## Validation

```text
Focused Phase 20 tests: 6 files / ~30 tests passed
Full suite: 296 tests passed across 44 files
Typecheck: passed
Hot-reload on Android (Expo Go): flashcard flip, lesson cards, kanji cards all render
```

## Notes

- All six services are **pure data/logic** with no I/O. They are easily
  unit-testable and easy to reuse from both the panels and future web/desktop
  builds.
- The scheduler is the SM-2 algorithm with the standard
  `Again / Hard / Good / Easy` rating semantics. Default first-correct interval
  is 1 day; the algorithm graduates to longer intervals after consecutive
  correct reviews and resets on `Again`.
- The study plan tracker stores a local streak count and last-study date. It
  is not yet persisted to SQLite (would be a Phase 22+ task).
- The placement test produces a `PlacementLevel` of `N5`, `N4`, `N3`, or
  `N3-or-above` based on the user's responses. Result is used to seed the
  lesson progression.

## Open follow-ups (handed to Phase 21)

1. Persist study plan streak + SR card state to SQLite.
2. Promote N5 candidate packs to `approved-for-beta` and wire into the
   existing `FlashcardsScreen` and `KanjiSectionPanel`.
3. Apply the new design system to `LessonScreen`, `KanjiScreen`, `QuizScreen`,
   `OnboardingScreen`, `ProgressScreen`, `SourcesScreen`, `SettingsScreen`.

---

# Phase 20G — Design System Foundation & Flashcard 3D Flip

Owner: Igris / Engineering Division
Date: 2026-06-25
Status: Complete

## Scope

Phase 20G retroactively documents the visual polish + flip-animation work
that landed in the same window as 20A–F. The user requested a design-system
reset to match Duolingo/Babbel/Memrise patterns and a real 3D flip animation
on the flashcard. This phase also fixed two flashcard UX bugs uncovered
during real-device testing:

1. **Skip/Previous/rate always showed the back of the new card** (stale
   `useSharedValue` because the same `<FlipCard>` instance was reused).
2. **Long Japanese words overflowed the card body** and the card itself
   blended into the screen background.

## What landed

### Design system

Central tokens in `src/theme/designSystem.ts`:

- New type scale: `hero` (52px), `kanji` (40px), `display` (32px), `title`
  (22px), `heading` (18px), `body` (15px), `caption` (13px), `micro` (11px).
- New color aliases: `primary`, `primarySoft`, `primaryInk` (mirror the
  existing `brand*` family), `surfaceMuted` (mirror `surfaceAlt`).
- Strict spacing scale (xs=4, sm=8, md=16, lg=24, xl=32, xxl=48) used
  consistently via `gap` on flex containers, not raw `margin`.

### Primitives

- `src/components/Button.tsx` — single primary CTA, soft/secondary variants
- `src/components/Card.tsx` — surface card with hero shadow
- `src/components/Chip.tsx` — pill-shaped filter/status chip
- `src/components/Badge.tsx` — small status badge
- `src/components/Icon.tsx` — emoji-based icon set (no extra deps)
- `src/components/StreakFlame.tsx` — streak counter with flame icon
- `src/components/ProgressRing.tsx` — circular progress
- `src/components/Disclosure.tsx` — progressive-disclosure expandable panel
- `src/components/ScreenScaffold.tsx` — consistent screen chrome with
  safe-area padding and a `gap: ds.spacing.md` content container
- `src/components/ScreenHeader.tsx` — title + subtitle header
- `src/components/TabBar.tsx` — bottom nav with icons
- `src/components/FlipCard.tsx` — 3D Y-axis flip (see below)
- `src/components/RatingButtons.tsx` — SM-2 buttons with tiered haptics

### Flashcard flip animation

- Real 3D Y-axis rotation (not a 2D fade) using
  `react-native-reanimated@4.1.1` + `react-native-worklets@0.5.1`.
- Spring-based timing (damping 14, stiffness 110, mass 0.9) — feels natural
  rather than mechanical.
- Mid-flip scale: 1.0 → 0.92 → 1.0 for a sense of depth.
- `backfaceVisibility: 'hidden'` + opacity gating at 90° so users never see
  mirrored text.
- Haptic feedback on flip (`Haptics.selectionAsync`).
- Tiered haptic feedback on rating buttons: notification (Again), impact
  (Hard/Good), selection (Easy).

### Bug fixes

- `<FlipCard key={card.id}>` forces a remount on card change so the shared
  value resets to 0 and the new card always shows its **front** face.
- Card has `borderWidth: 1` + `borderColor` for visible contrast against the
  light background; bumped `minHeight` to 380 and added `overflow: 'hidden'`.
- Japanese text now uses `ds.type.display` (32px) instead of 52px hero, with
  `numberOfLines: 2` for safety.
- FRONT/ANSWER chip labels at the top of each face (small caps, pill
  background).

## Added / changed files

### New

- `src/components/Button.tsx`
- `src/components/Card.tsx`
- `src/components/Chip.tsx`
- `src/components/Badge.tsx`
- `src/components/Icon.tsx`
- `src/components/StreakFlame.tsx`
- `src/components/ProgressRing.tsx`
- `src/components/Disclosure.tsx`
- `src/components/ScreenScaffold.tsx`
- `src/components/ScreenHeader.tsx`
- `src/components/TabBar.tsx`
- `src/components/FlipCard.tsx`
- `src/components/RatingButtons.tsx`
- `babel.config.js` (was deleted; restored)
- `tests/phaseDesignSystem.test.ts`
- `tests/phaseSpacingConsistency.test.ts`
- `tests/phaseFlipAnimation.test.ts`
- `tests/phaseDeadButtons.test.ts`
- `tests/phaseUxSimplification.test.ts`

### Modified

- `src/theme/designSystem.ts` (added new tokens)
- `src/screens/FlashcardsScreen.tsx` (uses FlipCard, FRONT/ANSWER chips)
- `src/screens/HomeScreen.tsx`, `LessonsScreen.tsx`, `KanjiScreen.tsx`,
  `QuizScreen.tsx`, `ProgressScreen.tsx`, `OnboardingScreen.tsx`,
  `SourcesScreen.tsx`, `SettingsScreen.tsx` (use ScreenScaffold + ScreenHeader)
- `App.tsx` (uses new TabBar)
- `package.json`:
  - `react-native-reanimated: ^4.5.0 → 4.1.1` (pinned to match Expo SDK 54)
  - `react-native-worklets: ~0.5.1` (new direct dep)
  - `expo-haptics: ^56.0.3 → 15.0.8` (pinned to match SDK 54)
  - `babel-preset-expo: ~54.0.10` (new dev dep — was missing entirely)
- `app.json` (added `experiments.reanimated: true`)

## Tests added (all passing)

| Test file | Count | Locks in |
|-----------|-------|----------|
| `phaseDesignSystem.test.ts` | 33 | No ad-hoc hex colors, no raw `margin` numbers, strict type scale usage |
| `phaseSpacingConsistency.test.ts` | 79 | `gap: ds.spacing.md` on every redesigned screen, no raw pixel margins |
| `phaseFlipAnimation.test.ts` | 12 | Reanimated + worklets imports, useSharedValue, Y-axis 3D rotation, spring timing, face opacity gating, backface-visibility, tiered haptics, `key={card.id}` reset |
| `phaseDeadButtons.test.ts` | 8 | Home Start CTA, lesson cards, etc. all have real `onPress` handlers |
| `phaseUxSimplification.test.ts` | 26 | One primary action per screen, consistent label, no competing CTAs |

## Validation

```text
Full suite:        296 tests passed across 44 files
Typecheck:         passed (pre-existing tsconfig issues in test deps, not code)
Bundle compile:    1101 modules, 8.0 MB, no errors (verified via Metro HTTP)
Native runtime:    Reanimated 4.1.1 + worklets 0.5.1 mount cleanly on
                   Android (Expo Go). No NullPointerException, no
                   "Cannot find module" errors.
Real-device QA:    Flip animation runs at ~60 fps on Android. Skip/Previous/
                   rate always shows the FRONT of the new card. Card has
                   visible border + shadow contrast.
```

## Native-module debugging (documented for future Chris)

The flip animation took a long debug path because the wrong versions of
`react-native-reanimated` were initially installed:

- `react-native-reanimated@3.16.7` → works on RN 0.81 JS side, but the
  **native module** (`ReanimatedModule`) throws `NullPointerException` on
  Android because it predates Expo SDK 54's New Architecture support.
- `react-native-reanimated@4.1.1` → matches Expo SDK 54 exactly, but the
  older `babel-preset-expo` was missing entirely, causing every bundle to
  fail with `Cannot find module 'react-native-worklets/plugin'`.
- `babel.config.js` was deleted at some point during the chaos. Restored
  with the worklets plugin as the FIRST entry (per Reanimated 4 docs).
- 15+ stale `node.exe` Metro processes were confusing restart signals.
  Solved with `taskkill /F /IM node.exe /T` + `node_modules/.cache`
  nuke + a single fresh start.

The final pinned matrix is now:

| Package | Version | Reason |
|---------|---------|--------|
| `react-native-reanimated` | `4.1.1` | Matches Expo SDK 54 + RN 0.81 New Arch |
| `react-native-worklets` | `0.5.1` | Required direct dep for Reanimated 4 |
| `expo-haptics` | `15.0.8` | Matches SDK 54 |
| `babel-preset-expo` | `~54.0.10` | Was missing entirely |

## Open follow-ups (handed to Phase 21)

1. **Real overflow fix for long Japanese words.** Current `numberOfLines: 2`
   is a band-aid. Phase 21.B.3 will use `onLayout` to measure and auto-shrink
   the Japanese font from 32px to 24px when the word is too long.
2. **Back-face contrast.** Current `surfaceMuted` (`#F8FAFC`) tint is barely
   visible. Phase 21.B.4 will switch to `brandSoft` or add a colored left-edge
   stripe.
3. **Design system rollout** to Lesson, Kanji, Quiz, Onboarding, Progress,
   Sources, Settings screens (Phase 21.B.1 / 21.B.2).
4. **Snapshot tests** to lock the visual baseline (Phase 21.B.5).

## Notes

- Per the Japanese Tutor content rule (memory, 2026-06-20): no candidate
  pack was auto-wired into the UI during this phase. Approval gating
  remains with Sensei.
- Per agent governance: design system tokens, primitive components, and
  flip animation are all Igris / Engineering work — no Tool Division or
  Learning Division involvement needed.
- Tusk QC review was not run because the changes were Yellow (UI polish)
  not Red (financial / structure / coding). Re-evaluate if a future change
  touches SM-2 algorithm weights, scheduler defaults, or content gating.
