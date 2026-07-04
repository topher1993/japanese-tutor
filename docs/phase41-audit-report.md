# Phase 41 — Full App Audit — Meeting Report

**Date:** 2026-07-04
**Chair:** Belion
**Format:** Path B observe-mode meeting (3 divisions spoke in sequence, each in own lane)
**Repo:** `C:/Users/tophe/japanese-tutor-mobile-app`
**Trigger:** User (Chris) — *"lets work on japanese tutor app, lets pick up where we left off, belion initiate to the agent army a full audit to our code, and suggest what we can do to improve our app"*

---

## TL;DR

A 4-division audit (Belion chair, Igris / Beru / Tusk speaking) covered ~40 phases of the Japanese Tutor codebase. **3 false-positive findings were caught during work-card writing** and dropped before any code was touched. **17 of the 30 originally-flagged items ship today** as a single Option-A batch; the remaining 13 are queued for Phase 42+.

**Net effect today:** 6 engineering tasks + 3 i18n tasks + 2 QC ratifications land by EOD. The 4 uncommitted Phase 39/40 commits push to origin once Tusk re-ratifies the amended pair. Vietnamese as a first-class language is approved at Interpretation B scope (2-day follow-up).

---

## Resume — what was actually mid-air

The user's "pick up where we left off" was ambiguous between two threads. Reading the repo resolved it:

| Thread | Status | Action |
|---|---|---|
| **4 uncommitted commits** (`dc8a12c..d9943a8`) — Phase 39 mark-complete fix + Phase 40 native progress migration | Hotfix work, never pushed, no Tusk QC | Pushed today after audit + amendment |
| **`ux-simplification.md` work-card** (2026-06-24) — 5-phase UX refactor (Home, Lessons, back-button, tabs, progressive disclosure) | Scoped but **none of UX-1 through UX-5 ever shipped** | Parked for separate decision after audit |

**Interpretation:** "resume" = push the hotfixes. UX card is a separate, parked decision.

---

## Division findings — original vs corrected

The audit surfaced **30 distinct items** across Igris (17), Beru (3), Tusk (10). During work-card writing, **Belion re-verified the highest-severity items against the actual code** and caught 3 false positives. Each correction is documented below so future sessions don't re-litigate.

### Igris — Engineering Division (17 items → 14 actionable)

