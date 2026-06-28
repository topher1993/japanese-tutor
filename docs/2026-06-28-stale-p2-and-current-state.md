# 2026-06-28 — Phase 26 Stale P2 Check + Current State

**Author:** Belion
**Latest update:** Phase 27 release-readiness cleanup, 2026-06-28

## TL;DR

The Phase 26 GPT-5.5 P2 finding about missing packages is stale: both `expo-build-properties` and `react-native-svg` are installed and Expo reports dependencies are up to date.

Phase 27 also closed the Expo config schema problem and the web-export wasm resolver problem. The largest remaining release-readiness gap is still real-device Android/Expo Go smoke testing.

## Verified current state

```text
npm test -- --run
63 test files passed
499 tests passed
```

```text
npm run typecheck
PASS
```

```text
npx expo-doctor@latest
18/18 checks passed. No issues detected!
```

```text
npx expo install --check
Dependencies are up to date
```

```text
npx expo export --platform web --output-dir dist-web-phase27-smoke
PASS
```

```text
npx expo export --platform android --output-dir dist-android-phase27-smoke
PASS
```

## Stale / closed findings

- **Stale P2:** `expo-build-properties` missing — closed/stale. Package is installed and plugin is wired in `app.json`.
- **Stale P2:** `react-native-svg` missing — closed/stale. Package is installed.
- **Closed P3:** `experiments.reanimated: true` schema warning — removed from `app.json` in Phase 27.
- **Closed schema issue:** `android.notification` invalid in app config — removed from `app.json` in Phase 27.
- **Closed web export issue:** Metro could not resolve `expo-sqlite`'s `wa-sqlite.wasm` — fixed with `metro.config.js` asset extension config and regression test.
- **Closed Phase 25 P3-1:** audit report `[object Object]` rendering fixed in `scripts/audit-report.mjs` and covered by tests.
- **Closed Phase 25 P3-2:** fragile SRS `.resolves` assertion now awaited and covered by tests.

## Real remaining carry-forward items

1. **P1 / release gate:** Android/Expo Go real-device smoke still required. No attached Android SDK/ADB/emulator is available in this shell.
2. **Operational:** iOS/TestFlight remains blocked until Apple Developer Program, EAS, App Store Connect, and a stable iOS bundle ID exist.
3. **Security/dependency condition:** `npm run audit:deps` still reports 19 moderate advisories. Do not run `npm audit fix --force` casually because npm reports breaking upgrade paths to Expo 56 / React Native 0.86.
4. **Asset polish:** mascot SVG placeholder/canonical-state cleanup and screen-level asset integration remain future polish tasks.
5. **Brand/package naming:** bundle/package ID is still `com.belion.japanesetutor`; consider renaming only when release identity is decided.

## Live manual test server

See `docs/current-ios-qa-access.md` for the current LAN Expo Go URL and manual smoke checklist.

Current verdict:

```text
NO-GO: DEVICE QA REQUIRED
```

See also: `docs/phase-27-release-readiness-report.md`.
