# Phase 22 — Independent Engineering Audit

**Started:** 2026-06-25 13:35
**Orchestrator:** Belion (MiniMax M3)
**QC Authority:** GPT-5.5 (via openai-codex provider, Codex Plus subscription)
**Engineering Division:** MiniMax M3 (subordinate to Belion)

---

## Role separation (per BELION DIRECTIVE)

| Role | Model | Responsibility |
|---|---|---|
| Orchestrator | MiniMax M3 (Belion) | Assign work, verify routing, enforce governance, NO verdicts |
| Engineering | MiniMax M3 | Implement fixes, run tests, write code |
| **QC authority** | **GPT-5.5** | **Architecture review, code review, security audit, performance audit, UX review, Japanese learning review, maintainability review, technical debt review, release approval** |

GPT-5.5 is the ONLY model authorized to issue production-readiness verdicts.
Belion must NEVER review its own work.

---

## Repo state at audit start

| Metric | Value |
|---|---|
| Source files (.ts/.tsx in src + tests) | 157 |
| Total LOC (src + tests) | 11,225 |
| `src/` size | 967 KB |
| `tests/` size | 221 KB |
| `docs/` size | 2.3 MB |
| Repo size (excl. node_modules/.expo/.hermes) | 3.8 MB |
| Test files | 44 |
| **Tests passing** | **296/296** ✅ |
| Test runtime | ~2.2s |

## Stack

| Layer | Tech |
|---|---|
| Runtime | React Native 0.81.5 + React 19.1.0 |
| Build | Expo SDK 54.0.35 (Metro 6.1.2) |
| Animation | react-native-reanimated 4.1.1 + react-native-worklets 0.5.1 |
| Storage | expo-sqlite 16.0.10 (currently unreferenced at runtime) |
| Haptics | expo-haptics 15.0.8 |
| Safe area | react-native-safe-area-context 5.6.2 |
| TS | 5.9.3 |
| Tests | vitest 4.1.9 |
| Babel | babel-preset-expo 54.0.10 |

## Repo layout

```
src/
  assets/        (icons, illustrations, splash)
  components/    (15 — design system + flip card)
  data/          (active content + candidates/ + generated/)
  db/            (schema.ts only — schema is reachable; no app consumer yet)
  i18n/          (en, tl, vi)
  repositories/  (inMemory + sqlite, both kept for Phase 23+)
  screens/       (15 — 1 main + 4 panels)
  services/      (37 — domain logic)
  theme/         (designSystem.ts ONLY — single source of truth)
  types/         (9)
tests/           (44 files, 296 tests)
docs/            (109 phase + beta + content review files)
scripts/         (JMdict + KANJIDIC2 import scripts)
```

## Recent completed phases

| Phase | Title | Status |
|---|---|---|
| 2-19 | (legacy phases, see docs/phase-*-completion-report.md) | ✅ |
| 20A-F | Lesson progression / SM-2 / study plan / placement / kanji / review mode | ✅ |
| 20G | Design system foundation, flip animation, dead-button + spacing fixes | ✅ |
| 21 | Project structure cleanup (delete 26 dist-* + 5 dead/orphan files, theme consolidation, repo size −73%) | ✅ 296/296 green |

## Known gaps (parked by Chris's standing rules)

| Item | Status |
|---|---|
| Apple Developer Program | Not provided — TestFlight blocked |
| App Store Connect | Not provided — iOS beta distribution blocked |
| EAS config | Not provided |
| iOS bundle ID | Not provided |
| Auto-wire approved-for-beta candidates to active study set | Blocked per content-promotion rule |
| SQLite persistence wired to app runtime | Available but unconsumed |

---

## AUDIT BRIEF — to be delivered to GPT-5.5

The QC authority (GPT-5.5) is asked to perform an INDEPENDENT AUDIT covering the
nine scope areas enumerated in the BELION DIRECTIVE. Output must be a structured
report with:

1. Executive Summary (≤300 words)
2. Architecture Report
3. Code Quality Report
4. Security Audit
5. Performance Audit
6. UX Audit
7. Japanese Learning Audit
8. Technical Debt Report
9. Issue Tracker (every finding with: ID, Risk Green/Yellow/Red, Priority P0-P4, Description, Root Cause, Recommendation, Implementation Guidance)
10. Change History (this audit cycle only — empty in Phase 1)
11. Remaining Risks
12. Production Readiness Score (0-100)
13. Final Verdict: Approved / Approved with Conditions / Not Approved

