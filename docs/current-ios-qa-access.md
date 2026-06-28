# Current iOS QA Access — Temporary Expo Tunnel

Status: live temporary QA tunnel
Date: 2026-06-20

## Current tunnel URL

```text
exp://zujugea-anonymous-8082.exp.direct
```

## How iOS testers open it

1. Install Expo Go from the App Store.
2. Open the iPhone Camera app.
3. Scan the Expo QR code from the running Metro terminal, or paste/open the tunnel URL if supported.
4. If the app does not load, close Expo Go completely and try again.

## Important caveat

This is **not** a stable beta distribution link.

- It only works while the current Metro tunnel process is running.
- It may change after a restart.
- Do not send old Expo links to testers.
- For stable iOS beta testing, use TestFlight after Apple Developer/EAS setup.

## Running process

Hermes background process:

```text
proc_c02572fa17fe
```

Metro local health check:

```text
http://127.0.0.1:8082/status → packager-status:running
```
