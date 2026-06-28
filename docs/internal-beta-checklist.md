# Japanese Tutor Mobile App — Internal Beta Checklist

Status: Phase 7 generated checklist
Owner: Igris / Engineering Division

## Current Verdict

**Not ready for real learner beta until real-device QA is completed.**

The app is ready for continued local/internal engineering review, but the first learner-facing beta should wait for Expo Go or simulator testing on actual mobile device sizes.

## Required Before Internal Beta

- [x] Onboarding completion persists locally.
- [x] Support-language preference persists locally.
- [x] Bottom navigation is readable in the 390px mobile web preview.
- [x] TypeScript passes.
- [x] Automated test suite passes.
- [x] Expo web export passes.
- [ ] Real-device Expo Go QA on at least one small Android-size device.
- [ ] Real-device or simulator QA on one iPhone-size device.
- [ ] Sensei content review for learner-facing lesson quality.

## Dependency Status

Audit summary from Phase 7:

```text
info: 0
low: 0
moderate: 10
high: 0
critical: 0
total: 10
```

Decision:

```text
Do not run npm audit fix --force.
```

Reason:

```text
npm audit fix --dry-run reports the available force fix would install expo@46.0.21, which is a breaking downgrade from the current Expo 56 line.
```

## Beta QA Devices / Viewports

Minimum checklist:

- Small Android 360x640
- Standard mobile 390x844
- Large mobile 430x932
- iPhone simulator or physical iPhone if available
- Android Expo Go device if available

## Feedback Collection Questions

Ask the first internal testers:

1. Can you understand what the app is for within 10 seconds?
2. Is the onboarding language choice clear?
3. Are workplace phrases easy to find?
4. Is Japanese text readable?
5. Is the bottom navigation easy to tap?
6. Which screen feels most useful?
7. Which screen feels confusing?
8. What workplace phrase do you need that is missing?

## Blockers

- Real-device QA has not been performed yet.

## Warnings

- Dependency audit has moderate Expo-transitive findings.
- Assets are still concept-level, not final artwork.
- Content is mock/Sensei-compatible but still needs Sensei review before real learners.