Every finding MUST be classified by Risk AND Priority.
Every P0 and P1 MUST have a concrete root cause and implementation guidance.

GPT-5.5 must NOT review its own work.
GPT-5.5 MUST be highly critical — not merely verify functionality.

---

## Audit trail

| Timestamp | Agent | Division | Model | Action |
|---|---|---|---|---|
| 2026-06-25 13:35 | Belion | Coordinator | MiniMax M3 | Started Phase 22 audit; verified routing via `hermes -p default -m openai-codex/gpt-5.5` smoke test (response: CODEX_ROUTING_OK) |
| 2026-06-25 13:35 | Belion | Coordinator | MiniMax M3 | Confirmed baseline tests 296/296 passing |
| 2026-06-25 13:36 | Belion | Coordinator | MiniMax M3 | Built audit manifest, dispatched to QC |

[This trail is appended to at every audit step.]

| Timestamp | Agent | Division | Model | Action |
|---|---|---|---|---|
| 2026-06-25 13:35 | Belion | Coordinator | MiniMax M3 | Started Phase 22 audit; verified routing via `hermes -p default -m openai-codex/gpt-5.5` smoke test (response: CODEX_ROUTING_OK) |
| 2026-06-25 13:35 | Belion | Coordinator | MiniMax M3 | Confirmed baseline tests 296/296 passing |
| 2026-06-25 13:36 | Belion | Coordinator | MiniMax M3 | Built audit manifest, dispatched to QC |
| 2026-06-25 13:40 | GPT-5.5 | QC Authority | openai-codex/gpt-5.5 | Delivered sections 6-13 of audit (300 lines) |
| 2026-06-25 13:50 | GPT-5.5 | QC Authority | openai-codex/gpt-5.5 | Delivered sections 1-5 (verified file path consistency before continuing) |
| 2026-06-25 14:00 | Belion | Coordinator | MiniMax M3 | Consolidated full audit report to `docs/phase-22-audit-phase-1-report.md` |
| 2026-06-25 (Phase 23) | Belion / Igris / Tusk | Multiple | MiniMax M3 + GPT-5.5 | Phase 23 implementation cycle: closed P0-01..04, P1-05..09; introduced 3 P0-new blockers; **score 72/100 APPROVED-WITH-CONDITIONS** (see `docs/phase-23-reaudit-report.md`) |
| 2026-06-25 15:26 | Belion / Tusk | Coordinator + QC | MiniMax M3 + openai-codex/gpt-5.5 | Phase 24 re-audit dispatch (session 20260625_152642_5aa3c4). **NOT APPROVED. Effective score 38/100** (down 34). Phase 24 was a no-op — engineering session dropped mid-execution. Recommendation: close Phase 24 as NO-OP, open Phase 25 with P0-1..3 + P1-1..2 + P2-1 + P3-1..2. Full verdict in `docs/phase-24-reaudit-report.md`. |
| 2026-06-25 ~16:00-20:00 | Igris / Belion | Engineering | MiniMax M3 | **Phase 25 implementation.** Closed P0-1 (TSX `<T>` ambiguity), P0-2 (real native reset), P0-3 (FlashcardsScreen persistent SRS), P1-1 (Home → "Review due now" CTA + dueReviewMode route flag), P1-2 (honest on-device disclosure), P2-1 (`todayIso()` in flashcard data layer), P3-1 (audit report `[object Object]`), P3-2 (awaited SRS test assertion). 5 new test files / 35 new tests. Tests: 329→364. |
| 2026-06-25 20:23 | Tusk | QC | openai-codex/gpt-5.5 | Phase 25 first re-audit (session 20260625_202353_53a788). **NOT APPROVED. Score 68/100.** Caught 2 blockers: HomeScreen `variant="brand"` runtime crash; typecheck reported 18 errors vs my claim of 15. Full verdict in `docs/phase-25-final-audit-report.md`. |
| 2026-06-25 20:29 | Tusk | QC | openai-codex/gpt-5.5 | Phase 25 re-audit #1 (session 20260625_202932_5c61c0). **APPROVED-WITH-CONDITIONS. Score 74/100.** Both previous blockers fixed; caught FlipCard prop mismatch (core learning UI). Full verdict in `docs/phase-25-final-rereaudit-report.md`. |
| 2026-06-25 20:36 | Tusk | QC | openai-codex/gpt-5.5 | Phase 25 re-audit #2 (session 20260625_203610_af9269). **APPROVED-WITH-CONDITIONS for closed-beta prep. Score 80/100.** All code blockers closed. Typecheck 0 errors (was 20 in Phase 23). Remaining conditions: `expo.experiments.reanimated` config (cosmetic), on-device smoke (operational, blocked iOS). Full verdict in `docs/phase-25-final-rereaudit2-report.md`. |

