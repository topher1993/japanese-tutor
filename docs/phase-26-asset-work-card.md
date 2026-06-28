# Phase 26 — App Asset Generation: Consolidated Work Card

**Status:** Ready for Chris approval
**Started:** 2026-06-25
**Owner:** Belion (integration only — execution routes to Kaisel + Igris + Tusk)
**Approval:** Yellow risk (touches `app.json` which is P-A protected; needs Chris sign-off)

> **Note on governance:** Belion drafted the tool pipeline section because the Kaisel subagent produced no usable deliverable in 2 attempts. Sections 5–7 below are marked **"Belion-drafted, pending Kaisel validation"**. Kaisel remains the owner of tool execution — once Chris approves this plan, Belion re-routes execution to Kaisel (or executes directly if Kaisel remains blocked).

---

## 1. Summary — what we're building

| Tier | What | Count | Blocks release? |
|---|---|---|---|
| **1** Mandatory icons + splash | App icon 1024², Android adaptive trio, splash, iOS variants | 8 images | ✅ Yes |
| **2** Mascot + onboarding illustrations | Kō mascot + 3 onboarding panels + 3 empty-states | 7 assets | ❌ Polish |
| **3** Badges + JLPT badges | 8 achievement badges + 2 JLPT badges | 10 SVGs | ❌ Polish |

**Total: 25 assets.** Brand palette locked from `designSystem.ts`: brand `#2A6F97`, accent `#F4A261`, brandSoft `#E0F2FE`. Mascot = Kō (こ), minimalist droplet silhouette.

---

## 2. Beru's pedagogy (locked)

Source: `docs/asset-brief-beru.md` (~24.6 KB)

| Asset class | Beru's spec |
|---|---|
| Mascot "Kō" | Droplet silhouette, no limbs/mouth, brand `#2A6F97` body + amber `#F4A261` cheek dot, two colors max |
| Onboarding step 1 — Welcome | Kō on speech bubble with **日本語**, **あ**, **い**, **う** |
| Onboarding step 2 — Language pick | **Typography-only**, inline 24px mascot badge in corner |
| Onboarding step 3 — Workplace goal | Kō on stack of 3 cards with **しごと** + hard hat glyph |
| Onboarding step 4 — Daily habit | Kō beside calendar + **7時** + 1 amber cell |
| Empty states (illustrate 3 of 6) | Home, Lessons, Progress — Kō in simpler scenes |
| Empty states (typography-only 3 of 6) | Flashcards, Quiz, Survival |
| Achievement badges (8) | Circular frame, glyph-only variation, alternating brand/amber backgrounds |
| JLPT badges (2) | Same circle, **あ** vs **ア** + amber pip moves (bottom-right → top-right) |

**Tone:** calm + quietly warm (not playful, not professional). Generation order: Kō first → master icon → Android adaptive → splash → onboarding → empty-states → badges → JLPT badges.

---

## 3. Sensei's kanji safety (locked)

Source: `docs/sensei-character-inventory.md` (~18 KB)

### 3.1 — 10 approved phrases (use ONLY these in AI prompts / overlays)
| Phrase | Reading | Meaning | JLPT |
|---|---|---|---|
| 日本語 | にほんご | Japanese language | N5 |
| にほんご | — | (hiragana of above) | N5 |
| あ | — | hiragana "a" | N5 |
| い | — | hiragana "i" | N5 |
| う | — | hiragana "u" | N5 |
| しごと | — | work | N5 |
| 7時 | しちじ | 7 o'clock | N5 |
| ア | — | katakana "a" | N5 |
| 人 | ひと | person | N5 |
| 一 | いち | one | N5 |

### 3.2 — Hard no-list (Sensei's stroke-count danger zone)
**Do NOT generate or overlay these in any asset** — AI mangles them most: 勉強, 綺麗, 病院, 電話, 練習, 約束, 親切, 丁寧, 冷蔵庫, 危険, 結婚, 単語, 漢字, 言葉, 全部.

### 3.3 — Sensei's top recommendation
> **"For the app icon and splash, use hiragana-only or katakana-only text. Save kanji for onboarding illustrations where the 10 approved phrases can be carefully QA'd."**

Beru agrees: app icon/splash → **no Japanese text** (just Kō silhouette + brand colors). Japanese only on onboarding illustrations + JLPT badges, where Sensei's whitelist is QA'd per asset.

