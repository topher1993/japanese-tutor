# Current Expo QA Access — Temporary LAN Server

Status: live temporary LAN QA server
Date: 2026-06-28 (Phase 29 — kanji/vocab split, restarted after Metro died)

## Current Expo Go URL

```text
exp://192.168.10.109:8081
```

## How testers open it

1. Install Expo Go.
2. Make sure the phone is on the same Wi-Fi/network as the development PC.
3. Open Expo Go and enter/open the URL above, or scan the QR code from the running Metro terminal if visible.
4. If the app does not load or shows stale UI, fully close Expo Go and reopen it, then reload.

## Important caveat

This is **not** a stable beta distribution link.

- It only works while the current Metro process is running.
- It is LAN-only; it will not work for testers outside the local network.
- Do not send old Expo tunnel links to testers.
- For stable iOS beta testing, use TestFlight after Apple Developer/EAS setup.
- For outside-network testing, start a fresh Expo tunnel and update this file again.

## Running process

Hermes background process:

```text
proc_22658b13c0e4
```

Metro local health check:

```text
http://127.0.0.1:8081/status → packager-status:running
```

## Manual smoke checklist

Use this for the next Android/Expo Go release-readiness gate:

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