## Phase 24 → Phase 25 transition (2026-06-25)

**GPT-5.5 verdict:** Do not recommission Phase 24. Roll scope forward into **Phase 25** as a narrow recovery phase. Conditions for APPROVED, in order:

### P0-1 — TSX generic-arrow parse failures (TYPECHECK BLOCKER)
- `App.tsx:117`, `App.tsx:176`, `src/services/learningContext.tsx:72`
- Fix: replace inline generic arrow functions in `.tsx` object literals with TSX-safe wrappers or typed casts.
- Verify: `npm run typecheck` returns 0 errors, tests still green.

### P0-2 — Real native reset path
- Add `practiceProgressStore.reset()`, `repo.deleteAllProgress()`, `persistentSrsStore.clearAll()`.
- Wire Settings `onReset` to clear onboarding pref + completed lessons/progress/streak/settings + SRS cards.
- Verify: unit/integration tests prove reset removes persisted progress + SRS rows.

### P0-3 — FlashcardsScreen persistent SRS
- Remove local `createSpacedRepetitionScheduler()`. Use `srs` from `useLearningContext()`.
- `dueCount` must call `srs.dueCount()`. Rating must call persistent `srs.createCard()` / `srs.review()`. UI must refresh.
- Verify: test that rating writes to persistent SRS, and a fresh store can re-hydrate.

### P1-1 — Real "Review N due cards now" CTA on Home
- Real button, navigates to Flashcards with due-review mode or route flag (or downgrade wording if pre-filtering too expensive for this phase).

### P1-2 — On-device persistence smoke test
- Android (definitely): complete lesson → kill → relaunch → assert; rate flashcard → kill → relaunch → assert SRS row.
- iOS: explicit "blocked" if no Apple/EAS/App Store setup; do not falsely mark complete.

### P2-1 — Hardcoded flashcard due dates → `todayIso()`
- `src/services/flashcardService.ts:9-10`, `src/services/candidateFlashcardAdapter.ts:38,53`.
- Update existing tests so they aren't time-flaky.

### P3-1 — Fix audit report `[object Object]`
- `docs/phase-22-dependency-audit.md:16`. Regenerate or hand-fix.

### P3-2 — Await fragile SRS test assertion
- `tests/phase22P0SrsPersistence.test.ts:116` → `await expect(...).resolves.toBe(1)`.

**GPT-5.5 bottom line:** "Phase 23's 72/100 no longer represents the current actionable readiness state after a failed Phase 24. The effective score is 40/100 until the P0s are actually fixed and verified." (Effective score Belion arrived at independently: 38/100.)

## Phase 1 verdict (received from QC)

- **Verdict:** ❌ NOT APPROVED
- **Score:** 47 / 100
- **P0 blockers (4):** P0-01 onboarding storage, P0-02 persistence wiring, P0-03 SRS scheduler, P0-04 bottom-tab labels
- **P1 follow-ups (5):** P1-05 width cap, P1-06 reset affordance, P1-07 bundle split, P1-08 query-param gate, P1-09 dep audit
- **Conditions for re-audit:** P0 + P1 verified by on-device integration tests, plus cold-start persistence test + SRS integration test

## Phase 2 status

**Awaiting Chris's go-ahead to begin Phase 2 (engineering implementation of P0s and P1s).** Per directive: Belion does not begin Phase 2 until Chris reviews Phase 1 findings.