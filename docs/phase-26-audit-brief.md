# Phase 26 — Asset Generation: GPT-5.5 Audit Brief

## Scope
- Generated 25 application assets (1 app icon, 3 Android adaptive, 1 splash background, 1 splash icon, 1 splash composed, 3 onboarding illustrations, 3 empty-state illustrations, 5 mascot SVG, 10 badges)
- Created `src/assets/manifest.ts` + `manifest.test.ts` (45 tests)
- Created `src/assets/lint/no-direct-asset-require.js` ESLint rule
- Modified `app.json` to wire all 25 assets into Expo SDK 54

## Constraints enforced (every asset must pass)

| Constraint | Source | How enforced |
|---|---|---|
| Only approved kanji from N5/N4 packs | Sensei's whitelist (10 phrases: 日本語, にほんご, あ, い, う, しごと, 7時, ア, 人, 一) | Overlay pipeline uses PIL + NotoSansJP font on AI-generated base images; never generated kanji via AI |
| Brand palette only | Design system: `#2A6F97`, `#F4A261`, `#E0F2FE`, `#FFFFFF` + `#DC2626` (red ONLY on backpack as Hinomaru reference) | All assets authored against palette; monochrome bg generated from master via PIL |
| $0 budget | User constraint | All generation via free-tier `gpt-image-2-low`; no paid tools |
| Two-color rule for SVGs | Beru's brief | Badges alternate brand/amber backgrounds; mascot is two-color |
| Chris-approved chibi samurai mascot | User picked variant | `app-icon-master-1024.png` = locked chibi samurai student with red circle backpack + sheathed katana |

## On-disk proof

| Metric | Value |
|---|---|
| Total assets committed | 25 |
| `npx vitest run` | **409/409 green** (was 364 → +45 manifest tests) |
| `npx tsc --noEmit` | **0 errors** in our code (pre-existing node_modules nits filtered) |
| `app.json` references that resolve | **10/10** |
| Tests verifying all assets exist | 45 (manifest.test.ts) |

## Files to inspect

1. `src/assets/manifest.ts` — typed grouped manifest, 25 entries
2. `src/assets/manifest.test.ts` — vitest suite, asserts every entry resolves + size cap
3. `src/assets/lint/no-direct-asset-require.js` — ESLint rule
4. `src/assets/source/icon/app-icon-master-1024.png` — chibi samurai master
5. `src/assets/source/splash/splash-composed-1242x2436.png` — splash with Kō centered
6. `src/assets/source/adaptive/*-1080.png` — Android adaptive trio
7. `src/assets/source/illustrations/onboarding/onboarding-*.png` — 3 onboarding scenes with kanji overlay
8. `src/assets/source/illustrations/empty-state/empty-*.png` — 3 empty-state illustrations
9. `src/assets/source/badges/*.svg` — 10 badges (8 achievement + 2 JLPT)
10. `src/assets/source/mascot/*` — 1 PNG + 5 SVGs (NOTE: SVGs are droplet placeholders, PNG is the locked chibi samurai)
11. `app.json` — wired with all asset references + bundle ID + expo-build-properties plugin

## Known issues (not blockers)

1. `expo-build-properties` and `react-native-svg` not yet installed (fails on next `expo prebuild`; needs `npm install expo-build-properties react-native-svg` before first build)
2. Mascot SVGs (`mascot-base/happy/thinking/celebrate/encourage.svg`) are still the original droplet design — would need hand-redraw to match the chibi samurai. PNG `mascot-base.png` is the locked chibi samurai.
3. iOS bundle identifier `com.belion.japanesetutor` is placeholder; Apple Dev Program still missing
4. `experiments.reanimated: true` warning from Phase 25 still present (deferred)
5. No screens reference the assets yet (additive — opt-in wiring for screens is a Phase 27 task)

## Ask

Score this audit 0–100. Classify any findings as P0/P1/P2/P3/P4. Issue final production-readiness verdict.

Specifically answer:
1. **Are the 25 assets production-ready?** (file integrity, brand compliance, no AI-hallucinated kanji, appropriate resolution)
2. **Is `manifest.ts` the right abstraction?** (typed, future-proof, scales as we add N3/N2/N1 content)
3. **Is `app.json` wiring correct for Expo SDK 54?** (all keys valid, refs resolve)
4. **Are the 5 open issues acceptable risks for code-completion, or blockers?**
5. **Is Phase 26 ready to close?**

— Belion, 2026-06-25