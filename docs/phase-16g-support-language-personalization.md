# Phase 16G — Support Language Personalization

## Owner

Igris — Engineering Division

## Goal

Make the onboarding language choice useful across the visible learning experience.

The onboarding language is now treated as the learner's **helper language**:

```text
EN → English
VI → Vietnamese
TL → Filipino/Tagalog
```

## UX copy update

Onboarding language step changed from generic support wording to:

```text
Choose your helper language
Sensei will use this language to explain Japanese phrases. You can still see other translations when useful.
```

## Implementation

The saved onboarding preference is loaded from:

```text
japanese-tutor:onboarding-preference:v1
```

The app now keeps `supportLanguage` in root state and passes it into:

- Home
- Lessons
- Workplace Survival
- Flashcards/Cards
- Quiz

## Behavior

When a learner chooses Vietnamese, visible phrase cards prioritize:

```text
Japanese
Romaji
Vietnamese
English
Filipino/Tagalog
```

When a learner chooses Filipino/Tagalog, visible phrase cards prioritize:

```text
Japanese
Romaji
Filipino/Tagalog
English
Vietnamese
```

When a learner chooses English, visible phrase cards prioritize:

```text
Japanese
Romaji
English
Vietnamese
Filipino/Tagalog
```

## Screens affected

### Home

Shows helper language and localized phrase of the day.

### Lessons category detail screens

Additional content packs now show the selected helper language as the primary translation.

### Workplace Survival

Emergency quick access and phrase detail cards use the selected helper language first.

### Cards / Flashcards

Flashcards now show the selected helper translation first, then secondary translations.

### Quiz

Quiz shows the selected helper language. Existing quiz data is English-only, so the app explicitly says:

```text
Quiz answer explanations are currently English-only; lesson and card translations follow your helper language.
```

This avoids pretending quiz explanations are translated when localized quiz data has not been authored yet.

## Files changed

```text
App.tsx
src/screens/HomeScreen.tsx
src/screens/LessonsScreen.tsx
src/screens/WorkplaceSurvivalScreen.tsx
src/screens/FlashcardsScreen.tsx
src/screens/QuizScreen.tsx
src/services/additionalLessonContentService.ts
src/services/onboardingService.ts
src/services/supportLanguageService.ts
tests/phase16gSupportLanguagePersonalization.test.ts
docs/phase-16g-support-language-personalization.md
```

## Validation

TDD was used:

1. Added Phase 16G test first.
2. Confirmed RED failure because `supportLanguageService` did not exist.
3. Implemented support-language mapping/localized phrase helpers.
4. Wired UI.
5. Ran full validation.

Commands passed:

```text
npm test -- tests/phase16gSupportLanguagePersonalization.test.ts
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-phase16g --clear
npx expo install --check
npx expo-doctor@latest
```

Results:

```text
Typecheck: passed
Test files: 22 passed
Tests: 75 passed
Expo export: passed
Expo install check: passed
Expo Doctor: 18/18 passed
```

## Browser smoke evidence

With saved preference:

```json
{ "onboarded": true, "language": "vi" }
```

Confirmed:

- Home shows `Helper language: Vietnamese`.
- Home phrase of day shows Vietnamese translation.
- Lessons → Shopping shows `Helper language: Vietnamese`.
- Shopping phrase cards show Vietnamese first, then English and Filipino/Tagalog.
- Cards shows `Helper language: Vietnamese` and Vietnamese first.
- Quiz shows `Helper language: Vietnamese` and an honest English-only quiz explanation note.

## Follow-up recommendation

Phase 16H should add localized quiz prompts/answer explanations if multilingual quiz support is required for beta.