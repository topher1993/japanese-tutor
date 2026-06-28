# Phase 16E — Lesson Category Navigation Refactor

## Verdict

GO — completed and validated.

## Owner

Igris, Engineering Director

## User input

Chris proposed moving the separate `Work` tab under `Lessons` as a subcategory so future lesson categories like shopping and daily conversation can live in one learning area.

## Decision

Accepted.

The app now treats Workplace as a Lessons category instead of a separate bottom navigation tab.

## UX change

### Before

```text
Home | Lessons | Cards | Work | Quiz | Stats
```

### After

```text
Home | Lessons | Cards | Quiz | Stats
```

Inside `Lessons`, the app now shows category cards:

- Workplace — Ready
- Daily Conversation — Planned
- Shopping — Planned
- Safety / Emergency — Planned
- Directions — Planned
- Grammar Basics — Planned

The existing Workplace Survival content is now opened through:

```text
Lessons → Workplace
```

## Why this is better

- Removes overlap between `Lessons` and `Work`.
- Makes bottom navigation less crowded.
- Creates a scalable structure for new content categories.
- Avoids adding future bottom tabs for Shopping, Daily Conversation, Directions, etc.
- Preserves all existing Workplace Survival content.

## Files changed

- `App.tsx`
- `src/types/navigation.ts`
- `src/screens/LessonsScreen.tsx`
- `src/services/appNavigationService.ts`
- `src/services/lessonCategoryService.ts`
- `tests/phase16eLessonCategoryNavigation.test.ts`
- `docs/beta/internal-beta-tester-instructions.md`
- `docs/beta/broader-beta-trial-1-tester-instructions.md`
- `docs/phase-15b-broader-beta-trial.md`

## TDD proof

RED test failed first:

```text
Cannot find module '../src/services/appNavigationService'
```

GREEN after implementation:

```text
✓ tests/phase16eLessonCategoryNavigation.test.ts (3 tests)
```

## Full validation

Commands:

```text
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-web-phase16e-lesson-categories --clear
npx expo install --check
npx expo-doctor@latest
```

Results:

```text
Typecheck: passed
Test files: 20 passed
Tests: 69 passed
Export: dist-web-phase16e-lesson-categories generated
Expo dependencies: up to date
Expo Doctor: 18/18 checks passed
```

## Browser smoke

Confirmed in exported web build:

- bottom nav shows `Home`, `Lessons`, `Cards`, `Quiz`, `Stats`
- bottom nav no longer shows `Work`
- Lessons screen shows all six category cards
- Workplace category opens the existing Workplace Survival content
- Workplace Survival categories and emergency quick access remain visible

## Tester instruction update

Current tester docs now say:

```text
Lessons → Workplace / Workplace Survival
```

instead of `Work / Workplace Survival`.

## Next content path

This refactor prepares the app for:

```text
Phase 17A — Daily Conversation Pack
Phase 17B — Shopping Pack
Phase 17C — Directions / Transportation Pack
```
