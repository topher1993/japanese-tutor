# JT-CARRY-FORWARD.md — Stronghold Patterns to Carry Into JT Design

**Author:** Lyra (cross-project UI/UX Design Lead)
**Date:** 2026-07-07
**Purpose:** Capture Stronghold Phase 1-4 design-process patterns that should shape JT design from day 1 — JT has shipped 44 phases without a Lyra-design review, so the next design-shape phase needs the cumulative carry-forward baked in from the start. **Per the brief, patterns below are illustrative of Stronghold learning; Lyra has not re-read Stronghold during this dispatch** and these are derived from documented cross-project principles, not a fresh Stronghold audit.

---

## 1. Six carry-forward patterns

### 1.1 Telemetry gates before visible design-shape changes

- **Stronghold pattern:** Stronghold Phases 1-4 established a "telemetry-first re-scope" convention — no user-visible design-shape refactor without PostHog-class evidence that the current shape is failing. Parked-work-cards cite this as the trigger for un-park.
- **JT application:** The 2026-06-24 `ux-simplification` card was parked 2026-07-04 with telemetry as the explicit re-scope trigger. Phase 44.4 (PostHog dashboards) just shipped. The right JT design-shape move is to wait 2 weeks and let the data decide whether UX-2 / UX-4 un-park, NOT to act on 10-day-old beta complaints against a 44-phase app.
- **Skip if:** the user has explicitly overridden the wait (Chris has done this once during Stronghold); respect that override once and document it.

### 1.2 Soft-mutable undo for any destructive design-shape change

- **Stronghold pattern:** destructive changes (tab renames, deep-panel collapses, copy rewrites) ship with an option to soft-revert the rename or label without losing the test surface. The "first-launch helper text" pattern under each tab label is Stronghold's soft-rollback mechanism for tab renames.
- **JT application:** When UX-3 ships (per Option B), preserve the OLD labels as `tab_visited` event properties for 2 release cycles so analytics can compare old-label vs new-label completion rates. Without that, you'd be flying blind on whether the rename helped or hurt.
- **Skip if:** the change is purely additive (new screen, new illustration, new badge tier).

### 1.3 Parent-component collision grep before dispatching any "add header / wrap with scaffold" instruction

- **Stronghold pattern:** before dispatching any instruction that adds a `ScreenHeader`, `ScreenScaffold`, or `<- Back` label change, grep for whether the same screen already has a parent component providing that scaffolding. Adding a second `ScreenHeader` over `ScreenScaffold` causes double safe-area padding and double-titled Chrome — a visible regression that snap-tests catch late.
- **JT application:** Phase 20G rolled out `ScreenScaffold` + `ScreenHeader` to Home, Lessons, Kanji, Quiz, Progress, Onboarding, Sources, Settings. New design-shape work (e.g. Phase 46) must grep `ScreenHeader` / `ScreenScaffold` counts in any touched screen file BEFORE wrapping it again. The cost of one grep is one minute; the cost of double-titling a screen is a re-ship.
- **Skip if:** the instruction is `remove` not `add`.

### 1.4 Runtime type guards at every data-shape seam (PII / content / config)

- **Stronghold pattern:** every place where design-shape data crosses a trust boundary (JSON blob from server, config from onboarding, content from a candidate pack) gets a runtime guard. The guard fails loud (test), never silent (skip).
- **JT application:** Phase 41 shipped `phase42TodoBlobSchema.test.ts` for the schema_version envelope. The Phase 41 P1-5 / `week_todos_initialized` follow-up is exactly a Stronghold-style guard at the SQLite-read seam. Apply the same guard pattern to any new design-shape data (e.g. onboarding-step titles, empty-state copy) that crosses a serialization seam.
- **Skip if:** the data is fully static and `as const` literal at build time.

### 1.5 Brief-fabrication pre-flight (orchestrator/designer mental-model audit)

- **Stronghold pattern:** the orchestrator (Belion) and designer (Lyra) both have the same anti-pattern: writing a brief against a mental model without ever grepping the repo. Audit-fabrication-prevention (saved 2026-07-04) catches the orchestrator side; the design side needs the same discipline. Before dispatching any design-shape brief, the designer must: (a) grep the screen file for `ds.*` token counts, (b) grep for parent-component additions, (c) read the latest phase report about that screen, (d) read the parked-work-card list for any conflicting parked scope.
- **JT application:** this recon (JT-RECON-v1.md) is the first Lyra brief that did the pre-flight. Future Lyra briefs (Phase 46+) must do a similar 4-step pre-flight + record it in the brief footer. Adding 10 minutes to the brief-prep cycle eliminates the "C-1 modules were never actually written" / "LessonsScreen is 1200 LOC actually 689" / "Beru's 6 locales are actually 3" pattern that dominated Phase 41+42 audit findings.
- **Skip if:** the brief is for an option-pick confirmation, not a design-shape spec.

### 1.6 Semantic-correctness gates at every visual gate

- **Stronghold pattern:** visual gates (snapshot tests, visual-QA tests, theme-color enforcement) lock the visual baseline. Semantic-correctness gates verify the screen's CONTRACT, not its pixels — "Onboarding step 1 says 'Welcome'", "Reset button lives in Settings not Home", "Toast title is the failed action's name". Both are needed; pixel-only tests rot, contract-only tests drift visually.
- **JT application:** Phase 20G's `phaseUxSimplification.test.ts` (26 tests locking "one primary action per screen, consistent label, no competing CTAs") is a semantic-correctness gate. The matching snapshot tests (Phase 21.B.5 from the Phase 20G open follow-ups) were planned but never shipped. Phase 45+ should add the snapshot layer as a complement to the semantic layer — together they're Stronghold-grade.
- **Skip if:** the screen is purely functional with no visible chrome.

---

## 2. Carry-forward summary table

| # | Pattern | JT use-phase | Skip-if condition |
|---|---|---|---|
| 1 | Telemetry gates | Phase 45 (now) and every future re-scope decision | Explicit user override documented |
| 2 | Soft-mutable undo | Phase 46+ when tab renames / copy rewrites ship | Pure-additive change |
| 3 | Parent-component grep | Every "add header / wrap scaffold" brief | `remove`-only instructions |
| 4 | Runtime type guards | Any seam crossing (SQLite, JSON, onboarding config) | Pure static-literal data |
| 5 | Brief-fabrication pre-flight | Every Lyra design-shape brief | Option-confirmation briefs |
| 6 | Semantic + visual gates together | Phase 45+ when shipping visual changes | Functional-only chrome |

---

## 3. What I'd promote to a generic Lyra skill

Of the six, **#3 (parent-component collision grep)** and **#5 (brief-fabrication pre-flight)** are the two I'd promote to a cross-project Lyra skill rather than letting JT-only patterns absorb them.

- **Parent-component collision grep** has appeared in 3 different Stronghold phases and is the most likely recurring Lyra mistake when scoping any "wrap X with Y" instruction. Promote to a 1-page skill with the grep command and a worked example.
- **Brief-fabrication pre-flight** is the design-side mirror of Belion's `audit-fabrication-prevention` skill. It belongs in the same governance skill family and should be discoverable from the audit skill's description so future Belion + Lyra dispatch pairs both reach for it.

Other four (#1, #2, #4, #6) are JT / Stronghold-aware enough that I'd leave them as project-context prose for now and promote only after a second project surfaces the same need.