---

## 4. Igris's engineering spec (locked)

Source: `C:\Users\tophe\IGRIS_ASSET_SPEC.md` (~42 KB)

### 4.1 — Folder layout (kebab-case, source/ for hand-authored, generated/ gitignored)

```
src/assets/
├── source/                          ← checked into git
│   ├── icon/app-icon-master-1024.png
│   ├── splash/splash-master-1024.png
│   ├── adaptive/
│   │   ├── android-adaptive-foreground-432.png
│   │   ├── android-adaptive-background-432.png
│   │   └── android-adaptive-monochrome-432.png
│   ├── illustrations/
│   │   ├── onboarding/{01-welcome,02-goals,03-method,04-ready}.png
│   │   └── empty-state/{empty-no-flashcards,empty-no-lessons,empty-no-progress}.png
│   ├── badges/{badge-first-lesson,badge-streak-7,badge-streak-30,badge-kanji-100,badge-vocab-500,badge-perfect-quiz}.png
│   └── mascot/{mascot-base,mascot-happy,mascot-thinking,mascot-celebrate,mascot-encourage}.svg
├── README.md
├── manifest.ts                      ← single import point for screens
├── manifest.test.ts                 ← vitest, asserts every require resolves
├── types.ts                         ← AssetManifest, AssetKey
└── lint/no-direct-asset-require.js  ← eslint custom rule

/assets/                             ← top-level, referenced by app.json
├── icon.png                         ← symlink of master
├── splash.png
├── adaptive-icon.png
├── favicon.png
└── notification-icon.png
```

### 4.2 — app.json wiring (full proposed — applied at execution time only, NOT now)

```jsonc
{
  "expo": {
    "icon": "./assets/icon.png",
    "ios": {
      "icon": "./assets/icon.png",
      "supportsTablet": true,
      "bundleIdentifier": "com.belion.japanesetutor"
    },
    "android": {
      "icon": "./assets/icon.png",
      "package": "com.belion.japanesetutor",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundImage": "./src/assets/source/adaptive/android-adaptive-background-432.png",
        "monochromeImage": "./src/assets/source/adaptive/android-adaptive-monochrome-432.png",
        "backgroundColor": "#2A6F97"
      },
      "notification": { "icon": "./assets/notification-icon.png", "color": "#2A6F97" }
    },
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#2A6F97",
      "dark": { "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#0F172A" }
    },
    "web": { "favicon": "./assets/favicon.png" },
    "plugins": [
      "expo-sqlite",
      ["expo-build-properties", { "ios": { "deploymentTarget": "15.1" }, "android": { "minSdkVersion": 24 } }]
    ]
  }
}
```

### 4.3 — Asset manifest, lint, tests, CI
- `src/assets/manifest.ts` — typed grouped object, `as const`, TypeScript enforces "manifest.X is undefined" at build time
- ESLint custom rule `local/no-direct-asset-require` — full source in Igris's spec §5
- `src/assets/manifest.test.ts` (vitest) — walks the manifest, asserts every require target exists, is under size cap, no orphans
- `scripts/check-asset-sizes.mjs` — pre-build gate
- **Backward compatibility:** confirmed additive (no existing imports, no existing assets folder, no conflicting peer-deps)

---

## 5. Tool pipeline — Belion-drafted, pending Kaisel validation

> **⚠️ Governance caveat:** Belion drafted this section because the Kaisel subagent produced no deliverable in 2 attempts. Kaisel remains the owner of execution. If Kaisel is reachable for execution, this plan is routed to them; if not, Belion executes directly with Tusk QC.

### 5.1 — Recommended pipeline (decisive)

