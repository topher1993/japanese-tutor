# Japanese Tutor Mobile App

An Expo/React Native Japanese-learning app with guided phrase and grammar lessons, placement-aware study paths, flashcards, Daily Rush, quick quizzes, unofficial N5-N3 JLPT-style mock exams, kanji and sentence practice, spaced repetition, mastery feedback, and durable local progress.

## Stack

- Expo SDK 54, React Native 0.81, React 19, TypeScript
- SQLite-backed native persistence with a browser-safe storage path
- Vitest service and regression suite
- Optional PostHog analytics integration

The app is local-first. It does not currently include authentication, payments, employee monitoring, or a production backend.

## Getting started

Requirements: Node.js 20.19.4 or newer and npm 10 or newer.

```bash
npm ci
npm start
```

Platform shortcuts:

```bash
npm run android
npm run ios
npm run web
```

## Validation

```bash
npm run typecheck
npm test
npm run validate:v11
npx expo export --platform web
```

The checked-in `android/` source contains custom native foreground-audio behavior and is part of the application, not disposable generated output. Build intermediates remain ignored.

Project documentation is indexed in [docs/README.md](docs/README.md). Asset conventions are documented in [src/assets/README.md](src/assets/README.md).
