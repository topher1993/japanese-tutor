# Phase 21 — Project Structure Cleanup

**Date:** 2026-06-25
**Owner:** Igris (Engineering Division), coordinated by Belion
**Mode:** Paced (per Chris's "prevent stacking" instruction)
**Status:** ✅ Complete — 296/296 tests green

---

## Goal

Remove historical build clutter and dead code from `japanese-tutor-mobile-app` so the project structure matches a working Expo SDK 54 + React Native 0.81 codebase, with one design system and no orphan files.

**Constraint:** Tests must remain green at every checkpoint. Every deletion/migration is verified by re-running the full vitest suite immediately after.

---

## What changed

### A. Build clutter removed (Phase A — Hygiene)

| Item | Before | After |
|---|---|---|
| `dist-*` directories at repo root | **26** (~10.8 MB) | **0** |
| `.gitignore` | missing | 1,297 bytes |
| Repo size (excl. `node_modules`) | ~14.8 MB | **4.0 MB** (~73% smaller) |

The new `.gitignore` aligns with Expo SDK 54 + React Native 0.81 defaults and ignores:
- `dist-*/` (all historical Expo web build outputs)
- `node_modules/`, `.expo/`, `web-build/`
- `*.tsbuildinfo`, `.metro-*`, `*.jsbundle`
- OS/editor noise (`.DS_Store`, `.vscode/`, etc.)
- Local Hermes runtime scratch

### B. Audit verdict (Phase B — read-only)

10 candidate files audited against the codebase:

| File | Verdict | Evidence |
|---|---|---|
| `src/db/database.ts` | DELETE | `initializeDatabase()` exported but never imported anywhere |
| `src/db/schema.ts` | KEEP | Imported by `sqliteLearningRepository.ts` |
| `src/repositories/inMemoryLearningRepository.ts` | KEEP | Imported by `tests/learningCore.test.ts` |
| `src/repositories/sqliteLearningRepository.ts` | KEEP | Imported by `tests/phase4PersistencePractice.test.ts` + type by `practiceProgressStore.ts` |
| `src/services/navigationService.ts` | DELETE | 0 production importers; only 1 test file used it for stubs |
| `src/services/appNavigationService.ts` | KEEP | Canonical bottom-tab list, used by 2 tests + design-system verification |
| `src/services/lessonNavigatorService.ts` | KEEP | Imported by `src/screens/LessonsScreen.tsx` |
| `src/services/flashcardNavigatorService.ts` | KEEP | Imported by `src/screens/FlashcardsScreen.tsx` |
| `src/theme/colors.ts` | MIGRATE → DELETE | 5 legacy importers |
| `src/theme/spacing.ts` | MIGRATE → DELETE | 5 legacy importers (same 5) |

### C. Dead-code removal (Phase C — applied)

| Action | Detail |
|---|---|
| Deleted `src/db/database.ts` (5 LOC) | `initializeDatabase()` was orphan — schema is reachable directly from `schema.ts` |
| Deleted `src/services/navigationService.ts` (4 LOC) | `createNavigationState/goToTab/openLesson` had zero production consumers |
| Updated `tests/learningCore.test.ts` | Inlined 3 nav helpers as local stubs (replaces the deleted import); behavior identical |

### D. Theme consolidation (Phase D — applied)

Migrated 5 files from `colors.*` / `spacing.*` to `ds.colors.*` / `ds.spacing.*`:

| File | Notable mapping |
|---|---|
| `src/components/Flashcard.tsx` | `colors.surface → ds.colors.surface`, `colors.text → ds.colors.text` |
| `src/components/LessonCard.tsx` | `colors.muted → ds.colors.textMuted`, `spacing.lg → ds.spacing.lg` |
| `src/screens/DailyLessonScreen.tsx` | Full migration; type scale now references `ds.type.*` |
| `src/screens/WeeklyLessonScreen.tsx` | Full migration; uses `ds.colors.background/surface/text` |
| `src/services/appSafeAreaLayoutService.ts` | `spacing.md → ds.spacing.md` (single value used) |

After migration, deleted:

- `src/theme/colors.ts` (10 LOC)
- `src/theme/spacing.ts` (1 LOC)
- `src/theme/typography.ts` (1 LOC — also dead, zero importers, `ds.type` covers the same purpose)

`src/theme/` is now exactly **one file**: `designSystem.ts`.

---

## Token migration map

| Legacy | Design-system target | Notes |
|---|---|---|
| `colors.background` | `ds.colors.background` | `#F3F6F5` → `#F4F7FA` (subtler) |
| `colors.surface` | `ds.colors.surface` | `#FFFFFF` (unchanged) |
| `colors.primary` | `ds.colors.primary` | `#256D85` → `#2A6F97` (ocean blue, calm) |
| `colors.secondary` | `ds.colors.success` | `#2A9D8F` (unchanged) |
| `colors.safety` | `ds.colors.danger` | `#D95F43` (unchanged) |
| `colors.warning` | `ds.colors.warm` | `#E9C46A` → `#F4A261` (amber) |
| `colors.text` | `ds.colors.text` | `#172126` → `#0F172A` |
| `colors.muted` | `ds.colors.textMuted` | `#64727A` → `#64748B` |
| `colors.border` | `ds.colors.border` | `#DDE5E2` → `#E2E8F0` |
| `spacing.xs/sm/md/lg/xl` | `ds.spacing.xs/sm/md/lg/xl` | identical values (4/8/16/24/32) |
| (typography type scale) | `ds.type.*` | strict 8-step scale replaces ad-hoc font sizes |

---

## Verification gates (each green)

| Gate | When | Result |
|---|---|---|
| Phase A | After `.gitignore` write + 26 dirs deleted | **296/296 ✅** |
| Phase C.1 | After `db/database.ts` + `navigationService.ts` deleted + test inlined | **296/296 ✅** |
| Phase D.1 | After 5 files migrated to `ds.*` | **296/296 ✅** |
| Phase D.2 | After legacy `theme/` files deleted | **296/296 ✅** |
| Phase Final | Triple-grep + full suite | **296/296 ✅** |

**Triple-grep verification (zero dangling imports):**
- `grep "theme/colors|theme/spacing|theme/typography"` in `src/` + `tests/` → 0 matches
- `grep "services/navigationService"` in `src/` + `tests/` → 0 matches
- `grep "db/database"` in `src/` + `tests/` → 0 matches

---

## Net effect

| Metric | Before Phase 21 | After Phase 21 | Delta |
|---|---|---|---|
| Source files | 117 | **112** | **−5** |
| Files at repo root (excl. hidden) | 30+ | **4** (`app.json`, `App.tsx`, `package.json`, `package-lock.json` + `tsconfig.json`, `babel.config.js`, `README.md`) | much cleaner |
| Repo size (excl. `node_modules`) | ~14.8 MB | **4.0 MB** | **−73%** |
| `src/theme/` files | 4 | **1** | one design system |
| Dead/orphan files | 5 | 0 | clean |
| Test count | 296 | 296 | unchanged |
| Test pass rate | 100% | **100%** | unchanged |

---

## Lessons / pitfalls (for future phases)

1. **Test stubs become dead code too.** `services/navigationService.ts` was only imported by one test file as a scaffold; when the test's real focus was persistence (not navigation), the stubs became orphans. Test imports should use the smallest possible stub.

2. **Hidden theme legacy is the most insidious cleanup trap.** Three different `theme/*` files accumulated; one was on the active design-system path, three were dead or legacy. Grepping `theme/colors|theme/spacing` immediately surfaced the 5 importers that needed migration.

3. **`theme/typography.ts` (1 LOC) hid in plain sight.** Single-line exports with generic names ("typography") are easy to miss. Pattern: before deleting any `theme/*` file, grep for *every possible substring of its filename* (`typography`, `type`, `types`).

4. **`.gitignore` being empty was the root cause of the 26 `dist-*` dirs at the root.** Without an ignore rule, every `expo export:web` output accumulated. Adding the rule on day 0 would have prevented all of it.

---

## What this Phase does NOT do (parked for Phase 22+)

- **Wire approved-for-beta candidates into the active study set.** Content promotion rule still respected.
- **Persist study plan + SR state to SQLite.** The repo layer is now confirmed-but-unused; ready when needed.
- **Split large screens into smaller files.** `FlashcardsScreen.tsx` is 200+ lines but still legible; not urgent.
- **Migrate `designSystem.ts` to TypeScript theme objects with light/dark variants.** Currently `as const` literal only.

---

## Routing note

This Phase was executed under **Igris (Engineering Division)** per Agent Army governance. Belion coordinated, routed the request to Igris, ran test gates between phases, and reported the integrated result. No other division was involved.