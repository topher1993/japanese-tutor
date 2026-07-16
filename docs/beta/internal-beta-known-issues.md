# Internal Beta Known Issues

> Historical Pack 1 snapshot. Its Week 1/Expo Go limits do not describe the
> current app. See `../production-readiness-audit.md` for current release risks.

Project: Japanese Tutor Mobile App  
Beta: Internal Beta Pack 1 — N5 Workplace Survival

## Non-Blocking Known Issues

These do not block internal beta:

1. Minor UI polish issues were observed during Chris's device QA.
2. Feedback is local-only and does not sync to a backend.
3. Vietnamese and Filipino support text should be refined with beta learner feedback.
4. Content is Week 1 N5 workplace survival only, not the complete N5-to-N2 curriculum.
5. The app currently runs through Expo Go / local development server, not app-store distribution.

## Blocking Issues To Watch For

A tester should report these immediately:

- app cannot open in Expo Go
- app crashes during normal use
- onboarding cannot complete
- bottom navigation cannot be used
- lesson text is unreadable or fully clipped
- quiz answer buttons cannot be tapped
- beta feedback form cannot save locally

## Deferred Polish Queue

Track these for a later UI/beta polish phase:

- spacing and layout refinement
- typography polish
- long-text wrapping improvements if any tester sees clipping
- clearer feedback summary placement
- additional icon/visual polish
- better learner onboarding copy after feedback

## Dependency Warning

Do not run:

```bash
npm audit fix --force
```

Reason: previous audit-force behavior attempted unsafe Expo downgrades. Dependency remediation must remain controlled and verified with Expo Doctor.
