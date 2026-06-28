# Phase 16C — Flashcard Expansion

## Verdict

GO — completed and validated.

## Owner

Igris, Engineering Director

## Purpose

Expand the Flashcards experience from lesson-only cards into a larger beginner review deck while keeping the beta app stable and offline/local-first.

## Added content

Added `84` supplemental flashcard entries across these beginner categories:

- numbers
- weekdays
- today/tomorrow/yesterday
- workplace nouns
- office/factory terms
- safety words
- PPE and emergency equipment
- tool/equipment vocabulary
- directions and locations
- HR/work schedule words
- emergency nouns
- beginner daily verbs

Combined with existing lesson items, the Flashcards deck now contains:

```text
120 cards
```

Each card includes:

- Japanese
- romaji
- English
- Vietnamese
- Filipino/Tagalog
- category
- review count
- next review date

## Files changed

- `src/data/supplementalFlashcards.ts`
- `src/services/flashcardService.ts`
- `src/screens/FlashcardsScreen.tsx`
- `tests/phase16cFlashcardExpansion.test.ts`

## UI change

The Flashcards screen now shows the deck size:

```text
120 cards ready for review
```

## TDD proof

RED test failed first:

```text
expected 36 to be greater than or equal to 100
```

GREEN after implementation:

```text
✓ tests/phase16cFlashcardExpansion.test.ts (2 tests)
```

## Full validation

Commands:

```text
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-web-phase16c-flashcards --clear
npx expo install --check
npx expo-doctor@latest
```

Results:

```text
Typecheck: passed
Test files: 18 passed
Tests: 62 passed
Export: dist-web-phase16c-flashcards generated
Expo dependencies: up to date
Expo Doctor: 18/18 checks passed
```

## Browser smoke

Verified exported app renders the Flashcards screen with:

```text
Workplace Survival Flashcards
120 cards ready for review
おはようございます
ohayou gozaimasu
Good morning.
```

## Beta impact

This phase does not add backend/API complexity and does not change the Expo SDK target.

The app remains:

```text
Expo SDK 54
Local-first
Beta-feedback local-only
Ready for limited broader beta
```
