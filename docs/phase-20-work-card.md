# Phase 20 — Work Card

> Pre-implementation intent for Phase 20 (learning loop + UI polish).
> Use as a historical reference. The actual scope shipped is documented in
> `phase-20-completion-report.md`.

## Goal

Move the Japanese Tutor app from "has lessons + flashcards" to a real
learning loop: lesson progression, spaced repetition, study plan, placement
test, kanji section, review mode — all with a coherent visual language.

## Sub-phases (planned)

| Sub | Title | Owner | Status |
|-----|-------|-------|--------|
| 20A | Lesson progression (Week 1 → N) | Igris | ✅ shipped |
| 20B | SM-2 spaced repetition | Igris | ✅ shipped |
| 20C | Study plan / daily streak | Igris | ✅ shipped |
| 20D | JLPT placement test | Igris | ✅ shipped |
| 20E | Kanji section panel | Igris | ✅ shipped |
| 20F | Review mode | Igris | ✅ shipped |
| 20G | Design system + flashcard flip | Igris | ✅ shipped (same window) |

## Risks (planned)

- SM-2 algorithm weights: not changed from defaults. If learners complain
  intervals are too long/short, expose tuning in Phase 22+.
- Study plan streak is not persisted to SQLite yet (in-memory only). Loss
  on app restart is acceptable for the current beta but should be fixed
  in Phase 21.
- Reanimated 4 + worklets 0.5.1 is the locked pair. Any future package
  that introduces Hermes bytecode must be tested carefully — see the
  Phase 20G debugging notes in the completion report.

## Acceptance criteria (all met)

- [x] Lesson progression service returns at least one week with id, label, and objectives.
- [x] Spaced repetition scheduler schedules 1-day default first-correct interval and graduates correctly.
- [x] Study plan tracker increments streak on same-day study, resets on day skip.
- [x] Placement test covers at least 2 JLPT levels with 4-choice questions.
- [x] Kanji section returns cards with non-empty kanji and at least one meaning.
- [x] Review mode session returns items with prompt and 4 choices.
- [x] Design system has a strict type scale and color palette, no ad-hoc hex in redesigned screens.
- [x] Flip animation runs at 60 fps on real Android device.
- [x] Skip/Previous/rate always shows the front of the new card.
- [x] 296 tests passing across 44 files.

## Files (planned vs. actual)

The actual file count is in `phase-20-completion-report.md`. This card
records the original intent only.

## Hand-off to Phase 21

See `phase-20-completion-report.md` "Open follow-ups" section, and the
`.hermes/plans/2026-06-25_110000-phase21-content-density-and-app-store-readiness.md`
plan for the full Phase 21 scope.

## Tusk review

Not required for Phase 20 (Yellow work only — UI polish + service layer).
Re-engage Tusk for Phase 21 if the changes touch SM-2 weights, content
gating, or financial/structure code paths.
