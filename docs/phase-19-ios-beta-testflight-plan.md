# Phase 19 — iOS Beta Access and TestFlight Plan

Owner: Igris / Nova / Vector
Status: Prepared, pending Apple/EAS account setup

## Problem

Old Expo links are not reliable for iOS testers.

- LAN links only work on the same Wi-Fi/network.
- Expo tunnel links can work remotely, but they are temporary and may change whenever Metro restarts.
- Old `exp.direct` links must not be treated as stable iOS beta access.

## Decision

Use two tracks:

1. **Immediate QA:** Expo tunnel for short live testing sessions only.
2. **Stable iOS beta:** TestFlight.

## Current app behavior

The Progress/Stats beta card no longer publishes the stale Expo tunnel URL as if it were stable.

It now says:

```text
Expo access: No current stable iOS Expo link
IOS beta path: TestFlight preparation recommended
```

## Immediate temporary iOS QA

Use this only when Chris or testers are actively testing:

```bash
npx expo start --tunnel --clear
```

If Expo asks for ngrok support:

```bash
npm install -g @expo/ngrok@^4.1.0
npx expo start --tunnel --clear
```

Important:

- Share the fresh `exp://...exp.direct` link only for the current session.
- Do not reuse old tunnel links.
- If Metro restarts, regenerate the link.

## TestFlight path

Required before TestFlight can happen:

1. Apple Developer Program access.
2. App Store Connect access.
3. EAS CLI/login.
4. Expo app config with an iOS bundle identifier.
5. EAS build profile.
6. iOS build submission to App Store Connect.
7. TestFlight tester group and invite flow.

Recommended commands once account setup is ready:

```bash
npm install --save-dev eas-cli
npx eas login
npx eas build:configure
npx eas build --platform ios --profile preview
npx eas submit --platform ios --latest
```

## Recommended bundle identifier

Suggested placeholder, confirm before final use:

```text
com.christopherpid.japanesetutor
```

Do not lock this into App Store Connect until Chris confirms the final app identity.

## Tester instruction after TestFlight is live

```text
Install TestFlight from the App Store.
Open the invitation link.
Install Japanese Tutor beta.
Use the Google Form in-app for feedback.
```

## Validation policy

Before each TestFlight build:

```bash
npm run typecheck
npm test
npx expo export --platform web --output-dir dist-ios-beta-check --clear
npx expo install --check
npx expo-doctor@latest
```

## Current blockers

- Apple Developer Program access not verified in this environment.
- EAS CLI/config not installed/configured.
- iOS bundle identifier not confirmed.
