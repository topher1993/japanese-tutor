# Phase 16H — Translation Visibility Preferences

## Owner

Igris — Engineering Division

## Decision

Do **not** ask nationality in onboarding.

Use the existing helper-language preference to control visible translations.

## Goal

Reduce translation clutter while keeping the app useful for learners who choose English, Vietnamese, or Filipino/Tagalog.

## Rules implemented

### English helper language

Show:

```text
Japanese
Romaji
English
```

Hide:

```text
Vietnamese
Filipino/Tagalog
```

### Vietnamese helper language

Show:

```text
Japanese
Romaji
Vietnamese
English fallback
```

Hide:

```text
Filipino/Tagalog
```

### Filipino/Tagalog helper language

Show:

```text
Japanese
Romaji
Filipino/Tagalog
English fallback
```

Hide:

```text
Vietnamese
```

## Why English fallback stays

English remains visible for non-English helper languages because it is useful as a universal fallback when the localized translation is unclear or too short.

## Implementation

Centralized in:

```text
src/services/supportLanguageService.ts
```

Added:

```ts
getVisibleTranslations(phrase, language)
```

Updated:

```ts
getSecondaryTranslations(phrase, language)
```

to follow compact visibility rules.

Screens already using `getSecondaryTranslations()` now automatically follow Phase 16H rules:

- Lessons category phrase cards
- Workplace Survival phrase cards
- Cards / Flashcards
- Home phrase of the day

## Files changed

```text
src/services/supportLanguageService.ts
tests/phase16hTranslationVisibility.test.ts
tests/phase16gSupportLanguagePersonalization.test.ts
docs/phase-16h-translation-visibility-preferences.md
```

## TDD validation

RED test was added first and failed because:

- `getVisibleTranslations` did not exist
- `getSecondaryTranslations` still returned unrelated third-language translations

Then implementation was added and tests passed.

## Validation commands

```text
npm test -- tests/phase16hTranslationVisibility.test.ts
npm test -- tests/phase16gSupportLanguagePersonalization.test.ts tests/phase16hTranslationVisibility.test.ts
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-phase16h --clear
npx expo install --check
npx expo-doctor@latest
```

## Results

```text
Typecheck: passed
Test files: 23 passed
Tests: 79 passed
Expo export: passed
Expo install check: passed
Expo Doctor: 18/18 passed
```

## Browser smoke evidence

With saved preference:

```json
{ "onboarded": true, "language": "tl" }
```

Confirmed:

- Home shows `Helper language: Filipino/Tagalog`.
- Home phrase shows Filipino/Tagalog translation.
- Lessons → Shopping shows Filipino/Tagalog first and English fallback.
- Lessons → Shopping does **not** show Vietnamese translations.
- Cards shows Filipino/Tagalog first and English fallback.
- Cards does **not** show Vietnamese translations.

## Follow-up option

A later settings phase can add:

```text
Show more translations
```

but it is not needed for the current beta path.