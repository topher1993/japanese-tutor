# Phase 27 — Release Readiness Cleanup + Expo Go Smoke Setup

**Date:** 2026-06-28
**Owner:** Belion coordinating Igris/Nova release-readiness work
**Status:** NO-GO for learner beta until real-device smoke is completed

## Summary

Phase 27 started from the recommendation to clear the easiest release-readiness blockers first, then prepare the Android/Expo Go smoke path.

Completed in this pass:

- Fixed `app.json` Expo config schema errors.
- Added Metro wasm asset handling so Expo web export can bundle `expo-sqlite`'s `wa-sqlite.wasm`.
- Added a regression test for the Metro wasm config.
- Re-ran project gates.
- Started a fresh Expo LAN server for manual device testing.

Still not completed:

- Real Android device/Expo Go smoke test.
- Real Android APK install/cold-start cycle.
- iOS/TestFlight path.

## Changes made

### 1. `app.json` schema cleanup

Removed invalid Expo SDK 54 config fields:

- `expo.android.notification`
- `expo.experiments.reanimated`

Result:

```text
npx expo-doctor@latest
18/18 checks passed. No issues detected!
```

### 2. Metro wasm resolver fix

Added `metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'wasm']));
module.exports = config;
```

Reason: `npx expo export --platform web` failed because Metro could not resolve:

```text
node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.wasm
```

The file existed on disk, but Metro's asset resolver did not include `wasm`.

### 3. Regression test

Added:

```text
tests/phase27MetroWasmExportConfig.test.ts
```

It asserts `metro.config.js` includes `wasm` in `config.resolver.assetExts`.

## Verification performed

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
PASS — exported dist-web-phase27-smoke
```

```text
npx expo export --platform android --output-dir dist-android-phase27-smoke
PASS — exported Hermes Android bundle
```

Dependency audit remains a known condition:

```text
npm run audit:deps
19 moderate severity vulnerabilities
```

Do not run `npm audit fix --force` casually: npm reports breaking upgrade paths to `expo@56.0.12` and `react-native@0.86.0`.

## Device / SDK environment probe

```text
adb=
emulator=
ANDROID_HOME=
ANDROID_SDK_ROOT=
JAVA_HOME=
```

Interpretation:

- This shell has no Android SDK/ADB/emulator tooling available.
- I cannot install an APK or run an emulator smoke test from this environment.
- Android real-device verification must happen through Expo Go on Chris's phone, or on a developer machine with Android SDK + attached device/emulator.

## Live manual Expo Go server

A fresh LAN server was started with cache clear:

```text
Hermes process: proc_a2c155c961f4
Command: npx expo start --lan --clear --port 8081
Health: http://127.0.0.1:8081/status -> packager-status:running
LAN IP: 192.168.10.109
Expo Go URL: exp://192.168.10.109:8081
```

Phone requirements:

- Phone must be on the same Wi-Fi/network as this PC.
- Expo Go should support SDK 54.
- If Expo Go shows stale UI, fully close Expo Go and reopen, then reload.

## Manual smoke checklist still required

On Android/Expo Go, verify:

1. Open `exp://192.168.10.109:8081`.
2. Complete onboarding if shown.
3. Complete one lesson.
4. Kill Expo Go completely.
5. Reopen the app.
6. Confirm lesson completion persisted.
7. Rate one flashcard.
8. Kill Expo Go completely.
9. Reopen the app.
10. Confirm SRS/due-card state persisted.
11. Open Settings.
12. Run Reset all progress.
13. Confirm progress/SRS rows are cleared.

## Current release verdict

```text
NO-GO: DEVICE QA REQUIRED
```

Reason: static gates are now clean, but real-device persistence and runtime behavior are still unverified.

## Remaining backlog after this pass

1. Android/Expo Go real-device smoke test — highest priority.
2. Optional: produce/install a real Android APK once Android SDK/ADB/EAS path exists.
3. iOS/TestFlight remains blocked until Apple Developer/EAS/App Store Connect setup exists.
4. Dependency audit remediation plan for the 19 moderate advisories.
5. Phase 26/27 asset polish: replace or mark unused mascot SVG placeholders, then wire selected assets into learner-facing screens and run visual QA.
