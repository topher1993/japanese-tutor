# Phase 26 — App Asset Strategy Discussion Framework
**Status:** Pre-work discussion, no execution yet
**Started:** 2026-06-25
**Owner:** Belion (coordination only)
**Trigger:** Chris asked "can you discuss with the agent army how to generate our application assets"

---

## 1. Current state (what we know — grep-verifiable)

| Item | Status | Evidence |
|---|---|---|
| `src/assets/icons/` | **EMPTY** | `ls src/assets/icons/` → no files |
| `src/assets/illustrations/` | **EMPTY** | `ls src/assets/illustrations/` → no files |
| `src/assets/splash/` | **EMPTY** | `ls src/assets/splash/` → no files |
| Screens use `<Image>` | **ZERO** | `grep "Image source" src/` → no matches |
| Asset concept seeds | **PRESENT** | `src/services/assetConceptService.ts` defines logo, splash, illustration concepts |
| Design system | **PRESENT + mature** | `src/theme/designSystem.ts` — ocean blue (#2A6F97), amber accent (#F4A261), 5-step spacing, 4-step type scale, 5-step radius |
| `app.json` icon/splash refs | **NONE** | app.json has no `icon`, `splash`, `adaptiveIcon` keys |

**Bottom line:** App is currently text-only — every screen leans on typography + color + spacing + icon glyphs (in `Button.tsx`). No raster art anywhere.

---

## 2. The asset gap — what assets does the app actually need?

### Tier 1 — Mandatory for any release (App Store / Play Store won't accept without these)
| Asset | Spec | Purpose | Owner (gov) |
|---|---|---|---|
| App icon (1024×1024 master) | PNG, no alpha, no rounded corners | Play Store + iOS source | Kaisel (tool exec) + designer/AI |
| iOS icon set (20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024) | PNG | `app.json.icon` for iOS bundle | Kaisel |
| Android adaptive icon (foreground 1024×1024 + background 1024×1024 + monochrome) | PNG | `app.json.android.adaptiveIcon` | Kaisel |
| Splash icon / brand mark | 1242×2436 + smaller | `app.json.splash.image` | Kaisel |
| `favicon` (if web export) | 48×48, 96×96 | Optional | Kaisel |

### Tier 2 — Polish that materially helps a non-technical learner
| Asset | Spec | Purpose | Owner (gov) |
|---|---|---|---|
| Onboarding illustration (3 panels) | SVG/PNG, simple flat, 320×480 | Visual anchor for each onboarding step | Beru (what) + Kaisel (how) |
| Empty-state illustrations (Home, Lessons, Flashcards, Progress, Quiz, Survival) | 240×240 SVG | Calm "nothing here yet" instead of blank screen | Beru + Kaisel |
| Achievement / streak badges | 96×96 PNG set | "7-day streak 🔥" feels real | Beru (which) + Kaisel (how) |
| JLPT level badges (N5/N4) | 96×96 PNG | Visible learner progression | Beru + Sensei (linguistic accuracy) |

### Tier 3 — Optional delight (post-launch)
| Asset | Spec | Purpose | Owner |
|---|---|---|---|
| Category illustrations (workplace, safety, daily life, emergency) | 240×240 SVG | Lessons screen thumbnails | Beru + Kaisel |
| Mascot / guide character | Vector set | Optional "study buddy" feel | Beru + Kaisel |
| Loading skeletons | Animated SVG | Polish | Igris + Kaisel |

---

## 3. Governance routing for asset work

| Layer | Question | Owner | Why |
|---|---|---|---|
| **WHAT** | Which assets, how many, which JLPT levels, which pedagogical moment | **Beru** (learning strategy) + **Sensei** (Japanese accuracy) | Pedagogy decisions |
| **HOW** | Which generator (AI image, manual designer, icon font, SVG primitive), which tool/API | **Kaisel / Tool Division** | Tool/API execution |
| **WHERE** | File paths in repo, asset manifest, cache strategy | **Igris / Engineering** | App architecture |
| **VERIFY** | Visual + content accuracy, brand compliance, screen readability | **Tusk** (QC) | Quality gate |

**Rule:** Belion does not pick the generator. Belion routes the question to the right owner, gets their answer, integrates.

---

## 4. The strategic question (what to decide before any code)

The big fork is **AI-generated vs hand-designed vs icon-font**. Each has different ROI for our situation:

| Approach | Upfront cost | Brand fit | Scalability | Maintenance |
|---|---|---|---|---|
| **AI image gen (gpt-image / DALL-E / Midjourney)** | $0–30/mo | Inconsistent across screens | High (bulk gen) | Hard (regen everything to change one thing) |
| **Hand-designed (Figma + designer)** | $200–2k one-time | Cohesive | Low (each asset = designer hours) | Easy (own the file) |
| **Icon font / SVG primitives** | $0 (use existing libs like `lucide-react-native`) | Cohesive but generic | High | Easy (component swap) |
| **Hybrid: SVG primitives + 5–8 hero illustrations** | $0–100 | Cohesive | Medium | Medium |

**My read for our situation:**
- We're pre-launch, no revenue, no designer budget, App Store requires raster icons
- The app's visual strength today is **typography + color + spacing** (per `designSystem.ts`) — adding illustrations risks diluting that
- **Recommendation: Hybrid**
  - Tier 1 (mandatory app icons + splash): AI-generate + iterate 5–10x per asset, commit the best
  - Tier 2 (illustrations): skip or use 1–3 SVG primitives only
  - Tier 3 (delight): defer to post-launch with real learners

---

## 5. Open questions for Chris (the user)

1. **Budget:** Is $0 the constraint, or is $30–50/mo for Midjourney/DALL-E on the table?
2. **Brand direction:** Do you want a mascot (Duo-the-duo-style) or stay minimalist like current design?
3. **Cultural accuracy:** Are you OK with AI-generated imagery of Japanese text (high hallucination risk on kanji)? Or do we use English labels in illustrations + actual kanji from our data?
4. **iOS launch:** Are we still waiting on Apple Developer Program, or is Android first? (affects priority order of icon assets)
5. **Onboarding budget:** Is illustrated onboarding important, or is the current text-only good enough for beta?

---

## 6. What each army division needs to contribute

| Division | Pre-work needed before generation starts |
|---|---|
| **Beru** | Final list of which screens need illustrations, which moments in the learner journey get a visual reward |
| **Sensei** | Approve that all kanji/kana in any generated asset must come from our existing N5/N4 packs (no hallucinated characters) |
| **Igris** | Asset manifest spec: file naming, where they live, how screens reference them, caching strategy, lint rule for `require('./assets/...')` |
| **Kaisel** | Tool shortlist: which image gen API (gpt-image-2 via OpenAI key, or local ComfyUI, or Figma plugin), Drive storage plan, batch script |
| **Tusk** | QC checklist for generated assets: brand color compliance, no hallucinated kanji, readable at 48×48, looks correct on dark + light backgrounds |

---

## 7. Decision points (when ready)

Once Chris weighs in on §5 and §6, the next work card is:

```
WORK CARD: WC-AA-v2-ASSETS-001
Title: Generate Tier-1 mandatory app icons + splash for Play Store / iOS
Division: Igris (spec) + Kaisel (exec) + Sensei (kanji check) + Tusk (QC)
Risk: Yellow (touches app.json which is protected; production-render asset)
Required: Chris approval on approach + budget
```

---

## 8. Pause points

Per Chris's pacing preference ("avoid being stacked", "manageable steps"), this discussion halts here. Next move is Chris's call:
- A: Approve the hybrid recommendation, give budget answer, kick off Tier 1
- B: Decide against illustrations entirely, focus only on Tier 1 mandatory icons
- C: Different approach (provide direction)