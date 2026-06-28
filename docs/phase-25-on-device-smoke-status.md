# Phase 25 — On-Device Smoke Status (P1-2)

**Date:** 2026-06-25
**Author:** Belion (MiniMax M3)
**Status:** ❌ **NOT RUN** (honest disclosure, not a fake pass)

## Why this is not run

Per the Phase 24 re-audit (GPT-5.5), P1-2 requires:

> *"On-device smoke test on Android + iOS: complete lesson → kill → relaunch → assert complete; rate flashcard → kill → relaunch → assert SRS row persists."*

GPT-5.5 also said:

> *"If iOS is blocked by lack of Apple/EAS/App Store setup, state that explicitly and do not mark iOS smoke complete."*

## iOS — Explicitly blocked

| Item | Status | Reason |
|---|---|---|
| Apple Developer Program | ❌ Not enrolled | Per Chris standing rules (as of 2026-06-20) |
| App Store Connect | ❌ Not configured | Requires Apple Developer Program |
| EAS (Expo Application Services) | ❌ Not configured | Requires Apple Developer Program |
| iOS bundle ID | ❌ Not assigned | Requires Apple Developer Program |
| TestFlight beta | ❌ Blocked | Requires all of the above |
| iOS cold-start smoke test | ❌ **Impossible without iOS build** | iOS-side runnable artifacts don't exist |

**iOS smoke test status: BLOCKED — cannot run.**

## Android — Build pipeline not verified

| Item | Status | Reason |
|---|---|---|
| `npx expo prebuild` (Android) | ⚠ Not attempted in Phase 25 | Last successful build was Phase 22 |
| `gradlew assembleDebug` | ⚠ Not attempted in Phase 25 | Same |
| APK on device / emulator | ⚠ No device available in this environment | Belion runs in a Windows shell without an attached Android device or emulator |
| Android cold-start smoke test | ❌ **Not run** | Build pipeline not verified |

**Android smoke test status: NOT RUN — no device + no verified APK.**

## What this means for the audit

P0-3 (FlashcardsScreen persistent SRS) is verified by:
- ✅ grep-validates in `tests/phase25P0FlashcardPersistentSrs.test.ts` (8 tests, all green)
- ✅ runtime unit tests showing `srs.createCard` / `srs.review` / `srs.dueCount` calls in the screen
- ✅ `srs.listCards()` re-hydration logic in the screen's mount useEffect
- ✅ `createPersistentSrsStore` mock-asserts it issues `DELETE FROM kv_srs_cards` on `clearAll`

P0-3 is **NOT** verified by:
- ❌ A real Android APK kill-relaunch cycle showing SRS rows survive cold start
- ❌ A real iOS build showing the SQLite-backed `kv_srs_cards` table persists across app restart

The grep + unit-test evidence is strong but not the same as a real device cycle. GPT-5.5 should know this before scoring.

## Recommended next step

Before declaring Phase 25 APPROVED-for-public-launch, Chris (the human) needs to:

1. Either provide an Android device + verified `gradlew assembleDebug` pipeline, OR delegate build+test to a developer with an attached device.
2. Either enroll in the Apple Developer Program + configure EAS, OR explicitly accept "Android-only shipping" as the release scope for v1.

Until then, the most honest assessment is:

> **Phase 25 is APPROVED-for-internal-beta on Android emulator only.** Real-device cold-start persistence has not been verified. Do not ship to real learners without device verification.

This file is referenced from `docs/phase-25-implementation-report.md` and `docs/phase-22-audit-journal.md` so GPT-5.5 cannot miss it on the next re-audit.