| Asset class | Tool | Why |
|---|---|---|
| App icon 1024² master | **`image_generate` (gpt-image-2-low)** via Hermes, 5–10 iterations, pick best | Highest leverage asset, worth iterations |
| Android adaptive foreground | `image_generate` with transparent-bg prompt, 3–5 iterations | Same brand silhouette as master |
| Android adaptive background | **`sharp` only** — solid `#2A6F97` or vertical gradient → `#014F86` | No AI needed, exact brand match |
| Android adaptive monochrome | **SVG re-trace manually**, NOT desaturated | Desaturated brand reads as muddy |
| Splash background | **`sharp` only** — solid `#E0F2FE` or subtle gradient `#E0F2FE` → `#FFFFFF` | No AI, brand consistency |
| Splash icon | Derivative of master icon (Kō centered, transparent bg) | Already authored with master |
| Onboarding illustrations (3) | `image_generate` + **SVG/text overlay for kanji** via `sharp` | Kanji must come from Sensei's whitelist, NEVER from AI |
| Empty-state illustrations (3) | `image_generate` + SVG overlay if any text | Same as onboarding |
| Achievement badges (8) | **SVG via `lucide-react-native` primitives**, NOT AI | Cheaper, consistent, scalable |
| JLPT badges (2) | SVG hand-authored (あ in circle, ア in circle + chevron) | Trivial, brand-perfect |
| Mascot (5 expressions) | SVG hand-authored from Kō base | Vector scales lossless, brand-perfect |

### 5.2 — Prompt templates (3 templates, 1 line each — NO Japanese text in prompts)

**Template 1 — App icon master:**
```
Minimalist mobile app icon, square 1024x1024, single soft droplet-shaped mascot character with two small dot eyes and one small circular cheek dot, solid ocean blue (#2A6F97) silhouette on brandSoft (#E0F2FE) background, no text, no limbs, no mouth, flat vector style, brand mark
```

**Template 2 — Onboarding illustration:**
```
Minimalist flat illustration for language learning app onboarding step, ocean blue (#2A6F97) droplet mascot character with one amber (#F4A261) cheek dot, sitting beside a single workplace prop (speech bubble OR stack of 3 cards OR calendar with one marked day), brandSoft (#E0F2FE) background, NO text anywhere in the image, flat vector, two-color brand palette only
```

**Template 3 — Mascot base:**
```
Minimalist brand mascot character, single rounded droplet/seed shape with two dot eyes and no mouth, one small amber (#F4A261) circular dot on the lower-right cheek area, solid ocean blue (#2A6F97) fill, transparent background, flat vector, no limbs, no other details
```

### 5.3 — Kanji overlay pipeline (3 steps)

1. **Generate blank asset** via `image_generate` with prompt that explicitly says "no text"
2. **Render approved kanji** as SVG text using Noto Sans JP (already in Expo) at the correct position, exported as a transparent PNG via `sharp`
3. **Composite overlay** — `sharp(input).composite([{ input: kanjiOverlay, gravity: 'center' }]).toFile(output.png)`

