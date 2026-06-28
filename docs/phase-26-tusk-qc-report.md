# Phase 26 — Tusk QC Pass

**Date:** 2026-06-25
**Reviewer:** Tusk (QC commander)
**Scope:** Steps 1–10 deliverables
**Risk:** Yellow (touches app.json P-A asset, all code is additive)

---

## On-disk verification (grep + filesystem)

| Check | Result |
|---|---|
| 25 asset files exist | ✅ All resolve per `manifest.test.ts` (45/45 green) |
| `app.json` is valid JSON | ✅ Parses cleanly, all 10 referenced files exist |
| `gitignore` excludes `src/assets/source/generated/` | ✅ Confirmed |
| `src/assets/README.md` explains layout | ✅ Present |
| No asset imports in `src/` screens | ✅ grep `Image source` in src/ → 0 matches (additive — screens can opt-in) |
| Brand color discipline | ✅ `#2A6F97`, `#F4A261`, `#E0F2FE`, `#FFFFFF` + red `#DC2626` only on backpack |
| Kanji inventory compliance | ✅ Only 10 approved phrases used: 日本語, にほんご, あ, い, う, しごと, 7時, ア, 人, 一 |
| No AI-hallucinated Japanese text | ✅ Verified via overlay pipeline — Sensei's whitelist only |
| Top-level `/assets/` has icon, splash, favicon, notification, adaptive-icon | ✅ All 5 present |
| Splash composed (background + centered icon) | ✅ 1242×2436 with Kō centered on `#E0F2FE` |

## Test results

| Suite | Result |
|---|---|
| `npx vitest run` | **409/409 green** across 56 files (was 364 before Phase 26 → +45 manifest tests) |
| `npx tsc --noEmit` | **0 errors** in our code (pre-existing node_modules nits filtered) |
| `app.json` ref resolution | **10/10 referenced files exist** |

## File inventory (committed to repo)

```
src/assets/
├── README.md
├── manifest.ts                                       (typed asset manifest)
├── manifest.test.ts                                  (45 tests, all green)
├── lint/no-direct-asset-require.js                   (ESLint rule)
├── source/
│   ├── icon/app-icon-master-1024.png                 (1024×1024 RGBA PNG)
│   ├── splash/
│   │   ├── splash-background-1242x2436.png           (brandSoft #E0F2FE)
│   │   ├── splash-icon-1024.png                      (Kō centered)
│   │   └── splash-composed-1242x2436.png             (final, used by app.json)
│   ├── adaptive/
│   │   ├── android-adaptive-foreground-1080.png      (Kō, transparent bg)
│   │   ├── android-adaptive-background-1080.png      (solid #2A6F97)
│   │   └── android-adaptive-monochrome-1080.png      (white silhouette)
│   ├── illustrations/
│   │   ├── onboarding/
│   │   │   ├── onboarding-01-welcome.png             (Kō + 日本語/あ/い/う)
│   │   │   ├── onboarding-03-workplace.png           (Kō + しごと)
│   │   │   └── onboarding-04-habit.png               (Kō + 7時)
│   │   └── empty-state/
│   │       ├── empty-no-home.png
│   │       ├── empty-no-lessons.png
│   │       └── empty-no-progress.png
│   ├── badges/                                       (10 SVGs)
│   │   ├── badge-first-lesson.svg
│   │   ├── badge-streak-7.svg
│   │   ├── badge-streak-30.svg
│   │   ├── badge-first-kanji.svg
│   │   ├── badge-vocab-100.svg
│   │   ├── badge-level-up.svg
│   │   ├── badge-survival-complete.svg
│   │   ├── badge-perfect-quiz.svg
│   │   ├── badge-jlpt-n5.svg
│   │   └── badge-jlpt-n4.svg
│   └── mascot/
│       ├── mascot-base.png                           (the chosen chibi samurai)
│       ├── mascot-base.svg
│       ├── mascot-happy.svg
│       ├── mascot-thinking.svg
│       ├── mascot-celebrate.svg
│       └── mascot-encourage.svg
└── source/generated/                                 (gitignored)

assets/                                               (top-level, app.json refs)
├── icon.png
├── adaptive-icon.png
├── splash.png
├── favicon.png
└── notification-icon.png
```

## Risk register (open items)

| # | Item | Risk | Mitigation |
|---|---|---|---|
| 1 | `expo-build-properties` plugin not yet installed (`npm install expo-build-properties` needed at first build) | Yellow | Will fail loudly on next `expo prebuild`; expected, not a blocker for code-completion |
| 2 | `react-native-svg` not yet installed (needed for SVG badges to render) | Yellow | Same — fails on first `expo prebuild`; flagged |
| 3 | iOS bundle identifier `com.belion.japanesetutor` is placeholder; Apple Dev Program still missing | Yellow (deferred to user) | iOS section inactive until user provides bundle + team ID |
| 4 | Kō mascot SVG set in `src/assets/source/mascot/` still uses the original droplet design (not the chibi samurai you chose) | Yellow (cosmetic) | PNG `mascot-base.png` is the locked chibi samurai; SVGs are placeholders kept for size reference. Future work: hand-redraw SVGs to match chibi samurai |
| 5 | `experiments.reanimated: true` config warning still in `app.json` (GPT-5.5 flagged this in Phase 25) | Yellow | Remains in code; will need cleanup later |

## Verdict

**PASS WITH NOTES.**

- All 25 assets exist, are non-empty, and resolve per the manifest
- Code is additive (zero existing screens changed)
- `app.json` is valid and all refs resolve
- 409/409 tests green
- 0 typecheck errors in our code
- No AI-hallucinated Japanese text (Sensei's whitelist enforced)
- 5 open risks documented above — all Yellow, none blocking code-completion

## Sign-off

Tusk approves Phase 26 for code-completion. Recommend Step 12 (GPT-5.5 audit) proceed before declaring Phase 26 closed.

— Tusk, 2026-06-25