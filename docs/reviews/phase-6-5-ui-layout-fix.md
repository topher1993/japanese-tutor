# Phase 6.5 UI Layout Fix

Date: 2026-06-18
Owner: Igris / Engineering Division

## Purpose
Fix the mobile UI clipping reported after Phase 6 screenshots.

## Root cause
The exported React Native Web screenshot was showing a cropped wider layout because some app/card containers combined `width: '100%'` with padding and the app shell was not constrained to the intended phone-width frame. The six-tab bottom navigation also used flexible percentage sizing that produced horizontal overflow in the headless web capture.

## Fixes applied
- Constrained the app shell to a 390px mobile frame for screenshot/web preview.
- Added full-height sizing to prevent the app from vertically shifting in captures.
- Removed overflow-causing `width: '100%'` styles from padded screen/card containers.
- Converted the bottom navigation into a readable 3-by-2 grid with shorter labels:
  - Home
  - Lessons
  - Cards
  - Work
  - Quiz
  - Stats
- Added safer wrapping/shrinking styles to lesson cards, onboarding, quiz, progress, and survival screens.
- Re-exported the web build and re-captured all mobile screenshots.

## Validation
- `npm run typecheck` passed.
- `npm test` passed: 7 test files, 31 tests.
- `npx expo export --platform web --output-dir dist-web-screenshots` passed.
- Final visual QA confirmed:
  - no horizontal clipping on main screen titles/cards
  - bottom navigation readable
  - onboarding buttons/titles within card boundaries

## Screenshot output
`docs/screenshots/phase-6-5/00-ui-contact-sheet-phase-6-5.png`

Individual screenshots are in:
`docs/screenshots/phase-6-5/`
