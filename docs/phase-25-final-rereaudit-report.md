# Phase 25 — Final Re-Audit (post-fix)

**Date:** 2026-06-25
**QC Authority:** GPT-5.5 (via openai-codex provider, Codex Plus subscription)
**Engineering:** MiniMax M3
**Orchestrator:** Belion (MiniMax M3)
**Routing verified:** CODEX_ROUTING_OK
**Brief:** `.hermes/briefs/phase25-final-rereaudit-brief.md`
**Session ID:** 20260625_202932_5c61c0

## Verdict

**APPROVED-WITH-CONDITIONS.** Final score **74/100** (up from Phase 25's first re-audit of 68/100 — net **+6**).

GPT-5.5 confirmed both Phase 24 blockers closed:
- ✅ HomeScreen CTA runtime crash (variant="brand" → variant="primary")
- ✅ Typecheck reporting accuracy (now accurate at 12 errors, down from 18)

But caught one new real issue: **FlashcardsScreen passes `card`/`primaryTranslation`/`secondaryTranslations` to `<FlipCard>`, but `FlipCardProps` actually requires `front`/`back`/`cardNumber`/`totalCards`**. The flashcards screen is rendering with prop mismatch — the core learning UI may be broken.

Plus the 12 remaining typecheck errors (one of which is the FlipCard mismatch) are blockers for clean approval.

## Below is the verbatim GPT-5.5 response



Final score: 74/100

Verdict: APPROVED-WITH-CONDITIONS

Not a clean approval yet.

What I verified on disk:

1. Home CTA crash blocker: CLOSED
   - Verified `src/screens/HomeScreen.tsx:73`
   - Current code:
     `variant="primary"`
   - Repo-wide grep found no `variant="brand"` usage under `src`.
   - This removes the specific Button runtime crash I flagged last time.

2. Typecheck blocker: IMPROVED, but not fully closed
   - Ran:
     `npm run typecheck`
   - Actual result:
     12 TypeScript errors
   - Your reported count is now accurate.
   - The previous “18 vs claimed 15” reporting issue is corrected.
   - However, typecheck still fails.

3. Tests: PASS
   - Ran:
     `npm test -- --run`
   - Result:
     55 test files passed
     364 tests passed

Important correction to the “remaining errors are only nits” claim:

Most remaining errors are UI typing cleanup, but one is not just a harmless nit:

`src/screens/FlashcardsScreen.tsx(210,33)`

Current code passes:

`<FlipCard key={card.id} card={card} primaryTranslation={primaryTranslation} secondaryTranslations={secondaryTranslations} />`

But `FlipCardProps` actually requires:

`front`
`back`
`cardNumber`
`totalCards`

That means the Flashcards screen is currently passing props the component does not consume. It may not crash immediately, but it is very likely to render an empty/broken flip card UI. For a Japanese learning app, flashcards are core functionality, so I do not classify this as merely cosmetic.

Conditions remaining:

CODE-FIX CONDITIONS — actionable now

1. Fix `FlashcardsScreen.tsx` / `FlipCard` prop mismatch.
   - Either adapt `FlashcardsScreen` to pass `front`, `back`, `cardNumber`, `totalCards`
   - Or change `FlipCard` to accept the newer `card`, `primaryTranslation`, `secondaryTranslations` API.
   - This is the biggest remaining code issue.

2. Clear the remaining TypeScript errors.
   Current remaining files:
   - `src/screens/BetaFeedbackScreen.tsx` — unsupported `Card`/tone variant values: `"info"`, `"success"`
   - `src/screens/FlashcardsScreen.tsx` — `FlipCard` prop mismatch, `Button iconLeft`, `Disclosure icon="info"`
   - `src/screens/KanjiSectionPanel.tsx` — nullable `candidateCounts`
   - `src/screens/ReviewModePanel.tsx` — unsupported variant `"info"`
   - `src/screens/SettingsScreen.tsx` — unsupported icon `"refresh"`
   - `tests/phase22P0ColdStartPersistence.test.ts` — test mock implicit anys
   - `tests/phase22P0SrsPersistence.test.ts` — test mock implicit anys

3. Either add missing component API support or update callers.
   Examples:
   - `Button` supports `icon` and `iconRight`, not `iconLeft`.
   - `IconName` does not include `"info"` or `"refresh"`.
   - Some UI components do not support `"info"` / `"success"` variants.

OPERATIONAL CONDITIONS — not code-fixable by you alone

1. iOS smoke remains blocked.
   - No Apple Developer Program / TestFlight path.
   - This should not be scored as a code failure, but it does cap production confidence.

2. Android smoke was not run.
   - This is operational if there is no device/emulator/APK pipeline available.
   - But for closed beta readiness, at least one real-device Android smoke test should happen before inviting learners.

Production-readiness assessment for internal/closed beta ≤50 learners:

Current state: close, but not fully ready.

The app is in better shape than the previous 68/100 audit:
- The Home CTA crash risk is fixed.
- Test suite is green.
- Typecheck improved from 18 to 12 errors.
- Phase 25 regression tests are present and passing.

But I would not call this ready for ≤50 learner beta yet because:
- Typecheck still fails.
- Flashcards currently have a real prop-contract mismatch that likely affects visible core learning UI.
- No device smoke has been performed.

Honest grade:

For codebase trajectory: B-
For current internal beta readiness: C+/B- borderline
For “can I hand this to ≤50 learners today?”: Not yet, unless you explicitly label it as a technical QA build and avoid presenting it as learner-ready.

My direct recommendation:

Do not expand to ≤50 learners yet.

Fix the remaining TypeScript errors, especially the `FlipCard` mismatch, then run:
- `npm run typecheck`
- `npm test -- --run`
- at least one Android/Expo Go smoke test

After that, assuming no new runtime issue appears, I would expect the score to move into the low-to-mid 80s and become appropriate for internal closed beta.

session_id: 20260625_202932_5c61c0