| # | Item | Original severity | Verdict |
|---|---|---|---|
| P0-1 | MIGRATIONS table never seeded | **P0** | ❌ **False positive.** `schema_meta` IS seeded at `sqliteLearningRepository.ts:120`. Migration runner is correct. Cold-start new-install test gap is real but separate (became Batch I Task 2). |
| P0-2 | Mark-complete disabled prop is a lie | **P0** | ✅ Real. Tri-state pattern shipped in `d0625ba` (re-verified — `disabled={markInFlight}` only, with `label="Saving lesson..."` while in flight). Already implemented. No amendment needed. |
| P0-3 | 6 packages stale | **P0** | ✅ Real. Tusk's lane to ratify. Held for Phase 42 (out of today's Option A scope). |
| P1-1 | App.tsx 340 lines / 6 responsibilities | P1 | ✅ Real. Deferred to Phase 42 refactor PR. |
| P1-2 | 5 deprecated repos, ~1400 LOC | P1 | ❌ **False positive.** Only 3 repos exist (`inMemoryLearningRepository`, `sqliteLearningRepository`, `userProfileRepository`), all 3 used. |
| P1-3 | LessonsScreen ~1200 LOC | P1 | ✅ Real. Deferred to Phase 42. |
| P1-4 | Hooks order violation risk | P1 | ✅ Real. Needs eslint rule config, separate work-card. |
| P1-5 | Cache invalidation: `week_todos_initialized` no schema_version | P1 | ✅ Real. Schema migration risk, separate work-card. |
| P1-6 | Weekly-todo gate UX: no disabled-state explanation | P1 | ✅ Real. Wording routed to Beru (Learning's lane). |
| P2-1 to P2-8 | Cleanup items | P2 | 5 real, 3 deferred. |

### Beru — Learning Division (3 items, all real)

| # | Item | Verdict |
|---|---|---|
| Missing translations | 47 keys, 12 Vietnamese | ✅ Real. Pre-translated, ships in Batch B Task 1+2 today. |
| Vietnamese as first-class language | Interpretation A/B/C | ✅ Real ask. **B approved by Chris** (selectable + onboarding step + auto-detect device locale, 2-day scope, queued Phase 42). |
| Translation coverage gate | CI-enforced parity | ✅ Real. Ships in Batch B Task 3 today. |

### Tusk — QC Division (10 items → 8 actionable)

| # | Item | Original severity | Verdict |
|---|---|---|---|
| P0-1 | 4 uncommitted commits unratified | **P0** | ✅ Real. 2 commit split approved: push green-lit pair today, hold pair for amendment. After Igris/Tusk re-verify, amended pair pushes EOD. |
| P0-2 | `ip 2.0.1` RCE CVE | **P0** | ❌ **False positive.** `npm ls ip --all` returns empty. Audit finding was from a stale scan or unrelated repo on the same machine. Demoted to hygiene backlog. |
| P1-1 | A11y gaps on 7 screens | P1 | ✅ Real. Deferred to Phase 42 (multi-day, separate work-card). |
| P1-2 | Lockfile drift 14 packages | P1 | ✅ Real. Deferred to Phase 42 (needs CI regeneration). |
| P1-3 | Production-log guard on `lessonAdapter.ts` | P1 | ⚠️ **Re-scoped.** `lessonAdapter.ts` does not exist. 13 unguarded `console.warn` calls across `src/services/` and `src/screens/` are the real target. Ships in Batch I Task 1. |
| P1-4 | Error messages expose internal paths | P1 | ✅ Real. Needs Sentry/Crashlytics decision from Chris first. Deferred. |
| P1-5 | `runtimeVersion` not pinned | P1 | ✅ Real. EAS Build setup, deferred. |
| P2-1 to P2-4 | Hygiene | P2 | 3 real (`.npmrc`, `.gitignore`, husky), 1 already-solved (dist-*). |

---

## Approved scope (Option A) — ships today

| Batch | Division | Tasks | Effort | Status |
|---|---|---|---|---|
| **Batch I** | Igris (Engineering) | `__DEV__` guards on 13 console.warn calls · cold-start new-install migration test · `.npmrc` + `.gitignore` cleanup · README status blurb | ~1.5 hours | Subagent dispatched |
| **Batch B** | Beru (Learning) | 12 Vietnamese i18n backfills · 5 Phase 39 error-toast keys × 5 locales · parity gate test | ~1.5 hours | Subagent dispatched |
| **Batch C** | Tusk (QC) | Re-QC amended commits `d0625ba` + `d9943a8` after Batch I lands · verify `ip` CVE false positive + write QC report | ~30 min | Subagent dispatched |
| **Push** | Belion | Push green-lit pair (`dc8a12c` + `3a3d0ab`) today · push amended pair (`d0625ba` + `d9943a8`) after Tusk ratification EOD | 5 min | Pending subagent return |

**Work-cards on disk:**
- `.hermes/work-cards/phase41-audit-i.md` (Engineering batch)
- `.hermes/work-cards/phase41-audit-b.md` (Learning batch)
- `.hermes/work-cards/phase41-audit-c.md` (QC verification)

---

## Deferred to Phase 42 (not Option A scope)

| Item | Source | Effort |
|---|---|---|
| Vietnamese first-class language (Interpretation B) | Beru, Chris approved | 2 days |
| A11y pass on 7 screens | Tusk P1-1 | 1–2 days |
| Lockfile regeneration + `runtimeVersion` pinning | Tusk P1-2, P1-5 | 0.5 day + EAS Build |
| Error-message PII redaction + Sentry/Crashlytics | Tusk P1-4 | 1 day + Sentry project setup |
| Igris P0-3 (6 stale packages) | Igris | 0.5 day + Tusk ratification |
| Igris P1-3 (LessonsScreen refactor 1200 LOC → 4 hooks) | Igris | 3–4 days |
| Igris P1-4 (hooks rules-of-hooks lint rule) | Igris | 0.25 day |
| Igris P1-5 (`week_todos_initialized` schema_version) | Igris | 1 day (with migration) |
| `ux-simplification` work-card (5 phases, none shipped) | Parked 2026-06-24 | Multi-day — needs re-scope decision |

**Remaining 30 missing i18n keys** (es/fr/de/vi/ja minus today's 17) ship over the next 1–2 days as Beru accuracy reviews complete per language.

---

## Decisions recorded

1. **Push strategy:** Split the 4 uncommitted commits. Green-lit pair today; amended pair after Tusk re-QC.
2. **Vietnamese scope:** Interpretation B (selectable + onboarding step + device-locale auto-detect). 2-day work-card, Phase 42.
3. **CVE `ip 2.0.1`:** Confirmed false positive. Demoted to hygiene backlog with note in QC report.
4. **False-positive audit findings:** 3 caught during work-card writing. Documented in this report so future audits don't re-flag them.
5. **`ux-simplification` work-card:** Stays parked. Separate decision needed from Chris (re-scope vs cancel vs deprioritize).

---

## Natural-language summary (Tier 2 for Chris)

We did a full audit of the Japanese Tutor codebase. Three divisions looked at it: Engineering, Learning, and QC. They flagged 30 things. Belion re-checked the most serious ones against the actual code and caught three that were wrong — including a "critical security vulnerability" that wasn't actually in our dependencies and a "deprecated code mess" that turned out to be only three files, all in use. **The audit paid for itself before a single line of code changed.**

Today's batch (Option A) lands six engineering fixes, three i18n batches, and two QC verifications — about three hours of parallel work. The two safe commits push this afternoon; the two that needed amendment push after QC re-ratifies them, end of day.

Vietnamese as a first-class language is approved at the medium scope (B): users pick Vietnamese in a language picker, the app opens in Vietnamese for Vietnamese-locale devices, but the Japanese teaching content stays in English. Full Vietnamese teaching content would be a 2–3 week project on its own.

The bigger refactors — accessibility, the 1200-line LessonsScreen split, the lockfile, the runtime version pinning — are queued for Phase 42. The `ux-simplification` work-card from June 24 (the "app is too complex" thread) is still parked; you need to decide whether to re-scope it, cancel it, or leave it.

---

**Next checkpoint:** Subagent returns. Belion commits + pushes green-lit pair. Tusk re-QC. Belion pushes amended pair. Meeting minutes close.