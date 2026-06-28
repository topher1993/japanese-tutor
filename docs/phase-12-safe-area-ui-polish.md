# Phase 12 Work Card — Safe Area UI Polish

## Owner
Igris — Engineering Division

## Trigger
User reported that app text/title appears too close to the phone time and notification/status-bar area.

## Screenshot observation
The Lessons screen title starts too near the phone status bar. The content is readable, but the top breathing room is not comfortable on the tested Android/Expo Go device.

## Scope
- Improve app shell safe-area handling.
- Add explicit readable top spacing below native status bar.
- Preserve bottom navigation and existing layout.
- Avoid feature/content changes.

## Implementation
- Added `src/services/appSafeAreaLayoutService.ts`.
- Added regression coverage in `tests/phase12SafeAreaPolish.test.ts`.
- Replaced React Native basic `SafeAreaView` usage with `react-native-safe-area-context`.
- Wrapped app shell in `SafeAreaProvider`.
- Applied top safe-area edges plus an additional 16px readable status-bar gap.

## Files changed
- `App.tsx`
- `src/services/appSafeAreaLayoutService.ts`
- `tests/phase12SafeAreaPolish.test.ts`

## Validation
Passed:

```bash
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-web-phase12-safearea --clear
npx expo install --check
npx expo-doctor@latest
```

Result:

```text
13 test files passed
48 tests passed
Expo Doctor: 18/18 checks passed
```

## Device retest instruction
Reload Expo Go from:

```text
exp://192.168.10.109:8081
```

Expected result: screen titles should sit lower, with more comfortable spacing below the phone time/notification/status area.