The 10 approved phrases Kaisel may use (from Sensei's whitelist §3.1): 日本語, にほんご, あ, い, う, しごと, 7時, ア, 人, 一.

**No other Japanese text is allowed in any asset.**

### 5.4 — Batch script outline (`scripts/generate-assets.mjs`)

```
1. read assets-manifest.json (list of {key, prompt, aspect, iterations, overlays})
2. for each entry:
3.   if entry.tool === 'sharp': render directly (no API call)
4.   if entry.tool === 'image_generate':
5.     for n in 1..entry.iterations:
6.       call hermes image_generate(prompt, aspect_ratio=entry.aspect)
7.       save to src/assets/source/generated/<key>-v<n>.png
8.       log {key, version, size, prompt, timestamp}
9.   if entry.overlays: for each overlay, render kanji SVG + composite via sharp
10. exit
```

Flags: `--dry-run` (skip writes, log only), `--only=icon,onboarding` (filter by key prefix).

### 5.5 — Cost analysis ($0 strict)

| Concern | Reality |
|---|---|
| `gpt-image-2-low` free tier | Available via Hermes active backend (OpenAI Codex); rate limits apply |
| Per-day free quota | Limited; expect ~50–100 images/day; back off on 429 |
| Rate limit (req/min) | Conservative; sequential calls with 2–5 sec delay between |
| Watermarks / quality | `gpt-image-2-low` is the low-quality variant — final assets need visual QA |
| Fallback if quota exhausted | ComfyUI local (skill exists, `comfyui`) — slower but truly $0 |
| Approximate total API calls | **~50–80 calls** for full 25-asset set (5 iterations × ~15 AI assets + 0 for SVG-only) |

### 5.6 — Storage plan

- **Raw generated:** `src/assets/source/generated/` — **gitignored**
- **Final committed:** `src/assets/source/{icon,splash,illustrations,badges,mascot,adaptive}/`
- **Top-level for app.json:** `/assets/` (symlinks or copies of master)
- **Optional Drive backup:** Kaisel's existing gws pipeline can sync `assets/` after commit

---

## 6. Execution plan (after Chris approves)

Per governance: **Yellow risk** (touches `app.json` which is P-A protected). Requires Chris sign-off.

### Step-by-step (governance-routed, no stacking)

| Step | Owner | Output | Risk |
|---|---|---|---|
| **1. Create folder structure + .gitignore entries** | Igris | `src/assets/source/...` skeleton, `generated/` gitignored | Green |
| **2. Generate Kō mascot SVG (base + 4 expressions)** | Kaisel | 5 SVG files | Yellow (assets/) |
| **3. Generate app icon 1024² (5–10 iterations)** | Kaisel + Chris picks favorite | master PNG | Yellow |
| **4. Derive Android adaptive (fg from master, bg via sharp, mono via SVG)** | Kaisel | 3 PNGs | Yellow |
| **5. Generate splash (bg via sharp + icon from master)** | Kaisel | splash.png | Yellow |
| **6. Generate 3 onboarding illustrations + overlay approved kanji** | Kaisel + Tusk QA | 3 PNGs | Yellow |
| **7. Generate 3 empty-state illustrations** | Kaisel + Tusk QA | 3 PNGs | Yellow |
| **8. Author 8 achievement badges + 2 JLPT badges (SVG)** | Igris + Beru | 10 SVGs | Yellow |
| **9. Build `manifest.ts` + `manifest.test.ts` + ESLint rule** | Igris | Code modules | Yellow (code) |
| **10. Wire `app.json` per Igris's diff** | Igris + Tusk reviews | app.json | **RED** (touches P-A protected asset) |
| **11. Tusk full QC pass** | Tusk | Sign-off | Green |
| **12. Final GPT-5.5 audit + Phase 26 close** | Belion | docs/phase-26-audit.md | Green |

---

## 7. What I need from you to proceed

### A. Approve this consolidated plan? (Y/N)
If yes, I dispatch Step 1 → Step 2 in order. Pause points per your pacing rules.

### B. Bundle identifier confirm
Igris's spec uses `com.belion.japanesetutor`. Per my memory, you have no Apple Developer Program or iOS bundle ID yet. Want me to use this placeholder, or do you have a different one?

### C. iOS-first or Android-first priority?
Apple Dev Program blocks iOS, so Android can ship first. Want me to bias Step 4 (Android adaptive) before Step 5 (iOS variants)?

### D. Pre-flight approval for `app.json` edits
Step 10 touches `app.json` which is P-A protected. Per governance, that needs your explicit "yes go ahead" before Igris applies the diff. Confirm OK to proceed when we get there?

### E. ComfyUI fallback OK?
If `gpt-image-2-low` quota runs out mid-generation, I want to fall back to ComfyUI local (already installed). Confirm OK?

---

## 8. Pause points (per your pacing preference)

I will NOT auto-execute. After your approval:

1. Step 1 (folders) + Step 2 (Kō mascot SVG) → check in with you to approve the mascot design before generating 24 more assets in its likeness
2. Step 3 (app icon) → check in with you to pick the favorite from 5–10 iterations before proceeding
3. Step 6 (onboarding kanji overlay) → Tusk QC report before commit
4. Step 10 (app.json) → explicit pause for your P-A sign-off
5. Final close → one consolidated report

---

## 9. Honest gap acknowledgment

| Gap | Impact | Mitigation |
|---|---|---|
| Kaisel's tool report never landed | Tool pipeline drafted by Belion (not Kaisel) | Clearly marked §5 as "Belion-drafted, pending Kaisel validation"; Kaisel can replace before execution |
| No real device smoke | Can't validate icons render correctly at 29 px | You do device check on Android (or Expo Go) after Step 5 |
| iOS blocked | Apple Dev Program needed | Android-first recommended (Step 4 before Step 5) |

---

## 10. Decision

| Choice | What |
|---|---|
| **A. Approve the plan** | Answer A–E above, I dispatch Step 1+2 |
| **B. Revise first** | Tell me what to change |
| **C. Pause assets** | Defer to a later date |
| **D. Different** | Your call |

Standing by. 🫡