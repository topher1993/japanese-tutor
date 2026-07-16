# iOS and Expo Go QA access

Status: no permanent development server or public iOS beta URL is checked into
the repository. Previously recorded LAN IPs, tunnel URLs, QR codes, and process
IDs expire and must not be treated as current access details.

## Start a temporary QA session

From the repository root:

```bash
npm start
```

For an outside-network Expo tunnel on macOS, Linux, or Git Bash:

```bash
./start-tunnel.sh
```

Use the URL or QR code printed by that live Expo process. LAN mode requires the
device and development machine to share a network. Stop the Expo process when
the session is over; do not commit its temporary address.

## iOS release boundary

Expo Go is useful for JavaScript/UI checks, but this project also contains
custom Android native audio code and committed native project configuration.
Stable iOS distribution still requires an Apple Developer account, EAS or
Xcode signing, and a TestFlight/device pass. No Windows-side check can replace
that release gate.

## Persistence smoke checklist

1. Complete onboarding and one lesson.
2. Fully terminate and reopen Expo Go.
3. Confirm onboarding and lesson progress remain.
4. Review a flashcard, terminate, reopen, and confirm its SRS state remains.
5. Use Settings to reset progress and confirm lesson/SRS state is cleared.
