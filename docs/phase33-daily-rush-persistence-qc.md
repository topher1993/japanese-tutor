# Phase 33 Daily Rush Persistence QC

## Scope

- Added persistent Daily Flashcard Rush stats to `UserProfileDynamic`.
- Daily Rush completion now builds a profile patch that records:
  - total runs
  - total Good answers
  - total Again answers
  - total XP earned from Daily Rush
  - last completed date
  - last run summary
- Daily Rush awards XP only once per calendar date. Extra same-day runs remain practice-only.
- `DailyRushScreen` saves completion through `useUserProfileContext()`.
- `DailyRushScreen` shows completed-today/practice-only status.
- `ProfileScreen` includes persisted Daily Rush totals in profile progression badges/XP.

## Verification evidence

- RED test was run before implementation:
  - `npm test -- tests/phase32DailyRushProfileKanji.test.ts`
  - failed because `buildDailyRushProfilePatch` did not exist and `DailyRushScreen` did not use profile context.
- Focused tests after implementation:
  - `npm test -- tests/phase32DailyRushProfileKanji.test.ts tests/phase28UserProfileFoundation.test.ts`
  - 2 files / 14 tests passed.
- Typecheck:
  - `npm run typecheck` passed.
- Full suite:
  - `npm test` passed: 72 files / 550 tests.
- Graphify rebuilt:
  - 2,154 nodes
  - 3,331 edges
  - 175 communities
- GPT-5.5 / Tusk QC:
  - verdict: PASS
  - unresolved P0/P1: none
  - focused tests and typecheck re-run by QC passed

## Notes

This phase intentionally does not block users from replaying Daily Rush. It only prevents same-day repeated runs from adding profile XP more than once. Extra runs are labeled practice-only.
