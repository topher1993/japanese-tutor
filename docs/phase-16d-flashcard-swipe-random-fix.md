# Phase 16D — Flashcard Swipe and Random Review Fix

## Verdict

GO — completed and validated.

## Problem

The Flashcards screen showed `120 cards ready for review`, but it always rendered only `deck.cards[0]`.

User evidence showed the screen stuck on:

```text
おはようございます
```

## Fix

Added real flashcard navigation behavior:

- random initial card on screen open
- visible card counter, e.g. `Card 23 / 120`
- swipe left for random next card
- swipe right for previous card
- `Random` button for non-swipe testing
- `Previous` button
- `Mark Good + Random Next` button
- Vietnamese and Filipino/Tagalog translations visible on the card

## Files changed

- `src/services/flashcardNavigatorService.ts`
- `src/screens/FlashcardsScreen.tsx`
- `tests/phase16dFlashcardSwipeRandom.test.ts`

## TDD proof

RED test failed first because the navigation service did not exist.

GREEN after implementation:

```text
✓ tests/phase16dFlashcardSwipeRandom.test.ts (4 tests)
```

## Full validation

Commands:

```text
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-web-phase16d-flashcard-swipe --clear
npx expo install --check
npx expo-doctor@latest
```

Results:

```text
Typecheck: passed
Test files: 19 passed
Tests: 66 passed
Export: dist-web-phase16d-flashcard-swipe generated
Expo dependencies: up to date
Expo Doctor: 18/18 checks passed
```

## Browser smoke

Confirmed exported app showed a random card:

```text
Card 23 / 120
明日は休みですか
```

After clicking `Random`, the screen changed to:

```text
Card 71 / 120
注意
```

## Tester instructions

In Expo Go:

1. Open Cards.
2. Swipe left on the card to get a random new card.
3. Swipe right to go back.
4. Use `Random` if swiping is hard to test.
5. Use `Mark Good + Random Next` after reviewing a card.
