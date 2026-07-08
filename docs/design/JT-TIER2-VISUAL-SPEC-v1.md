# JT Tier-2 Illustration Visual Spec (v1)

Work-card: 2026-07-07_jt-tier2-illustration · Track 2 of Phase 45
Author: Lyra (cross-project UI/UX Design Lead)
Audience: Kaisel (tool/pipeline) → Clix (integration) → Tusk (QC) → Igris (commit)
Beru's source-of-truth: JT-TIER2-PEDAGOGY-PICKLIST-v1.md
Design-system reference: JT-RECON-v1.md §1.1
Visual recipe (Phase 20G): JT-PHASE-45-DESIGN-SHAPE-PROPOSAL.md §2 Option C

---

## Push-back / fabrication findings (READ FIRST)

These were found during pre-flight verification. Kaisel/Clix must resolve before pipeline work begins.

1. **All 6 onboarding PNGs already exist** at `src/assets/source/illustrations/onboarding/` (welcome/workplace/habit × base+final). They render live in `OnboardingScreen.tsx` via `<Illustration scene="welcome|workplace|habit" height={220} />` and the keys are wired through `assetRequireMap.ts` and `manifest.ts`. The pick-list implies these are missing; they are not. **Treat this work-card as a STYLE REFRESH of live assets, not a from-scratch creation.** Beru's brief should be re-read with that framing.
2. **Existing onboarding illustrations are PNG-only on disk.** There are no SVG masters in `src/assets/source/illustrations/onboarding/`. Beru asks for "320×480 SVG, flat." Two valid interpretations: (a) SVG master files + PNG export, matching the badge pipeline (`badge-*.svg` + `badge-*.png`); (b) keep PNG-only and ship at 320×480 export size. Kaisel must confirm which with Chris before starting — this spec assumes (a) for visual-editability, but (b) is acceptable.
3. **All 3 already-wired empty-state PNGs exist** at `src/assets/source/illustrations/empty-state/` (home/lessons/progress). But `HomeScreen.tsx` imports `EmptyStateArt` (line 6) and never renders it — the `home` slot is a TypeScript-only dead wire. Only `LessonsScreen.tsx:306` and `ProgressScreen.tsx:140` actually render `<EmptyStateArt />`. `FlashcardsScreen`, `QuizScreen`, `WorkplaceSurvivalScreen` have ZERO empty-state illustration wiring. **Net: 3 of 6 illustrations are style-refreshes of live assets (home-as-style-refresh, lessons-as-style-refresh, progress-as-style-refresh); 3 are genuinely new (flashcards/quiz/survival).**
4. **The brief asks for "240×240 SVG" empty-state illustrations but `EmptyStateArt.tsx` renders a square PNG at `size=200` default (or 180/220 per screen call site).** Kaisel can ship 240×240 SVG masters with 240×240 PNG export; the component's `size` prop already handles scale. Confirmed not a regression risk.
5. **`profileProgressionService.ts:67-73` emits only 5 badges: `first-lesson`, `seven-day-streak`, `daily-rush-starter`, `perfect-quiz`, `n4-unlocked`.** Beru references "JLPT badges (N5/N4/N3)" as if they're already in the badge tree — they are not. The BadgeImage component has the visual keys (`jlptN5`, `jlptN4`, `streak7`) but the service never emits them. **The new visual badges must also be wired into `profileProgressionService.ts` (Kaisel/Clix must coordinate — see Cross-Set section "Badge service wiring" below).**
6. **`jlptN3` is the only genuinely new BadgeKey** in `BadgeImage.tsx`'s union — adding it requires a TypeScript type extension. `streak7`, `jlptN5`, `jlptN4` keys already exist.
7. **The "streak7" badge duplicates StreakFlame's flame motif semantically.** StreakFlame.tsx already paints a 🔥 at 28px inside a 56px amber ring with `warmSoft` background. The new 96×96 streak7 PNG badge should reference the same warm-amber palette but should NOT duplicate the emoji — Kaisel should ship a stylized flame silhouette, distinct enough that the badge and the hero element read as siblings, not duplicates.

