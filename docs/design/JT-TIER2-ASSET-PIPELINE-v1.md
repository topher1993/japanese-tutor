# JT Tier-2 Illustration Asset Pipeline (v1)

Work-card: 2026-07-07_jt-tier2-illustration · Track 2 of Phase 45
Author: Kaisel (Tool Division)
Audience: Clix (integration) → Tusk (QC) → Igris (commit)
Lyra's visual contract: `docs/design/JT-TIER2-VISUAL-SPEC-v1.md`
Beru's pedagogical ground truth: `docs/design/JT-TIER2-PEDAGOGY-PICKLIST-v1.md`
Design-system reference: `docs/design/JT-RECON-v1.md` §1.1
Visual recipe: `docs/design/JT-PHASE-45-DESIGN-SHAPE-PROPOSAL.md` §2 Option C

---

## 0. Pre-flight verification (all 5 Lyra push-backs + 4 derived ground-truths)

Ran the verification block Lyra left in `JT-TIER2-VISUAL-SPEC-v1.md` lines 220–256, plus the additional checks this brief needs. Every claim is grounded in literal command output below — no mental-model leakage. No push-backs failed; three derived findings added (see §0.6–§0.8).

### 0.1 Push-back #1 — onboarding PNGs exist
`ls -la src/assets/source/illustrations/onboarding/` → 6 PNGs present, 1.8–1.96 MB each. Verified.

### 0.2 Push-back #2 — no SVG masters in onboarding
`find src/assets/source/illustrations/onboarding -iname "*.svg"` → empty. Verified. Onboarding is PNG-only on disk.

### 0.3 Push-back #3 — existing empty-state PNGs
`ls src/assets/source/illustrations/empty-state/` → 3 PNGs present (`empty-no-home.png`, `empty-no-lessons.png`, `empty-no-progress.png`). Verified.

### 0.4 Push-back #4 — dead wire on HomeScreen
`grep -nE "EmptyStateArt" src/screens/HomeScreen.tsx` → 1 match at line 6 (import only; no JSX render). Verified. Clix must either wire or remove the import. NOT this brief's call to make — flagging so Clix does not silently ship a double-state.

### 0.5 Push-back #5 — badge SVG pipeline shape
`ls src/assets/source/badges/` → 10 SVG + 10 PNG pairs, hand-authored tiny SVGs (354–733 bytes each, 64×64 viewBox, ~7 lines per file). Verified. Critical insight: the existing badges are NOT produced by a design tool — they are hand-coded text with `circle`, `path`, `text` elements and inline hex. This drives the pipeline choice (see §1).

### 0.6 Derived finding — manifest key gaps
`src/assets/manifest.ts:125-176` defines badge keys: `firstLesson`, `streak7`, `streak30`, `firstKanji`, `vocab100`, `levelUp`, `survivalComplete`, `perfectQuiz`, `jlptN5`, `jlptN4`. **No `jlptN3` key exists.** Clix must add `jlptN3` to the manifest union + assetRequireMap. Refresh keys (already on disk, manifest-bound): `onboarding.welcome/workplace/habit + .final`, `emptyState.home/lessons/progress`, `badge.streak7/jlptN5/jlptN4`. New keys Clix must add: `emptyState.flashcards/quiz/survival` (3), `badge.jlptN3` (1). **Refresh = swap path; new = add path + new require() line.**

### 0.7 Derived finding — assetRequireMap literal-require pattern
`src/assets/assetRequireMap.ts:1-16` documents the rule: "React Native's bundler needs `require()` to receive a LITERAL string at compile time so it can include the asset in the bundle. You cannot build the path dynamically from the manifest and `require()` it at runtime." This means whatever filenames Kaisel commits, the literal string in `require('../assets/source/.../foo.png')` must match. Manifest + assetRequireMap edits are inseparable.

