# Phase 21 — Work Card

## Goal
Clean project structure of `japanese-tutor-mobile-app` while keeping everything working. Per Chris: "prevent stacking" → paced mode with checkpoints.

## Outcome
- **All tests still green** (296/296 across 44 files, runtime ~1.6s)
- **5 source files deleted** (no behavior change)
- **5 files migrated** to design-system tokens
- **Repo size −73%** (14.8 MB → 4.0 MB excl. node_modules)

## Owner
**Igris** (Engineering Division), coordinated by Belion.

## Phases
| | What | Result |
|---|---|---|
| **A** | `.gitignore` write + 26 `dist-*` removal | ✅ |
| **B** | Read-only audit (10 candidate files) | ✅ |
| **C** | Delete `db/database.ts` + `navigationService.ts`, inline test stubs | ✅ |
| **D** | Migrate 5 files off legacy theme; delete 3 legacy `theme/*` files | ✅ |

## Full report
`docs/phase-21-cleanup-report.md`

## Hand-off to Phase 22+
1. Approved-for-beta candidate packs ready to wire (Sensei-approved, not auto-promoted)
2. SQLite persistence layer present but unconsumed by app runtime
3. Screen files large but legible — split only if complexity grows
4. Dark-mode theme variants not yet defined (design system is light-only)