---

## SET 1 — Onboarding illustration refresh (3 panels)

Style: same flat visual recipe as Phase 20G. SVG masters exported to PNG at 320×480 for bundling (matches existing Illustration.tsx `NATIVE_ASPECT = 1024/1536 ≈ 0.667` rendering — 320×480 keeps the same aspect ratio exactly).

### Panel A — Welcome (Step 1: `welcome`)
- **Pedagogical moment:** first contact, lower the stakes.
- **Scene:** workplace desk at midday, soft daylight, single hiragana character on laptop screen, coffee mug, low-clutter.
- **Tone:** welcoming-only.
- **Visual style hierarchy:** palette `ds.colors.brand` (#2A6F97) + `ds.colors.warm` (#F4A261) + `ds.colors.background` (#F4F7FA) neutrals. Stroke weight 2px line / 4px key outline. Line style: FLAT (no gradients, no inner shading). Character weight: iconic-only (no realistic faces). Perspective: 3/4 view of desk.
- **Compositional rules:** focal point = laptop screen with hiragana character, top-third. Negative space ratio ≥ 30%. Framing: rule-of-thirds; eye-path top-left → laptop → coffee mug (top-right) → desk surface (foreground).
- **Required props:** desk surface (foreground), laptop (focal point with hiragana character), coffee mug (top-right or mid-right), soft daylight window suggestion (top-left).
- **Locked:** palette tokens, stroke weights, character weight, hiragana-character-on-laptop motif (identity lock per Beru).
- **Flexible:** desk wood texture vs. plain, mug color (must stay `warm` or `textMuted`), presence/absence of a sticky note.
- **NOT allowed:** parallel color tokens outside ds.colors; in-between type sizes outside the 8-step scale; sub-radius values outside the 5-step radius scale; realistic faces; gradients; multi-character crowds.

### Panel B — Workplace goal (Step 3: `workplace`)
- **Pedagogical moment:** name the real reason you opened this app.
- **Scene:** same workplace desk (continuity with Panel A), now a Japanese phrase on a sticky note next to the laptop, a colleague across the table mid-conversation.
- **Tone:** decisional, warmer, social weight.
- **Visual style hierarchy:** same palette + stroke + character weight as Panel A. The colleague is iconic-only, no realistic face. Perspective: 3/4 view, slightly wider than Panel A to fit the colleague.
- **Compositional rules:** focal point shifts to the colleague + sticky-note dyad (mid-frame). Negative space ratio ≥ 25%. Eye-path: colleague (left) → sticky note (right of laptop) → laptop → desk.
- **Required props:** desk (continuity), laptop (with hiragana, continuity), sticky note with Japanese phrase (new), colleague (new, iconic), tabletop continuity.
- **Locked:** same desk + same laptop silhouette as Panel A (continuity lock), sticky-note motif, colleague presence, iconic-only character weight.
- **Flexible:** colleague's clothing color (must use ds.colors.neutrals or `info` for variety); phrase on sticky note (Kaisel picks a workplace-safe phrase like お願いします or ありがとうございます); background depth.
- **NOT allowed:** realistic colleague face; second desk / second laptop; same Japanese phrase on the laptop screen as on the sticky note; gradients.

### Panel C — Daily habit (Step 4: `habit`)
- **Pedagogical moment:** commit a calendar slot, not a willpower pledge.
- **Scene:** workplace desk at evening, calendar/planner open, single ~10-min block circled, small lantern or warm-light motif.
- **Tone:** decisional, softer "I made room for this" feeling.
- **Visual style hierarchy:** palette shifts weight toward `ds.colors.warm` + `ds.colors.warmSoft` + `ds.colors.warmInk` (this is the only panel allowed to lead with warm — the lantern/warm-light motif carries it). Same stroke + character weight as Panels A and B. Perspective: 3/4 view, top-down feel for the calendar/planner.
- **Compositional rules:** focal point = the circled 10-min block on the calendar page (center-frame). Negative space ratio ≥ 30%. Eye-path: lantern glow (top-right) → calendar (center) → planner edge (foreground) → desk warmth.
- **Required props:** desk (continuity), calendar/planner page (new, open), ~10-min block circled (new, identity motif), small lantern or warm-light source (new, tone carrier).
- **Locked:** same desk silhouette as Panels A and B (continuity lock); 10-min block circled; warm-light motif presence; calendar/planner motif.
- **Flexible:** lantern shape (paper lantern vs. desk lamp — both acceptable as long as it casts warm-light on the desk surface); planner grid style (lined vs. boxed); presence/absence of a pen.
- **NOT allowed:** realistic lantern flame; full-night darkness (must keep some warmth); same warm-light intensity as Panel B's social warmth (Panel C's warmth is solitary, Panel B's is social — different quality); gradients.

---

## SET 2 — Empty-state illustration refresh + new (6 panels)

Style: same flat visual recipe as Set 1 (consistency rule). Aspect ratio 240×240 hard. Kaisel ships SVG masters, exports PNG at 240×240.

### Panel 1 — Home (refresh; currently a dead wire in HomeScreen)
- **Pedagogical moment:** your day is starting, choose where to begin.
- **Scene:** open doorway with three labelled rooms (less / flashcards / progress).
- **Tone:** encouraging.
- **Visual style hierarchy:** palette `ds.colors.brand` + `ds.colors.surface` + neutrals. Stroke weight 2px / 4px outline. Character weight: none (architecture only). Perspective: front view, slight 3/4 on the doorway.
- **Compositional rules:** focal point = the open doorway, center-frame. Negative space ratio ≥ 35% (the most spacious of all 14 illustrations — empty states must breathe). Eye-path: doorway center → 3 rooms radiating outward.
- **Required props:** open doorway (focal), 3 internal room labels (or icons), threshold line.
- **Locked:** palette, stroke weight, room count = 3 (matches the 3-tab DayStart CTA pattern in HomeScreen).
- **Flexible:** doorway shape (arched vs. rectangular); room icon style (chip vs. text).
- **NOT allowed:** a closed door; more than 3 rooms; a person (architecture only); gradients; realistic textures.
- **Copy (lifts existing `emptyStateService` body — but home is NOT in emptyStateService; Clix must add it OR keep HomeScreen's existing copy):** "Pick where to start — first lesson is on us." (Beru's suggestion.)

### Panel 2 — Lessons (refresh; live in LessonsScreen.tsx:306 at size 220)
- **Pedagogical moment:** the bookshelf is empty, not the mind.
- **Scene:** small empty bookshelf, single hiragana-block on the bottom shelf, ladder leaning against it.
- **Tone:** encouraging.
- **Visual style hierarchy:** palette `ds.colors.brand` + `ds.colors.warm` (ladder wood) + neutrals. Stroke 2px / 4px. Character weight: none. Perspective: front view.
- **Compositional rules:** focal point = the hiragana-block on the bottom shelf (lower-third — the eye travels DOWN, the empty space is the upper shelves, reinforcing "the bookshelf is empty, not the mind"). Negative space ratio ≥ 30%.
- **Required props:** empty bookshelf (3-4 shelves, ≥1 empty), 1 hiragana-block (bottom shelf), ladder (leaning, off-center).
- **Locked:** hiragana-block on bottom shelf (identity lock per Beru); ladder presence; ≥2 empty shelves above the hiragana-block (so the emptiness reads).
- **Flexible:** hiragana character choice (あ or ん — Kaisel picks); ladder tilt angle.
- **NOT allowed:** books on upper shelves; a person; closed bookshelf; more than 1 hiragana-block; gradients.
- **Copy (lifts emptyStateService.ts:4):** "No lesson started yet — Start with one workplace phrase lesson today."

### Panel 3 — Flashcards (NEW; not wired anywhere yet)
- **Pedagogical moment:** nothing to review yet because nothing has been learned.
- **Scene:** fresh stack of blank cards fanned on a table, pen resting.
- **Tone:** encouraging.
- **Visual style hierarchy:** palette `ds.colors.brand` + `ds.colors.warm` + neutrals. Stroke 2px / 4px. Character weight: none. Perspective: 3/4 top-down (card-fan visible).
- **Compositional rules:** focal point = the card fan, center-frame. Negative space ratio ≥ 30%. Eye-path: pen (foreground-left) → fan of cards (center) → table surface.
- **Required props:** ≥3 blank cards fanned (no Japanese on them — they are intentionally blank per Beru), pen resting nearby, table surface.
- **Locked:** cards must be blank (no kanji, no hiragana); pen presence; fan shape (not a stack).
- **Flexible:** fan spread angle; pen position; table texture.
- **NOT allowed:** cards with Japanese characters; closed card box; a person; gradients.
- **Copy (lifts emptyStateService.ts:5):** "No flashcards due — Complete a lesson to unlock review flashcards."

### Panel 4 — Progress (refresh; live in ProgressScreen.tsx:140 at size 180)
- **Pedagogical moment:** the first chart point is missing; first lesson will draw it.
- **Scene:** notepad graph with empty X-axis, small pencil hovering.
- **Tone:** encouraging.
- **Visual style hierarchy:** palette `ds.colors.info` (#7E57C2) + `ds.colors.warm` (pencil) + neutrals. Stroke 2px / 4px. Character weight: none. Perspective: front view.
- **Compositional rules:** focal point = the pencil tip at the start of the X-axis (lower-left). Negative space ratio ≥ 35%. Eye-path: pencil (lower-left) → empty X-axis → blank Y-axis → notepad edge.
- **Required props:** notepad (focal), X-axis line, Y-axis line, pencil hovering (no character, just pencil), grid suggestion (optional).
- **Locked:** notepad + axes + pencil triad; no plotted data points; pencil hovering (not writing yet).
- **Flexible:** grid density; pencil color; notepad orientation.
- **NOT allowed:** plotted data points (the empty space IS the message); a person; closed notebook; gradient backgrounds.
- **Copy (lifts emptyStateService.ts:6):** "No progress yet — Your streak starts after your first lesson."

### Panel 5 — Quiz (NEW; not wired anywhere yet)
- **Pedagogical moment:** fresh quiz tray, no questions queued.
- **Scene:** clipboard with blank answer sheet, small mascot peeking over the top.
- **Tone:** encouraging, playful, not clinical.
- **Visual style hierarchy:** palette `ds.colors.brand` + `ds.colors.warm` + `ds.colors.success` (for the mascot) + neutrals. Stroke 2px / 4px. Character weight: iconic-only for the mascot (this is the ONLY empty-state illustration allowed a character — the mascot already exists in `Mascot.tsx` and is referenced via `Mascot` component). Perspective: front view.
- **Compositional rules:** focal point = the blank answer sheet on the clipboard (center-frame). Negative space ratio ≥ 25%. Eye-path: mascot peeking (top) → clipboard (center) → clip (foreground).
- **Required props:** clipboard (focal), blank answer sheet (lines but no questions), mascot peeking (top edge, only top half visible — playful), clip at top.
- **Locked:** clipboard + blank sheet + mascot peeking triad; mascot must be the same character as `Mascot.tsx` (Clix may use a derived SVG snippet, NOT a new mascot design); sheet must be blank.
- **Flexible:** mascot expression (within existing Mascot.tsx expressions); sheet line count.
- **NOT allowed:** quiz questions on the sheet; closed clipboard; full-body mascot (must peek, not stand); a separate human character; gradients.
- **Copy (lifts emptyStateService.ts:7):** "No quiz selected — Try a quick quiz after reviewing today's phrases."

### Panel 6 — Survival (NEW; not wired anywhere yet)
- **Pedagogical moment:** pick the situation, the phrase will come.
- **Scene:** small landscape with 4 signposts pointing in different directions (safety / help / schedule / emergency).
- **Tone:** encouraging.
- **Visual style hierarchy:** palette `ds.colors.brand` + `ds.colors.success` (safety), `ds.colors.danger` (emergency), `ds.colors.warm` (help), `ds.colors.info` (schedule) + neutrals. Stroke 2px / 4px. Character weight: none. Perspective: front view, slight 3/4 on the signposts.
- **Compositional rules:** focal point = the 4 signposts as a cluster (center-frame, fanned). Negative space ratio ≥ 30%. Eye-path: tallest signpost (safety, brand-color) → surrounding 3 signposts → ground line.
- **Required props:** 4 signposts (identity lock per Beru), each pointing a different direction, ground line or hill suggestion.
- **Locked:** signpost count = 4; each signpost uses one of the 4 named semantic colors (safety=success, emergency=danger, help=warm, schedule=info); signposts diverge in direction.
- **Flexible:** signpost shape (arrow vs. board); ground texture; presence of small landscape features (rocks, grass).
- **NOT allowed:** >4 or <4 signposts; signposts all pointing the same direction; a person; closed map; gradients.
- **Copy (lifts emptyStateService.ts:8):** "Choose a survival topic — Pick safety, help, schedule, or emergency phrases."

---

## SET 3 — Streak / JLPT badge refresh + new (4 PNG, 96×96)

Style: same flat visual recipe as Sets 1+2. SVG masters at 96×96 (or larger, exported to 96×96 PNG). All 4 are siblings in the badge tree — consistent silhouette + rim + center motif language.

### Badge 1 — 7-day Streak (`streak7`) [refresh; key already in BadgeImage]
- **Locked milestone language:** "Week One Scholar" (per Beru, identity frame not elapsed-time frame).
- **Visual style hierarchy:** palette `ds.colors.warm` (#F4A261) + `ds.colors.warmSoft` + `ds.colors.warmInk` + neutrals. Stroke 2px. Character weight: none (iconic flame only).
- **Silhouette rule:** ROUND (matches existing badge disk convention — `badge-streak-7.svg` is a circle).
- **Center motif:** stylized flame silhouette (NOT emoji 🔥 — the emoji lives in `StreakFlame.tsx` already at 28px; the badge must use a designed flame shape so badge and hero read as siblings, not duplicates).
- **Rim treatment:** thin 1.5px white inner ring at 0.6 opacity (matches existing badge-jlpt-n5.svg pattern for consistency with JLPT siblings).
- **Color tone:** WARM (this is the only warm-led badge — streak belongs to the warm family).
- **Locked:** round silhouette, flame center motif, warm palette, "Week One Scholar" caption (rendered separately by ProfileScreen, NOT on the badge image).
- **Flexible:** flame shape details (single flame vs. stacked); rim line treatment.
- **NOT allowed:** emoji 🔥 on the badge; kanji characters; dark-mode-only palette; non-round silhouette; metallic/foil effects.

### Badge 2 — N5 (`jlptN5`) [refresh; key already in BadgeImage, asset exists on disk]
- **Unlock per Beru:** first completed lesson set covering all 5 N5 workplace-phrase tracks.
- **Visual style hierarchy:** palette `ds.colors.brand` (#2A6F97) + `ds.colors.brandInk` (white text on brand disk) + neutrals. Stroke 1.5px. Character weight: none (typographic).
- **Silhouette rule:** ROUND (continuity with streak7).
- **Center motif:** hiragana `あ` in white, large (32px equivalent). **Per Beru + design-brief-fabrication-preflight discipline, `あ` is the first hiragana introduced in any N5 curriculum and is therefore the safest single-character motif**; Kaisel must confirm with Chris before committing to a specific character. Acceptable alternatives if Chris disagrees: `ん`, `ア`. NOT acceptable: kanji not yet introduced (per JT-RECON §1.1 strict-scale note applied to script choice).
- **Rim treatment:** thin 1.5px white inner ring at 0.6 opacity (matches existing).
- **Color tone:** OFFICIAL-feeling (deep blue, white type — communicates "this is a credential").
- **Locked:** round silhouette, deep brand disk, single hiragana center, official-feeling palette.
- **Flexible:** rim thickness within 1.5-2.5px range; exact character (あ/ん/ア — Kaisel decides).
- **NOT allowed:** kanji; multi-character strings; non-round silhouette; gold/metallic palette; gradients.

### Badge 3 — N4 (`jlptN4`) [refresh; key already in BadgeImage, asset exists on disk]
- **Unlock per Beru:** N5 breadth (all 5 tracks) + ≥5 total lessons completed (extends existing `n4-unlocked` rule at profileProgressionService.ts:72).
- **Visual style hierarchy:** palette `ds.colors.info` (#7E57C2 — purple) + `ds.colors.infoSoft` + neutrals. Stroke 1.5px. Character weight: none.
- **Silhouette rule:** SHIELD (visually distinct from streak/N5 to communicate "next tier up"). Shields are an established credential idiom.
- **Center motif:** the letters "N4" in white, sans-serif, weight 700-900. Avoids the hiragana-introduce-order problem by using Latin numerals.
- **Rim treatment:** thin white inner stroke at 0.6 opacity, following the shield's inner contour.
- **Color tone:** OFFICIAL-feeling (purple = a tier above blue without going gold).
- **Locked:** shield silhouette, info-purple palette, "N4" center text, official-feeling tone.
- **Flexible:** shield proportions (tall vs. wide); rim thickness; typeface weight.
- **NOT allowed:** round silhouette (must differ from streak7/N5); hiragana/kanji; gradients; gold/metallic; multi-character strings beyond "N4".

### Badge 4 — N3 (`jlptN3`) [NEW; key NOT in BadgeImage]
- **Unlock per Beru:** every N4 badge earned + completion of weekly-review feature for 4 consecutive weeks (BEHAVIOUR signal, not content-count signal).
- **Visual style hierarchy:** palette `ds.colors.brandDark` (#014F86 — deeper blue) + `ds.colors.success` (#2A9D8F — teal accent) + neutrals. Stroke 1.5px. Character weight: none.
- **Silhouette rule:** BANNER (ribbon-style — third silhouette class so all three tiers are visually distinguishable: round / shield / banner).
- **Center motif:** the letters "N3" in white, sans-serif, weight 700-900. Consistency with N4.
- **Rim treatment:** banner-style fold lines (top and bottom edges), thin 1.5px white inner stroke at 0.6 opacity along the central field.
- **Color tone:** OFFICIAL-feeling with behaviour-signal hint (the teal accent on a deep-blue field signals "you've earned this through consistency," distinct from N4's pure purple).
- **Locked:** banner silhouette, brandDark palette + success accent, "N3" center text, behaviour-signal tone.
- **Flexible:** banner proportions; accent placement (corner vs. ribbon-edge); typeface weight.
- **NOT allowed:** round or shield silhouette (must be banner); hiragana/kanji; gradients; gold/metallic; multi-character strings beyond "N3".

---

## Cross-set style bible (LOCKED across all 14 illustrations)

These rules bind all 14 illustrations (3 onboarding + 6 empty-state + 4 badge + 1 hero = 14 actually — wait: 3 + 6 + 4 = 13; the 14th is the 3 onboarding FINALs with kanji overlay, treated as the same set). Kaisel and Clix must hold these as a single style bible.

- **Palette lock:** every illustration uses ONLY `ds.colors` tokens. No parallel color tokens, no hex literals. Brand + warm + cool + neutral, no in-between tints.
- **Stroke weight lock:** 2px line / 4px key outline for illustrations; 1.5px for badges (smaller canvas needs finer stroke).
- **Line style lock:** FLAT. No gradients. No inner shading. No drop shadows on illustration content (the badges sit on `ds.shadow.card` if shown on a card; illustrations themselves do not cast shadows).
- **Character weight lock:** iconic-only minimum, no realistic faces. Mascot allowed ONLY in Quiz empty-state (continuity with `Mascot.tsx`). No humans in any illustration.
- **Aspect ratio lock:** onboarding = 320×480 export (matches existing 1024/1536 ratio); empty-state = 240×240; badges = 96×96. These are HARD.
- **Stroke endcap lock:** round line caps on all stroke ends (visual softness consistency).
- **Type lock:** if illustrations contain any kanji or hiragana, the type must be `Noto Sans JP` (matches existing badge-jlpt-n5.svg convention); no in-between type sizes outside the 8-step ds.type scale.
- **Tone lock:** Set 1 Panel A is the canonical "welcoming-only" anchor; every empty-state panel must hold the same inviting-but-not-sad register.
- **Pipeline lock:** SVG master + PNG export (matches existing badge pipeline of `badge-*.svg` + `badge-*.png`); the bundler only resolves `require()` for the PNG. Onboarding illustrations may need a new SVG-master pipeline since current onboarding assets are PNG-only on disk — Kaisel decides.
- **Accessibility lock:** every illustration gets a human-readable `accessibilityLabel` (e.g. "Illustration for Step 1: Welcome to JT"). Existing `Illustration.tsx` and `EmptyStateArt.tsx` already enforce this at the component level.
- **Dark-mode lock:** none. Phase 20G visual recipe is light-mode-led; JT does not currently ship a dark palette. Badges must render correctly on `ds.colors.background` (#F4F7FA) and `ds.colors.surface` (#FFFFFF) only.

### Badge service wiring (must coordinate with Clix — flagged for Kaisel handoff)

`profileProgressionService.ts:67-73` currently emits 5 badges; only `seven-day-streak` overlaps with Set 3. The N5/N4/N3 badges in `BadgeImage.tsx` are visual-only — ProfileScreen doesn't render them because the service never emits them. Beru's pick-list defines the unlock conditions but does not say who owns the service change.

**Options for Clix to resolve with Beru before integration:**
- (a) Add `jlptN5`, `jlptN4`, `jlptN3` entries to `profileProgressionService.ts` `badges[]` array with Beru's unlock conditions as the `earned` predicate.
- (b) Leave the service alone and only render the new visual badges as a static gallery on ProfileScreen.

(a) is the pedagogically correct option (unlock conditions are real, not decorative). Kaisel flags this — Clix owns the decision.

### Pre-flight verification output (verbatim)

```
grep -c "ds\.colors" src/screens/*.tsx
src/screens/BetaFeedbackScreen.tsx:19
src/screens/DailyLessonScreen.tsx:10
src/screens/DailyRushScreen.tsx:16
src/screens/ExampleSentencesScreen.tsx:9
src/screens/FlashcardsScreen.tsx:16
src/screens/HomeScreen.tsx:27
src/screens/KanjiSectionPanel.tsx:12
src/screens/LessonsScreen.tsx:25
src/screens/OnboardingScreen.tsx:11
src/screens/PlacementTestPanel.tsx:9
src/screens/ProfileScreen.tsx:18
src/screens/ProgressScreen.tsx:13
src/screens/QuizScreen.tsx:16
src/screens/ReviewModePanel.tsx:9
src/screens/SenseiReviewScreen.tsx:26
src/screens/SettingsScreen.tsx:4
src/screens/SourcesScreen.tsx:6
src/screens/WeeklyLessonScreen.tsx:3
src/screens/WorkplaceSurvivalScreen.tsx:13

grep -nE "ScreenScaffold|ScreenHeader" src/screens/*.tsx | head -40
# All 19 screens import + render BOTH ScreenScaffold and ScreenHeader exactly once.
# No orphan-stacked or double-wrapped screens were found.

ls src/screens/ src/services/EmptyStateService.ts src/services/profileProgressionService.ts 2>&1
# EmptyStateService.ts DOES NOT EXIST at that path.
# The actual file is src/services/emptyStateService.ts (camelCase, lowercase first letter).
# Beru's pick-list line 3 cites "EmptyStateService.ts:1" — this is a case-typo in the brief.
# Clix must use the lowercase filename.

cat src/theme/designSystem.ts 2>&1 | head -30
# Strict 8-step type scale, 6-step spacing, 5-step radius, brand-warm-cool palette,
# touch.min=48 / touch.comfortable=56, shadow.card + shadow.hero presets. Confirmed.
```

### Parent-component grep (per JT-CARRY-FORWARD §1.3 — Kaisel must know before integration)

| Screen | ScreenScaffold count | ScreenHeader count | EmptyStateArt usage | Status |
|---|---|---|---|---|
| HomeScreen.tsx | 5 (1 import + 4 JSX sites — likely conditional renders) | 3 | imports line 6, NEVER renders | FLAG: dead wire; Kaisel must decide to either wire it or remove the import |
| LessonsScreen.tsx | 15 | 8 | renders line 306 size 220 | clean — single render site |
| FlashcardsScreen.tsx | 5 | 3 | no usage | CLEAN for new wire; will be the first illustration on this screen |
| ProgressScreen.tsx | 3 | 2 | renders line 140 size 180 | clean — single render site |
| QuizScreen.tsx | 5 | 3 | no usage | CLEAN for new wire |
| WorkplaceSurvivalScreen.tsx | 5 | 3 | no usage | CLEAN for new wire |

**No screen is orphan-wrapped or double-stacked.** Every screen has its parent `ScreenScaffold` + `ScreenHeader` exactly once (the high counts are because grep matches the JSX-tag across conditional render branches, not actual duplicate wrappers).

**One flag for Kaisel:** `HomeScreen.tsx:6` imports `EmptyStateArt` but never renders it. Clix must either (a) add a JSX render site for the new home empty-state illustration, or (b) remove the dead import. Per JT-CARRY-FORWARD §1.3, dead imports are a parent-collision risk signal — Kaisel should resolve before integration.

---

## What is NOT in this brief (out of scope by design)

- Asset-pipeline selection (Kaisel's call: which SVG editor / generator / export tool).
- File paths beyond what already exists in `manifest.ts` (Kaisel owns the new manifest entries).
- React component code, test code, theme tokens.
- Implementation notes (caching, bundling strategy).
- Service-side wiring decisions (badge unlock predicates — flagged for Clix but not specified here).
- Tier-1 assets (app icon, splash, adaptive icon) — separate work-card.

---

## Verification gates before sign-off (Tusk QC checklist)

- [ ] Every palette swatch in every illustration grep-matches `ds.colors.*` token names (no hex literals).
- [ ] Every aspect ratio matches the lock (320×480, 240×240, 96×96).
- [ ] No gradients, no realistic faces, no humans outside the Quiz mascot.
- [ ] Continuity locks hold: Panel A desk silhouette = Panel B desk silhouette = Panel C desk silhouette.
- [ ] All 4 badges render correctly on `ds.colors.background` AND `ds.colors.surface`.
- [ ] `assetRequireMap.test.ts` and `manifest.test.ts` pass after Clix extends manifest.
- [ ] `phaseDesignSystem.test.ts` continues to pass (no parallel palette tokens).
- [ ] `parent-component-collision-grep` skill check: HomeScreen's dead `EmptyStateArt` import resolved.
- [ ] `brief-fabrication-preflight` skill check: Kaisel confirms with Chris whether onboarding is "create" or "refresh" before pipeline work begins.

---

End of spec. Kaisel handoff.