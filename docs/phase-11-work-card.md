# Japanese Tutor Mobile App — Phase 11 Work Card

**Date:** 2026-06-18  
**Owner:** Igris / Engineering Division  
**Phase:** 11 — Internal Beta Pack / Tester Instructions  
**Status:** Implemented

## Objective

Package the app for internal beta testers after Phase 9 device QA passed and Phase 10 content review approved the first N5 workplace survival content pack.

## Scope

- Create a tested internal beta launch package service.
- Create tester instructions.
- Create known issues list.
- Create local-only feedback workflow.
- Create internal beta release notes.
- Document exact Expo Go runtime instructions for Chris's SDK 54 client.

## Files Added / Updated

```text
src/services/internalBetaLaunchService.ts
tests/phase11InternalBetaLaunch.test.ts
docs/beta/internal-beta-tester-instructions.md
docs/beta/internal-beta-known-issues.md
docs/beta/internal-beta-feedback-workflow.md
docs/beta/internal-beta-release-notes.md
docs/phase-11-work-card.md
docs/phase-11-completion-report.md
```

## Launch Package Verdict

```text
ready-for-internal-beta-testers
```

## Expo Go Runtime

```text
Required SDK: 54
Expo Go URL: exp://192.168.10.109:8081
```

## Success Criteria

- Tester can open the app through Expo Go.
- Tester knows what screens to test.
- Tester knows known issues are non-blocking unless they prevent app use.
- Tester understands feedback is local-only and must be shared manually.
- Release notes clearly describe what is in Internal Beta Pack 1.