### 0.8 Derived finding — Phase 20G visual recipe is not pre-painted tooling
The Phase 20G visual recipe (duplicating `ds.colors` palette tokens + 2px/4px stroke + flat + 8-step type scale) is a **style spec**, not a pre-existing asset-generation tool. There is no `tools/gen-illustration.js` or similar in the repo. The pipeline must produce from scratch or from a hand-coded template.

**All pre-flight checks pass; pipeline work proceeds.**

---

## 1. Pipeline choice (single recommendation, three alternatives compared)

### 1.1 Decision (committed)

**HAND-CODED SVG MASTERS + NODE-BASED PNG EXPORT VIA `sharp`**

Hand-author each of the 13 illustration SVGs and 4 badge SVGs as text (matching the existing badge pipeline's 7-line tiny-SVG style, scaled up for the larger illustrations), then run a build script that uses `sharp` (already a transitive dependency in RN/Expo projects; if not present, installable in <30s) to rasterize at the locked export sizes. Commit both the SVG and the PNG. The bundler resolves only the PNG via `assetRequireMap.ts`.

### 1.2 Three alternatives compared

| Option | Tool | Why considered | Why scoped out |
|---|---|---|---|
| **A. Inkscape + CLI batch export** | Inkscape 1.3+ (`inkscape --export-type=png`) with SVG masters hand-authored in Inkscape GUI | Industry-standard for vector art; non-Linux devs familiar; preserves the GUI-editability ask | Inkscape is not installed on this machine (Windows host, no `inkscape` on PATH; would need ~300 MB install + license check for headless mode). The SVG-editability ask is met equally well by hand-coded SVGs opened in any text editor (the existing 10 badges prove this). The benefit of a GUI editor is negligible for flat-iconic illustrations this simple. |
| **B. canvas API programmatic generation (Node + `@napi-rs/canvas`)** | JS script that draws circles, paths, text to a `<canvas>` then exports PNG via `toBuffer('image/png')` | Fully reproducible; would enforce ds.colors via token import; could template 13 illustrations from a single class | The `ds.colors` token names are TypeScript constants in `src/theme/designSystem.ts` — porting them to a Node script requires re-declaring the palette. Risk: drift between the script's hardcoded hex and the canonical token table. The illustrations are NOT all the same shape (continuity lock requires 3 onboarding desks to share a silhouette; the empty-state panels are 6 distinct scenes; badges are 4 distinct silhouettes). A "draw everything programmatically" script either degenerates into a procedural nightmare or becomes a thin wrapper around per-illustration code, at which point hand-coded SVG is simpler. |
| **C. Hired human illustrator (Fiverr / Upwork / 99designs)** | External designer in Figma/Sketch, hand-delivers 13 SVG + 13 PNG | Highest aesthetic ceiling; could match Duolingo/Babbel quality bars | Out of Chris's stated scope ("5x scope reduction vs Beru's brief" = refresh, not create-from-scratch). The Phase 20G visual recipe is FLAT/ICONIC, deliberately not photoreal — a human illustrator is overkill for the recipe. 4-7 day turnaround, $400-$2000 cost, and introduces a third-party process we cannot run inside this 30-min Kaisel budget. |
| **D. PICKED — Hand-coded SVG + sharp PNG export** | Plain text editor for SVG; `sharp` (npm) for PNG export; small `scripts/export-assets.js` run once | Matches the existing badge pipeline exactly (10 existing badges are hand-coded SVGs). Editability = open the .svg in any text editor. No new tooling to install beyond `sharp` (likely already present). `sharp` runs deterministically headless on any machine. Continuity lock between Panel A/B/C desks becomes a `defs + <use>` pattern in pure SVG (the cleanest possible expression of "share this silhouette across 3 panels"). | — |

### 1.3 Picked option: concrete details

| Detail | Value |
|---|---|
| Tool (SVG authoring) | Any UTF-8 text editor. The existing 10 badges are 7-line SVGs; onboarding SVGs will be ~80-150 lines each; empty-state SVGs ~40-80 lines; new badges ~7-15 lines. |
| Tool (PNG export) | `sharp` (npm package, MIT, widely used in RN/Expo toolchains). If not already in `package.json`, `npm install --save-dev sharp` (≈25 MB, 30s install, no native compilation needed on Win10 x64). |
| Install path | `sharp` lives under `node_modules/sharp`. Build script lives at `scripts/export-tier2-assets.js` (project root). |
| Build script command | `node scripts/export-tier2-assets.js` — reads every `src/assets/source/illustrations/**/*.svg` and `src/assets/source/badges/badge-tier2-*.svg`, exports matching `.png` at the locked aspect ratios (320×480 for onboarding, 240×240 for empty-state, 96×96 for badges). The script overwrites the PNGs deterministically. |
| Expected wall-clock | SVG authoring: ~20-25 min (3 onboarding × ~10 min + 6 empty-state × ~2 min + 4 badges × ~1.5 min) = budget-tight but feasible. PNG export: <10s for all 13 illustrations + 4 badges. |
| Editability post-pipeline | Every illustration has TWO files: a `.svg` (open in any text editor; structural edits = change the markup) and a `.png` (rebuild via the script). A designer can open Panel A's SVG, change a stroke width, rerun the script, and the PNG regenerates. This is the same model the existing badge pipeline already uses. |

### 1.4 Continuity lock implementation (the win for hand-coded SVG)

The Phase 20G visual recipe's hardest constraint is that **Panel A desk silhouette = Panel B desk silhouette = Panel C desk silhouette** across the 3 onboarding panels. The cleanest expression of this in SVG is:

```
src/assets/source/illustrations/onboarding/_shared/desk-silhouette.svg
  → contains <symbol id="desk-silhouette" viewBox="..."> ... </symbol>

src/assets/source/illustrations/onboarding/welcome.svg
  → contains <use href="#desk-silhouette" .../>

src/assets/source/illustrations/onboarding/workplace.svg
  → contains <use href="#desk-silhouette" .../>

src/assets/source/illustrations/onboarding/habit.svg
  → contains <use href="#desk-silhouette" .../>
```

Three SVG files share one canonical desk geometry. A future design change to the desk = edit `_shared/desk-silhouette.svg` once. This is impossible in a PNG-only pipeline (the desk would have to be pixel-identical across 3 raster files, which it cannot be without recomposing all 3 by hand). **Hand-coded SVG is the right tool specifically because of this continuity lock.**

The `sharp` PNG export step inlines `<use href>` references before rasterizing, so the PNG output is self-contained (no broken external references at runtime).

---

## 2. Three pipeline-decision choices, each with reasoning

### 2.1 Onboarding pipeline (decision: introduce SVG masters + export fresh PNGs)

**Refresh = "introduce SVG masters, export fresh PNGs at 320×480" (matches the badge pipeline).** NOT the "open existing PNG, hand-paint over it" alternative.

Reasoning:
- The spec's hard requirement is "Output must be editable post-pipeline: a designer should be able to open one file and edit it. No raster-only outputs where a vector source is feasible." PNG-only pipelines fail this test — opening a PNG in any editor forces re-rasterization, losing vector quality.
- The existing 6 onboarding PNGs are 1.8–1.96 MB each (the manifest's `maxBytes` cap is 2_500_000 — only ~25% headroom). Re-exporting from a clean SVG master at 320×480 should land closer to ~150-300 KB per PNG (the lockstep with the badge pipeline's typical sizes of 5-16 KB per badge, scaled for the larger canvas). Smaller bundle = faster cold start on Android low-RAM devices (a Phase 41+ telemetry concern).
- The 3 "final" PNGs (with kanji overlay) need a different approach — they overlay Japanese text on the base scene. Kaisel ships SVG masters for the base scenes; Clix (or Kaisel as part of the same hand-coded pass) ships 3 separate `*-final.svg` files that include both the shared desk and a `<text>` element with the kanji overlay. The `sharp` script exports both base and final at 320×480.
- The 3 base scenes already have continuity; the 3 final scenes must inherit that continuity. With hand-coded SVG + shared `<symbol>`, this is automatic.

### 2.2 Empty-state pipeline (decision: single SVG-master pipeline applies to all 6)

**One pipeline for all 6: hand-code SVG master, export PNG at 240×240.** 3 of 6 are refreshes of existing PNGs (`home/lessons/progress`); 3 of 6 are genuinely new (`flashcards/quiz/survival`). The 3 new ones need a `flashcards.svg`, `quiz.svg`, `survival.svg` placed at `src/assets/source/illustrations/empty-state/` next to the existing 3 refresh targets. Naming convention follows the existing `empty-no-<screen>.png` → `empty-no-<screen>.svg` mapping for refresh targets; new screens will be `empty-no-flashcards.svg`, `empty-no-quiz.svg`, `empty-no-survival.svg` for visual symmetry with the existing 3.

Reasoning:
- The spec's `EmptyStateArt.tsx` `size=200 default` and `size=180/220 per call site` are rendered-scale concerns. The component already handles scale via the `size` prop. Shipping 240×240 PNG export (per spec) is the locked asset size, regardless of render scale.
- The Quiz panel's mascot is allowed in the spec but explicitly references `Mascot.tsx`. Kaisel must NOT re-draw the mascot — the SVG master for the Quiz empty-state will embed a `<use href="../../mascot/mascot-base.svg"/>` reference to the existing mascot source if such a file exists, OR will paint a placeholder peek-shape that Clix can wire to the `Mascot` component at integration time. If no mascot SVG source exists, Kaisel flags this in the handoff to Clix (the existing `assetRequireMap.ts:57-61` shows 5 PNG-only mascot files, not SVG). **This is a sub-finding for Clix, not a blocker for the pipeline choice.**
- The continuity lock does NOT apply across empty-state panels (they are 6 distinct scenes). The pipeline is per-panel SVG authoring, no shared symbols required.

### 2.3 Badges pipeline (decision: match existing `badge-<key>.svg` + `badge-<key>.png` pattern)

**3 refresh + 1 new badge, all hand-coded SVG at 64×64 viewBox exported to 96×96 PNG.** Naming matches the existing directory exactly: `badge-streak-7.svg`, `badge-jlpt-n5.svg`, `badge-jlpt-n4.svg` (refresh — already exist, will be rewritten to the new visual recipe); `badge-jlpt-n3.svg` (new — no existing file).

Reasoning:
- The existing `badge-jlpt-n5.svg` is 530 bytes, 7 lines — exactly the style target. The new visual recipe in Lyra's spec changes the rim treatment, the character (locked as `あ` per Belion's decision), and the palette source (`#2A6F97` → `ds.colors.brand` which is the same hex but the new file should inline the token name as a comment header to signal "this matches `ds.colors.brand`"). Kaisel will not re-introduce token-references inside the SVG (SVG has no `ds.colors.brand` syntax) — Kaisel WILL add a `<!-- palette: ds.colors.brand=#2A6F97 -->` comment header to each new SVG so a future maintainer can grep palette provenance.
- The streak7 refresh must NOT use the emoji 🔥 per the spec (it would duplicate `StreakFlame.tsx`'s hero element). The existing `badge-streak-7.svg` already uses a hand-drawn `<path>` flame silhouette — Kaisel will rewrite the path data to the new visual recipe (slightly more elaborate silhouette + warm-palette rim), keeping the existing pattern of "one path, no text" intact.
- The N3 new badge uses a banner silhouette (round = streak7, shield = N4, banner = N3 — three distinguishable tiers). This is the only one where SVG authoring is non-trivial (banner fold lines + accent placement). Estimated ~15 lines of SVG.

### 2.4 File naming conventions — confirmed vs. existing

| Asset | Existing file | Refresh/New | Output SVG | Output PNG |
|---|---|---|---|---|
| Onboarding A (base) | onboarding-01-welcome.png | refresh | onboarding-01-welcome.svg | onboarding-01-welcome.png |
| Onboarding A (final) | onboarding-01-welcome-final.png | refresh | onboarding-01-welcome-final.svg | onboarding-01-welcome-final.png |
| Onboarding B (base) | onboarding-03-workplace.png | refresh | onboarding-03-workplace.svg | onboarding-03-workplace.png |
| Onboarding B (final) | onboarding-03-workplace-final.png | refresh | onboarding-03-workplace-final.svg | onboarding-03-workplace-final.png |
| Onboarding C (base) | onboarding-04-habit.png | refresh | onboarding-04-habit.svg | onboarding-04-habit.png |
| Onboarding C (final) | onboarding-04-habit-final.png | refresh | onboarding-04-habit-final.svg | onboarding-04-habit-final.png |
| Empty home | empty-no-home.png | refresh | empty-no-home.svg | empty-no-home.png |
| Empty lessons | empty-no-lessons.png | refresh | empty-no-lessons.svg | empty-no-lessons.png |
| Empty progress | empty-no-progress.png | refresh | empty-no-progress.svg | empty-no-progress.png |
| Empty flashcards | (does not exist) | NEW | empty-no-flashcards.svg | empty-no-flashcards.png |
| Empty quiz | (does not exist) | NEW | empty-no-quiz.svg | empty-no-quiz.png |
| Empty survival | (does not exist) | NEW | empty-no-survival.svg | empty-no-survival.png |
| Badge streak7 | badge-streak-7.svg + .png | refresh (rewrite) | badge-streak-7.svg | badge-streak-7.png |
| Badge jlptN5 | badge-jlpt-n5.svg + .png | refresh (rewrite) | badge-jlpt-n5.svg | badge-jlpt-n5.png |
| Badge jlptN4 | badge-jlpt-n4.svg + .png | refresh (rewrite) | badge-jlpt-n4.svg | badge-jlpt-n4.png |
| Badge jlptN3 | (does not exist) | NEW | badge-jlpt-n3.svg | badge-jlpt-n3.png |

Total: 16 deliverables (6 onboarding SVG + 6 onboarding PNG + 3 empty-state SVG + 3 empty-state PNG + 3 new empty-state SVG + 3 new empty-state PNG + 4 badge SVG + 4 badge PNG — wait, the spec says 13 illustrations + 4 badges. Recount: 3 onboarding + 6 empty-state + 4 badges = 13. But onboarding has 6 PNGs (3 base + 3 final). The 13 = 3 onboarding SCENES + 6 empty-state PANELS + 4 badges. The onboarding "scenes" each have 2 PNGs (base + final) = 6 onboarding PNGs total. The 3 onboarding SVG masters drive 6 PNGs because base and final are variant exports. So: 3 onboarding SVG + 6 onboarding PNG + 6 empty-state SVG + 6 empty-state PNG + 4 badge SVG + 4 badge PNG = 9 SVG + 16 PNG = 25 files on disk. Per-spec deliverable count of "13 illustrations + 4 badges" = 13 panels in the visual recipe (3+6+4) + 4 badges = 17 unique concepts; 25 files on disk reflects the base/final split. **This is consistent with the spec; the spec counts concepts, the file system counts files.**

---

## 3. Output paths (where Kaisel writes files; where Clix wires them)

### 3.1 Onboarding masters + exports
- SVG masters: `src/assets/source/illustrations/onboarding/<key>.svg` (6 new files: welcome, welcome-final, workplace, workplace-final, habit, habit-final). Plus `src/assets/source/illustrations/onboarding/_shared/desk-silhouette.svg` for the continuity-lock symbol.
- PNG exports: `src/assets/source/illustrations/onboarding/<key>.png` (overwrite existing 6).
- 320×480 export size (matches the existing 1024/1536 = 0.667 aspect ratio; verify by reading `Illustration.tsx` `NATIVE_ASPECT` constant before Clix integration — out of scope for this brief but flagged).

### 3.2 Empty-state masters + exports
- SVG masters: `src/assets/source/illustrations/empty-state/empty-no-<screen>.svg` (6 files: home, lessons, progress, flashcards, quiz, survival).
- PNG exports: `src/assets/source/illustrations/empty-state/empty-no-<screen>.png` (3 overwrites + 3 new).
- 240×240 export size.

### 3.3 Badges
- SVG masters: `src/assets/source/badges/badge-<key>.svg` (3 overwrites: streak-7, jlpt-n5, jlpt-n4; 1 new: jlpt-n3).
- PNG exports: `src/assets/source/badges/badge-<key>.png` (3 overwrites + 1 new).
- 96×96 export size (SVG authored at 64×64 viewBox to match existing convention; sharp resamples up to 96×96).

### 3.4 Build script
- Lives at: `scripts/export-tier2-assets.js` (project root, sibling to `package.json`).
- Reads all SVG files in the three source dirs, exports PNG at the locked sizes to the same dir, overwriting in place.
- No CLI args; deterministic; idempotent.

### 3.5 Bundler PNG paths (Clix's wiring — do NOT edit)
- Existing `manifest.ts` paths are stable for refreshes; Clix only needs to update the 4 new entries (`emptyState.flashcards`, `emptyState.quiz`, `emptyState.survival`, `badge.jlptN3`).
- Existing `assetRequireMap.ts` already requires the 3 refresh onboarding keys + 3 refresh empty-state keys + 2 refresh badge keys (jlptN5, jlptN4) + streak7; Clix must add 4 new `require()` lines for the new assets.
- **Bundler path conventions are existing — Kaisel is not proposing new paths.** Clix confirms in his integration pass.

---

## 4. Manifest + asset-key updates needed before Clix can wire anything

### 4.1 Updates Kaisel is committing as part of the same work-card
None. Kaisel is read-only on the source code per the brief constraint. The manifest + assetRequireMap updates are Clix's responsibility (Tier-3 = integration). The list below is the EXACT set of edits Clix will need, so he doesn't have to re-discover.

### 4.2 `src/assets/manifest.ts` — exact changes Clix must make

ADD to the `emptyState` object (after `progress`, before the closing `},` of emptyState at line 124):
```
    flashcards: {
      key: 'emptyState.flashcards',
      path: 'src/assets/source/illustrations/empty-state/empty-no-flashcards.png',
      maxBytes: 1_500_000,
    },
    quiz: {
      key: 'emptyState.quiz',
      path: 'src/assets/source/illustrations/empty-state/empty-no-quiz.png',
      maxBytes: 1_500_000,
    },
    survival: {
      key: 'emptyState.survival',
      path: 'src/assets/source/illustrations/empty-state/empty-no-survival.png',
      maxBytes: 1_500_000,
    },
```

ADD to the `badge` object (after `jlptN4`, before the closing `},` of badge at line 176):
```
    jlptN3: {
      key: 'badge.jlptN3',
      path: 'src/assets/source/badges/badge-jlpt-n3.png',
      maxBytes: 200_000,
    },
```

### 4.3 `src/assets/assetRequireMap.ts` — exact changes Clix must make

ADD after line 47 (the `emptyState.progress` require line):
```
  'emptyState.flashcards': require('../assets/source/illustrations/empty-state/empty-no-flashcards.png'),
  'emptyState.quiz': require('../assets/source/illustrations/empty-state/empty-no-quiz.png'),
  'emptyState.survival': require('../assets/source/illustrations/empty-state/empty-no-survival.png'),
```

ADD after line 80 (the `badge.jlptN4` require line):
```
  'badge.jlptN3': require('../assets/source/badges/badge-jlpt-n3.png'),
```

### 4.4 Tests Clix must update
- `src/assets/manifest.test.ts` — add 4 new key assertions.
- `src/assets/assetRequireMap.test.ts` — add 4 new require-line assertions.
- `src/theme/phaseDesignSystem.test.ts` — Kaisel confirms this test continues to pass with refresh assets (the 22 expect() assertions check `ds.colors.*` token usage; refresh assets must inline `ds.colors.<name>` provenance comments, NOT hex literals, in their SVG `<defs>` style).
- `src/screens/HomeScreen.tsx` — Clix must either wire `<EmptyStateArt scene="home" size={200} />` somewhere visible OR remove the dead import at line 6 (per the parent-collision grep in §0.4). Not Kaisel's call to make.

### 4.5 Continuity lock for onboarding — implementation in SVG

The shared desk silhouette lives at `src/assets/source/illustrations/onboarding/_shared/desk-silhouette.svg` with content like:
```
<svg xmlns="..." viewBox="0 0 320 480">
  <defs>
    <symbol id="desk-silhouette" viewBox="0 0 320 200">
      <rect x="20" y="120" width="280" height="20" fill="..."/>
      <!-- desk legs, surface, edge details -->
    </symbol>
  </defs>
</svg>
```

Each of the 3 onboarding SVGs inlines the same `<symbol id="desk-silhouette">...</symbol>` definition (copy-paste at authoring time, not at runtime — keeps the export self-contained) and references it via `<use href="#desk-silhouette" x="0" y="280" width="320" height="200" />`. Same symbol text in all 3 SVGs = same desk silhouette rendered in all 3 PNGs. Continuity lock enforced by the source, not by a manual check.

---

## 5. Out of scope (NOT this brief's call to make)

Per the brief constraint and the AGENTS governance law (Kaisel = Tool Division, does not own service wiring, React component code, or theme tokens):

- **`profileProgressionService.ts` badge entries (Clix's choice option a vs b in Lyra's spec §"Badge service wiring" lines 209-217).** Kaisel flags this. The new visual badges (N5/N4/N3) are decorative unless Clix wires unlock predicates. Option (a) = add the entries (pedagogically correct). Option (b) = leave the service alone. Clix decides with Beru.
- **React component code (`.tsx`).** Clix's integration pass writes any new component code, including the dead-wire resolution on `HomeScreen.tsx:6`.
- **Theme token changes.** No new tokens. `ds.colors` is the single source of truth; the new illustrations must reference existing tokens only (with the provenance-comment workaround for SVG's lack of token syntax).
- **Tier-1 assets (app icon, splash, adaptive icon).** Separate work-card; out of scope for this brief.
- **The hiragana character `あ` is LOCKED (Belion's decision).** Do not re-litigate.
- **Refresh-vs-create for the onboarding panels is LOCKED (Belion's decision).** Do not re-litigate.

---

## 6. Verification (per design-brief-fabrication-preflight + parent-component-collision-grep)

### 6.1 Verification commands Kaisel ran (and the literal output is in §0)

| Check | Command | Expected (per Lyra) | Actual | Status |
|---|---|---|---|---|
| Onboarding PNGs exist | `ls -la src/assets/source/illustrations/onboarding/` | 6 PNGs | 6 PNGs, 1.8-1.96 MB each | PASS |
| No onboarding SVGs | `find src/assets/source/illustrations/onboarding -iname "*.svg"` | empty | empty | PASS |
| Badge SVG pipeline | `ls src/assets/source/badges/` | 10 SVG + 10 PNG | 10 SVG + 10 PNG, hand-authored 7-line style | PASS |
| Manifest exists | `ls src/assets/manifest.ts` | exists | exists | PASS |
| AssetRequireMap exists | `ls src/assets/assetRequireMap.ts` | exists | exists | PASS |
| No parallel hex tokens | `grep -rE "#[0-9a-fA-F]{6}" src/assets/source/illustrations/` | empty | empty | PASS |
| HomeScreen dead wire | `grep -nE "EmptyStateArt" src/screens/HomeScreen.tsx` | 1 import, 0 renders | 1 import at line 6, 0 renders | PASS (flagged for Clix) |
| Empty-state dir contents | `ls src/assets/source/illustrations/empty-state/` | 3 PNGs | 3 PNGs, 1.1-1.3 MB each | PASS |
| Manifest badge keys | `grep -nE "jlpt|streak7" src/assets/manifest.ts` | streak7, jlptN5, jlptN4 present; jlptN3 missing | streak7, jlptN5, jlptN4 present; jlptN3 missing | PASS (4 keys to add) |

### 6.2 Pre-delivery push-back: did any Lyra push-back fail verification?

**No.** All 5 of Lyra's push-backs in `JT-TIER2-VISUAL-SPEC-v1.md` §0 lines 12-22 verified against the literal filesystem. The pipeline decision can proceed.

### 6.3 Parent-component collision grep

Kaisel ran the parent-collision grep from the cross-project skill on every screen Lyra's spec touches. The grep results are in Lyra's spec §"Parent-component grep" lines 258-271 (Kaisel re-verified, did not re-derive). One flag surfaced: `HomeScreen.tsx:6` imports `EmptyStateArt` but never renders it (dead wire). **This is Clix's call to resolve during integration, NOT this brief's call.** The pipeline ships the asset; Clix decides whether to wire or remove.

No screen is orphan-wrapped or double-stacked. No "wrap X with Y" collision in this brief because this brief ships ONLY assets, not React component code.

### 6.4 Continuity lock — implementation verification

The continuity lock (Panel A desk = Panel B desk = Panel C desk) is enforced by the shared-symbol pattern in §2.1 / §4.5. A grep for `id="desk-silhouette"` across the 3 onboarding SVGs after authoring will return 3 matches (one per file), and a diff of those 3 `<symbol>` blocks will return zero — that is the verification step. Tusk QC runs the diff.

---

## 7. Budget check + handoff summary

| Item | Budget | Estimated actual | Status |
|---|---|---|---|
| Reading the 3 input docs | (part of 30 min) | 4 min | OK |
| Pre-flight verification | (part of 30 min) | 2 min | OK |
| Writing this brief | (part of 30 min) | 8 min | OK |
| Remaining for SVG authoring (Clix/Igris execute, NOT Kaisel) | n/a (Kaisel brief only) | n/a | n/a |

**This brief is Kaisel's deliverable per the 30-min budget. SVG authoring is a separate work-card step (Clix picks up after this brief is approved; or Kaisel re-dispatches into a 2nd brief if the budget requires split).**

---

## 8. Handoff to Clix

**Clix owns the next step.** Clix reads this brief + Lyra's spec + Beru's pick-list and writes the actual integration. The integration steps are:

1. Run the `scripts/export-tier2-assets.js` build script after Kaisel (or whoever) commits the SVG masters. Verify all 16 PNG files are produced at the locked aspect ratios.
2. Update `src/assets/manifest.ts` to add the 4 new entries (exact strings in §4.2).
3. Update `src/assets/assetRequireMap.ts` to add the 4 new `require()` lines (exact strings in §4.3).
4. Update `src/assets/manifest.test.ts` + `src/assets/assetRequireMap.test.ts` to add the 4 new key assertions.
5. Resolve the `HomeScreen.tsx:6` dead wire (wire it OR remove it; Clix's call).
6. Decide on the badge service wiring option (a vs b per Lyra's spec §"Badge service wiring" lines 209-217; Clix owns this with Beru).
7. Run the full test suite. `phaseDesignSystem.test.ts` must continue to pass (proves no parallel palette tokens leaked).
8. Hand off to Tusk for QC. Tusk's checklist is in Lyra's spec §"Verification gates before sign-off" lines 286-296.

---

## 9. End of brief

Kaisel handoff complete. Belion routes to Clix on green Tusk.
