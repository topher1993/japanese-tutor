# Phase 16F — Additional Lessons Content Expansion

## Owner

Igris — Engineering Division

## Goal

Turn the Phase 16E placeholder lesson categories into real learner-facing content while keeping the clean five-tab navigation:

```text
Home | Lessons | Cards | Quiz | Stats
```

## Added content

The following categories are now **Ready** inside `Lessons`:

- Workplace — existing workplace survival lessons and phrases
- Daily Conversation — 8 practice phrases
- Shopping — 8 practice phrases
- Safety / Emergency — 8 practice phrases
- Directions — 8 practice phrases
- Grammar Basics — 8 practice phrases

Total new non-workplace content: **40 practice phrases**.

Each new phrase includes:

- Japanese
- Romaji
- English
- Vietnamese
- Filipino/Tagalog
- Usage note

## UX behavior

From the app:

```text
Lessons → Daily Conversation
Lessons → Shopping
Lessons → Safety / Emergency
Lessons → Directions
Lessons → Grammar Basics
```

Each category opens a practice screen with:

- category title
- category description
- Sensei tip
- phrase count
- phrase cards with translations and usage notes
- back button to lesson categories

## Files changed

```text
src/data/additionalLessonCategoryContent.ts
src/services/additionalLessonContentService.ts
src/services/lessonCategoryService.ts
src/screens/LessonsScreen.tsx
src/types/additionalLessonContent.ts
tests/phase16fAdditionalLessonContent.test.ts
tests/phase16eLessonCategoryNavigation.test.ts
docs/phase-16f-additional-lesson-content.md
```

## Validation

RED test was added first and failed because `additionalLessonContentService` did not exist.

Then implementation was added and validation passed:

```text
npm test -- tests/phase16fAdditionalLessonContent.test.ts
npm test -- tests/phase16eLessonCategoryNavigation.test.ts tests/phase16fAdditionalLessonContent.test.ts
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-phase16f --clear
npx expo install --check
npx expo-doctor@latest
```

Results:

```text
Typecheck: passed
Test files: 21 passed
Tests: 72 passed
Expo export: passed
Expo install check: passed
Expo Doctor: 18/18 passed
```

## Browser smoke evidence

Export preview confirmed:

- bottom navigation remains five tabs: Home, Lessons, Cards, Quiz, Stats
- Work is not a bottom tab
- Lessons category cards show all six categories as Ready
- Daily Conversation opens and renders 8 multilingual practice phrases
- Shopping opens and renders 8 multilingual practice phrases

## Notes

This is local/static content for beta stability. No backend/API dependency was added.
