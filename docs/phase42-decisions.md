# Phase 42 — Vietnamese, UX Card, and P1-6 Disposition

**Date:** 2026-07-04
**Author:** Belion (orchestrator)
**Status:** Decision record for Phase 42 work

---

## Decision A — Vietnamese content quality (Chris approved)

**Asked:** *"add vietnamese language as a main language not only english"*

**Reality discovered during Phase 41 audit:** Vietnamese was already a first-class language via phrase-level `english/vietnamese/filipino` fields in content data files, governed by `src/services/supportLanguageService.ts`.

**Chris's chosen interpretation:** Improve Vietnamese content quality. Walk the content corpus, identify `translationReviewStatus: 'draft'` items, either promote to `'approved'` (if Vietnamese reads naturally) or rewrite (if it reads awkwardly).

**Work card:** `.hermes/work-cards/phase42-vi-content-quality.md` (Beru subagent dispatched)

**Why this was the right call:**
- (1) "no work needed" would have wasted the question
- (2) content review addresses the actual gap (draft status fields, potential machine-translation artifacts)
- (3) adding a 4th locale is bigger scope than needed
- (4) UI affordance is cosmetic; the picker already exists

---

## Decision B — `ux-simplification` work-card — REFRESH + PARK (not cancel, not re-scope)

**Original:** Card from 2026-06-24, 5 phases (UX-1 through UX-5), NONE shipped.

**Chris's chosen disposition:** Keep parked, but refresh for future use. Don't cancel (in case problems resurface), don't re-scope (would require 1-2 hours of recon against a 40-phase app).

**Refreshed card:** `.hermes/work-cards/ux-simplification-parked-2026-07-04.md`

**Trigger conditions for re-scope:**
1. New beta feedback matching the 6/24 complaint
2. Telemetry from Phase 37's weekly-todo gate showing completion rate <50%
3. Chris changing his mind

**Why this was the right call:**
- 2 of the 7 original complaints (silent mark-complete + missing todo-gate explanation) were addressed organically by Phase 39 + Phase 41 P1-6. Acting on stale feedback risks refactoring what's already improved.
- 10 days without fresh signal means we don't know if the remaining 5 complaints are still felt. Telemetry would tell us; telemetry isn't wired yet.

---

## Decision C — Igris P1-6 was a false positive (already shipped)

**Audit claim:** *"Weekly-todo gate UX: no disabled-state explanation"*

**Reality on disk:** `src/screens/LessonsScreen.tsx:346-353` already shows:
```tsx
{selectedLessonLockedByTodos ? (
  <Card tone="warm" shadow="none" style={styles.todoLockedCard}>
    <Text style={styles.todoLockedTitle}>Finish this week's todos first</Text>
    <Text style={styles.completedDetailBody}>
      Week {lesson.week} is open for preview, but completion is locked until the previous week's todos are done.
    </Text>
  </Card>
) : null}
```

**Verdict:** P1-6 was already shipped. The mark-complete button isn't even rendered when locked — it's replaced by the warm card with the explanation. No work needed.

**This is the same false-positive pattern as the i18n audit** (Belion producing findings from mental model instead of reading the actual code). Documenting here so future audits don't re-flag it.

---

## Total Phase 42 outcome (so far)

| Item | Status |
|---|---|
| Cold-start new-install test | ✅ Shipped (`a7dcd73`) |
| Tusk QC addendum | ✅ Shipped (`c4140f5`) |
| Production log guard | ✅ Shipped (`2b77cd3`) |
| Stale deps bump (RN/React patch) | ✅ Shipped (`049eb20`) |
| `.npmrc` + `graphify-out` gitignore | ✅ Shipped (`9ae0e63`) |
| Vietnamese content quality review | 🟡 Subagent running |
| `ux-simplification` parked card refresh | ✅ On disk |
| P1-6 todo gate UX (false positive) | ✅ Already shipped; documented |

**5 commits ahead of Phase 41 close-out. 696 tests pass.**