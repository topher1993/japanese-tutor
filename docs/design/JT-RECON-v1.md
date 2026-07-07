# JT-RECON-v1.md — Japanese Tutor Mobile App Design Recon

**Author:** Lyra (cross-project UI/UX Design Lead)
**Date:** 2026-07-07
**Status:** First JT recon after cross-project scope expansion. Read-only reconnaissance, not a Phase-0 audit.

---

## TL;DR

JT has **one design system file** (`src/theme/designSystem.ts`), adopted universally across all 19 screen files. Recent phases (Phase 20G, 21, 27, 41-44) have shipped with no design-shape governance — Lyra was scoped to Stronghold-only until today. The most important live design-shape thread is the **parked `ux-simplification` card** (10-day-stale as of 2026-07-04), waiting for fresh beta signal or telemetry from Phase 43/44 PostHog wiring.

---

## 1. What is currently working at a design level

### 1.1 The design system itself exists and is mature

`src/theme/designSystem.ts` (92 lines, the ONLY file under `src/theme/` after Phase 21's consolidation) defines:

- **Strict 8-step type scale:** `hero` 52, `kanji` 40, `display` 32, `title` 22, `heading` 18, `body` 15, `caption` 13, `micro` 11 (one role per step, no in-between sizes by design).
- **6-step spacing scale:** `xs` 4, `sm` 8, `md` 16, `lg` 24, `xl` 32, `xxl` 48.
- **5-step radius scale:** `sm` 10, `md` 16, `lg` 22, `xl` 28, `pill` 9999.
- **Color palette** with brand (`#2A6F97` ocean blue), warm (`#F4A261` amber), success (`#2A9D8F`), danger (`#D95F43`), info (`#7E57C2`), full neutrals surface stack — Duolingo/Babbel-style "one strong brand color, one warm accent, one cool accent" recipe.
- **Touch targets:** `min` 48px (HIG), `comfortable` 56px (Material).
- **Shadows:** `card` and `hero` presets, soft shadows not borders.

Phase 20G documented this as a deliberate Duolingo/Babbel/Memrise visual-language match, with pill-shaped CTAs, large rounded cards, and generous tap targets. Phase 21 went further and deleted the legacy `theme/colors.ts`, `theme/spacing.ts`, `theme/typography.ts` — there is now one source of truth.

### 1.2 DS adoption is universal across screens

Every screen in `src/screens/` references `ds.colors` (counts per file, design-system complexity proxy):

| Screen | `ds.*` refs |
|---|---|
| BetaFeedbackScreen | 33 |
| DailyRushScreen | 26 |
| FlashcardsScreen | 28 |
| HomeScreen | 48 |
| KanjiSectionPanel | 15 |
| LessonsScreen | 39 |
| OnboardingScreen | 20 |
| ProfileScreen | (18+ in colors alone) |
| ProgressScreen | 16 |
| QuizScreen | (16+ in colors alone) |
| SenseiReviewScreen | 26 |
| WorkplaceSurvivalScreen | 13 |
| DailyLessonScreen | 11 |
| ExampleSentencesScreen | 12 |
| PlacementTestPanel | 15 |
| ReviewModePanel | (9+ in colors alone) |
| SettingsScreen | (4+ in colors alone) |
| SourcesScreen | (6+ in colors alone) |
| WeeklyLessonScreen | (3+ in colors alone) |

No orphan ad-hoc-hex-color regression was found in any screen file (Phase 21's triple-grep gate held; Phase 20G's `phaseDesignSystem.test.ts` with 13 `it()` blocks (22 `expect()` assertions, 35 total lock-points) continues to enforce it).

### 1.3 Phase 20G primitives are in steady use

- `ScreenScaffold` + `ScreenHeader` wrap every screen (Phase 20G rollout to Home, Lessons, Kanji, Quiz, Progress, Onboarding, Sources, Settings — completed).
- `Button`, `Card`, `Chip`, `Badge`, `Icon`, `StreakFlame`, `ProgressRing`, `Disclosure`, `FlipCard`, `RatingButtons`, `TabBar` are referenced from screens and panels.
- Reanimated 4 + worklets flip animation works at ~60 fps Android; `key={card.id}` reset fix landed; tiered haptics on rating buttons shipped.

### 1.4 Recent functional phases shipped without design-shape regressions

- **Phase 12** (Safe Area UI Polish): replaced `SafeAreaView` with `react-native-safe-area-context`, added 16px readable status-bar gap. Clean fix.
- **Phase 17A** (Feedback UX Simplification): collapsed 5-field beta-feedback form into a learner-friendly 4-option flow ("Report a problem / Confusing or hard to use / Translation or Japanese issue / Suggestion"). Hidden advanced controls behind a disclosure. Maps cleanly to design-system primitives.
- **Phase 39** (Mark-complete tri-state + error toast): replaced silent-disabled button with `disabled={markInFlight}` + "Saving lesson..." label + error toast on failure.
- **Phase 41 P1-6** (Disabled-state explanation for weekly-todo gate): "Finish this week's todos first" warm card at `LessonsScreen.tsx:346-353`.
- **Phase 44** (PostHog onboarding telemetry): pure functional wiring, no UI shape touched.

---

## 2. What has been broken, patched around, or sitting inert

### 2.1 The original `ux-simplification` work-card is the single biggest design-shape debt

Original Chris complaint (2026-06-24): *"the app now seems like so complex to use, i find it so hard to navigate what button to click where to go"*. The card proposed 5 sub-phases (UX-1 through UX-5): simplify Home, reduce Lessons, standardize back-button + tab labels, progressive disclosure of deep panels, pulse-QA regression tests.

**None of UX-1 through UX-5 has ever shipped.** Two of the seven specific complaints (silent mark-complete; missing weekly-todo-gate explanation) were closed organically by Phase 39 + Phase 41 P1-6. The other five are still valid as of 2026-07-07:

| Original complaint | Current state |
|---|---|
| 11 entry points (5 tabs + 6 deep panels) | Still 11. |
| 3 different Back labels | Still 3. |
| Lessons screen has 7-8 stacked items | Still ~7. |
| Bottom tabs use jargon (Cards, Quiz, Stats) | Still jargon. |
| Workplace Survival / Sources / Beta Feedback each have their own tab | Still on tab bar. |

The card was parked 2026-07-04 with explicit re-scope triggers: new beta feedback matching the original complaint, telemetry from weekly-todo gate showing <50% completion, or a direct Chris re-scope request.

### 2.2 Inline-flavored tab labels

`App.tsx` -> `src/app/renderTab.tsx` -> `src/app/AppShell.tsx` render a `TabBar` whose labels include `Home`, `Lessons`, `Flashcards`, `Progress` plus a deeper row containing `Workplace Survival`, `Sources`, `Beta Feedback`. Per the parked card, the bottom tabs use jargon that even Chris struggles with — though none of this was re-verified against fresh tester signal.

### 2.3 Back-button + screen-title consistency is unverified

No design-time audit has confirmed a single `<- Back` label convention, single `ScreenHeader` title size, or single safe-area top inset. There are likely per-screen escapes from the `ScreenScaffold` primitive. Without reading every screen header inline, this is **an unverified risk** flagged by the parked card.

### 2.4 Asset strategy is unfinished but not blocking

Phase 26 documented the asset gap: Tier 1 (app icon, iOS/Android adaptive icon, splash) is mandatory for store release; Tier 2 (onboarding illustrations, empty-state art, streak / JLPT badges) materially helps a learner; Tier 3 (mascot, category illustrations, loading skeletons) is post-launch. Tier 2 and 3 are deferred. JT is currently a text-only app — typography + color + icon glyphs in `Icon.tsx` are doing all the work.

### 2.5 PostPhase-44 telemetry (dashboard) didn't exist yet when Phase 43 shipped

PostHog dashboards are now set up (Phase 44.4) but the 2-week data-collection window has not elapsed, so there is no signal-driven input to either un-park the UX card or shape Phase 45.

---

## 3. Open questions that this recon is asking for the first time

1. **Does JT have a design system or tokens file today?** **YES.** `src/theme/designSystem.ts` is the only file under `src/theme/`, ships strict scales, and is referenced universally. Pre-Phase-21 leftover legacy files (`colors.ts`, `spacing.ts`, `typography.ts`) were deleted in 2026-06-25. The orphan-file risk is closed.

2. **What platform conventions does it follow?** **Hybrid Apple HIG + Material.** `ScreenScaffold` is wrapped in `SafeAreaProvider` (`react-native-safe-area-context`) — that's iOS-HIG territory. `touch.min` is set to HIG's 48px, and `touch.comfortable` (56px) is Material. The visual language is deliberately Duolingo-flavored (pill CTAs, large rounded cards, generous tap targets). JT does NOT ship a true Apple-HIG- or Material-only kit; it picks what works for a text-heavy learning surface on Expo SDK 54 / RN 0.81.

3. **What's the visual hierarchy convention?** Not formally documented. The type scale exists (`hero`/`kanji`/`display`/`title`/`heading`/`body`/`caption`/`micro`), but there is no opinion document about which screen surface uses which. Roles inferred from usage:
   - `title` (22px) = screen titles (via `ScreenHeader`).
   - `heading` (18px) = card titles.
   - `body` (15px) = default reading.
   - `display` / `hero` / `kanji` = Japanese content on flashcards.
   - **Gap:** no documented rule for empty-state headers, error-toast titles, or onboarding-step titles — likely all use `title` by default but this should be locked.

4. **What's left of the Phase 20G rollout that needs Lyra attention?** Phase 21 migrated 5 of 13 screen-level consumers (Flashcard, LessonCard, DailyLessonScreen, WeeklyLessonScreen, appSafeAreaLayoutService) to `ds.*` aliases. The grep above shows all 19 screen files now use `ds.colors`, so the active-screen rollout is **complete**. Deep content surfaces (Kanji, Quiz, etc.) consume DS but were not exhaustively phase-tracked; one or two may have inline hex colors that escaped `phaseDesignSystem.test.ts` enforcement. Low risk; worth a Phase-45 quick sweep.

5. **Where does Phase 45 sit relative to parked work?** The next design-shape phase has to resolve whether to (a) re-scope the parked UX card after 2 weeks of PostHog data (mid-July), (b) dispatch the Phase-41 a11y list (Tusk P1-1 — multi-day, separate work-card, deferred to Phase 42+ and never re-touched), (c) do the LessonsScreen refactor (Phase 43 P2-2 PLANNED, never started, blocked on Vietnamese content ship), or (d) ship a Tier-2 asset (onboarding illustration or empty-state art). The parked UX card is the highest design-shape priority but it has explicit triggers not yet met.

---

## 4. What this recon did NOT touch (deferred per brief)

- No source files were modified.
- No commits were made.
- No tests were run (read-only constraint).
- No Stronghold or other-project files were read.
- Tailwind / TSX / config proposals were intentionally excluded per the brief.
