# Japanese Tutor v1.1 internal beta checklist

Status: automated and emulator/browser validation is strong; physical Android
and iOS release-device checks plus final Japanese editorial review remain
required before inviting real learners.

## Automated gates

- [x] Strict TypeScript passes.
- [x] Full Vitest regression suite passes.
- [x] Expo Doctor passes all enabled checks.
- [x] Web and Android production exports complete.
- [x] Android debug Java/native build compiles.
- [x] Onboarding, profile, lesson, todo, mastery, and SRS state have cold-start tests.
- [x] Web learning and SRS state use durable browser storage.
- [x] Dependency audit has no high or critical advisories.

## Device and editorial gates

- [ ] Physical Android smoke pass, including notification permission and background audio.
- [ ] iPhone simulator or physical iPhone build and smoke pass.
- [ ] Production signing credentials and store-distribution build.
- [ ] Final Japanese reading/translation review of learner-facing candidate content.
- [ ] Accessibility pass with TalkBack and VoiceOver.

## Minimum smoke flow

1. Complete onboarding and placement (including N4/N3 paths).
2. Finish a lesson, Daily Rush, flashcard review, quiz, and Sentence Lab item.
3. Terminate and reopen the app; confirm progress, streak, todos, and SRS state.
4. Exercise Android audio playback, deny/allow notification permission, minimize,
   stop from the notification, and confirm UI playback state is truthful.
5. Reset all progress from Settings and repeat a cold start.

## Dependency boundary

The current live audit reports 12 moderate advisories in Expo build/config
tooling, with no high or critical findings. npm proposes Expo 57 as the supported
fix, which is a major SDK migration; do not use `npm audit fix --force` on the
v1.1 branch. See `phase-22-dependency-audit.md` and
`dependency-remediation-plan.md`.
