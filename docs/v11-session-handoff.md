# Japanese Tutor v1.1 handoff

Last verified: 2026-07-14.

## Current state

Version `1.1.0` is a technically green source release candidate. There is intentionally no checked-in “current APK”: the final universal debug APK was built and hashed for verification, then treated as disposable output. Public distribution still requires external production signing, physical Android audio QA, and iOS/Xcode verification.

The current product includes placement-aware phrase and grammar paths, flashcards and Daily Rush with persistent SRS, quiz modes/history/retry, kanji, connected example sentences, Sentence Lab, weekly/daily plans, mastery feedback, local analytics integration, and durable local progress.

## Reproduce the main checks

From the repository root:

```powershell
npm ci
npm run validate:v11
npx expo install --check
npx expo export --platform web --output-dir dist-verify-web
npx expo export --platform android --output-dir dist-verify-android
```

For Android native verification, set `NODE_ENV`, `ANDROID_HOME`, and `ANDROID_SDK_ROOT`, then run from `android/`:

```powershell
.\gradlew.bat :app:compileDebugJavaWithJavac --console=plain --no-daemon
.\gradlew.bat :app:assembleDebug --console=plain --no-daemon
```

Latest result: 146 test files / 1,067 tests passed; web export, Android Hermes export, Java compile, and full debug APK assembly passed.

## Important boundaries

- Native storage is SQLite; web storage is durable versioned `localStorage`, with single-active-tab semantics.
- 300 sentence candidates without adequate per-row provenance are staging-only; 235 connected lesson examples are visible.
- The 749 “approved” translation entries are internal metadata, not proof of independent human review.
- Dependency audit: 12 moderate, 0 high/critical; Expo SDK 57 upgrade remains planned.
- Physical Android foreground-audio behavior and all iOS behavior remain manual release gates.
- Production signing credentials and release artifacts do not belong in this repository.

Use [production-readiness-audit.md](production-readiness-audit.md) for evidence and [README.md](README.md) for the current documentation index. Query Graphify before changing code and refresh it after source changes.
