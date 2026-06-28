# Japanese Tutor Mobile App — Phase 9 Work Card

**Date:** 2026-06-18  
**Owner:** Igris / Engineering Division  
**Coordinator:** Belion  
**Phase:** 9 — Real Device QA Execution  
**Status:** Executed as far as local environment permits; physical/simulator QA still requires device access.

## Objective

Execute the real-device QA gate that blocked Phase 8 from becoming an internal learner beta.

## Scope

- Re-run engineering validation gates.
- Attempt local Android simulator / Expo device launch.
- Attempt iOS simulator path where applicable.
- Start Expo development server for manual Expo Go testing.
- Capture fresh Phase 9 mobile-web evidence as fallback visual QA.
- Update beta verdict documents with Phase 9 evidence.

## Environment Findings

```text
Host: Windows / Git Bash
Android SDK: not configured
ANDROID_HOME: empty
ANDROID_SDK_ROOT: empty
adb: unavailable
emulator: unavailable
iOS simulator: unavailable on this Windows host / Xcode not installed
```

## Execution Results

### Engineering gates

Passed:

```bash
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-web-phase9
```

Observed result:

```text
9 test files passed
40 tests passed
Exported: dist-web-phase9
```

### Android launch attempt

Attempted:

```bash
npx expo start --android --port 8082
```

Result:

```text
FAILED — Android SDK path could not be resolved; adb is not installed/available.
```

### iOS launch attempt

Attempted:

```bash
npx expo start --ios --port 8083
```

Result:

```text
FAILED — Xcode/iOS simulator unavailable on this Windows host.
```

### Expo Go manual test server

Started Expo development server for manual Expo Go testing:

```text
http://127.0.0.1:8081
LAN IP observed: 192.168.10.109
Likely Expo Go LAN URL: exp://192.168.10.109:8081
```

Chris must use Expo Go on a phone connected to the same network to complete the real-device portion.

## Fresh Phase 9 Web Fallback Evidence

Captured:

```text
docs/screenshots/phase-9/viewports/small-360-home.png
docs/screenshots/phase-9/viewports/small-360-feedback.png
docs/screenshots/phase-9/viewports/large-430-home.png
```

Visual inspection result:

```text
PASS — no horizontal clipping observed on Home or Beta Feedback at 360px; bottom navigation remains readable.
```

## Phase 9 Verdict

```text
PARTIAL EXECUTION COMPLETE — DEVICE QA STILL BLOCKED
```

The app remains:

```text
NO-GO: DEVICE QA REQUIRED
```

Reason: no Android SDK/emulator/adb or iOS simulator is available in this local Hermes environment, and no physical Expo Go device results have been submitted yet.

## Next Required Human Action

1. Open Expo Go on a phone connected to the same Wi-Fi as the PC.
2. Open:

```text
exp://192.168.10.109:8081
```

3. Run the checklist in:

```text
docs/device-qa/phase-8-device-qa-checklist.md
```

4. Send Belion/Igris pass/fail notes or screenshots.

## Success Criteria for GO

- Android Expo Go or Android simulator passes the checklist.
- iPhone simulator or physical iPhone passes the checklist, if available.
- No blocking layout, navigation, onboarding, lesson, quiz, progress, or feedback defects.
- Release candidate verdict can then be updated from `NO-GO: DEVICE QA REQUIRED` to `GO FOR INTERNAL BETA`.
