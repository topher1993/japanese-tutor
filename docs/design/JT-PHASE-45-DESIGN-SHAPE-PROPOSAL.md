# JT-PHASE-45-DESIGN-SHAPE-PROPOSAL.md — Phase 45 Shape Proposal

**Author:** Lyra (cross-project UI/UX Design Lead)
**Date:** 2026-07-07
**Recon reference:** JT-RECON-v1.md (companion doc)

---

## 1. One-paragraph summary of what Phase 45 should focus on

Phase 45 should be a **telemetry-first design-shape validation** that uses the freshly-wired PostHog dashboards (Phase 44.4) to decide whether to un-park the 2026-06-24 `ux-simplification` card, NOT a wholesale UI refactor on stale feedback. The Phase 20G design system is mature and universally adopted; the parked UX card is the only outstanding design-shape debt; and recent audits (Phase 41, 42) closed the rest. Acting on 10-day-old beta complaints against a 44-phase app is the textbook anti-pattern. Phase 45 should: (a) wait the 2-week PostHog data window, (b) classify each tab/screen by visit rate + completion rate + reset-event correlation, and (c) recommend a Phase 46 design-shape scope based on real signal.

---

## 2. Three concrete options for the next design phase

### Option A — Telemetry gate, no design shape change (DEFAULT)

**What ships:** Nothing user-visible. Phase 45 only exists to wait for PostHog data to mature.

- Wait until 2026-07-21 (2 weeks after Phase 44.4 dashboard setup).
- For each tab/screen, log: visit rate per session, time-on-screen, and exit-without-action rate.
- Output: a 1-page design-shape proposal that uses real numbers to decide whether UX-2 / UX-4 from the parked card un-park for Phase 46.

**Trade-offs:**
- PRO: zero risk of regressing a 44-phase app on stale feedback. Closes the "acting on 10-day-old complaints" loop with evidence instead.
- PRO: produces a defensible Phase 46 brief instead of another parked card.
- CON: Chris may perceive Phase 45 as "waste". Mitigation: ground the wait in the parked-card's own re-scope triggers ("Telemetry from Phase 37's weekly-todo gate ... suggests UI friction").
- CON: if PostHog events are sparse (e.g. <100 onboarded users so far) the data may be statistically useless.

---

### Option B — Dispatch the parked UX-2 / UX-4 directly, no telemetry

**What ships:** The 5-phase UX simplification card re-scoped to the 3 remaining sub-phases (UX-2 reduce Lessons clutter, UX-3 standardize back button + rename tabs, UX-4 progressive disclosure of deep panels) — about 1.5 days per the parked card's re-scope estimate.

- Rename bottom tabs: Home → Today, Lessons → Learn, Flashcards → Practice, Quiz → Test, Progress → Progress (kept). Add small first-launch helper text under each.
- Collapse 6 deep panels (Kanji, Review Mode, Placement Test, Sources, Beta Feedback, Workplace Survival) behind a single "More tools" disclosure.
- Collapse `<- Back` to a single label.
- Hide candidate-content banner (developer telemetry) and move to Stats.
- Hide duplicate "All current lessons" list.

**Trade-offs:**
- PRO: closes the oldest, biggest design-shape debt. The 2026-06-24 complaint gets answered after 13 days not "waiting another quarter".
- PRO: small enough to land in one Igris subagent with a 700/700 test gate at every checkpoint.
- CON: violates the parked-card's own re-scope rule that says "Do UX-3 LAST" — because tab renames break muscle memory, doing them before telemetry validation means if telemetry says otherwise we shipped a user-visible regression anyway.
- CON: Igris would touch 12+ files and ship 2-3 days of refactor without signal-grade evidence.

---

### Option C — Tier-2 asset polish (non-UX-simplification design-shape)

**What ships:** Three Tier-2 illustrative assets plus their DS-aligned integration tests.
- Onboarding illustration set (3 panels, 320×480 SVG, simple flat) mapped to the current 4 onboarding steps (welcome, language, workplace-goal, daily-habit).
- Empty-state illustration for Home / Lessons / Flashcards / Progress / Quiz / Survival (240×240 SVG).
- Streak / JLPT badge set (96×96 PNG set; 7-day-streak-fire + N5/N4/N3 badges).
- Visual-QA test harness asserting each asset renders crisply at 1x / 2x / 3x on Android and iOS.

**Trade-offs:**
- PRO: a non-functional design-shape phase that doesn't risk regressing the 700/700 test base; visual polish the learner actually notices.
- PRO: gating aligns cleanly with governance: Beru owns WHAT (which assets, which pedagogical moment), Kaisel / Tool Division owns HOW (which generator), Igris owns WHERE (file paths / cache strategy), Tusk owns VERIFY (visual + content accuracy).
- CON: 5 moderate-severity vulnerabilities (`ip` false-positive aside, 19 npm audit findings) are unresolved and may block store release regardless of how pretty the assets are. Asset polish without progress on dependency hygiene is decorative.
- CON: Tier-1 (app icon, adaptive icon, splash) is **mandatory for store submission** but not in this option — it remains un-dispatched.

---

## 3. Recommendation

**Dispatch Option A (telemetry-gate design-shape validation) as Phase 45, with Option C as a low-risk parallel pass.**

### Why Option A

The parked `ux-simplification` card explicitly says "telemetry-first" is the right re-scope approach. Skipping the telemetry step to dispatch Option B would violate the parked-card's own author (Belion, 2026-07-04) and undermine the audit-fabrication-prevention skill's discipline of acting on evidence. Option A costs nothing except waiting 2 weeks and produces a Phase 46 brief that won't get re-parked.

### Why pair Option A with Option C (asset polish) as a low-risk parallel

The asset work has zero design-system risk — Tier-2 assets are introduced as new components, not a refactor. Beru / Kaisel / Tusk can operate on the asset thread in parallel with the Phase 45 telemetry wait, and ship visual polish that helps the next round of beta testers / store-readiness regardless of whether UX-2 / UX-4 un-park later. Tier-1 assets (app icon + adaptive icon + splash) should be a separate Phase 47 if Option C lands successfully.

### Why NOT Option B alone

The parked-card author's own re-scope recommendation says "Do UX-3 (tab renames) LAST after the rest of the simplification lands". Phase 41's governance failures (3 false-positive audit claims caught, 1 push-scope violation disclosed) show the team's recent history is "re-litigating without enough signal". Option B would compound that. Phase 45 is the budget to step out of the loop and let PostHog decide.

### What I would dispatch for as Lyra

A single Belion-coordinated, two-track Phase 45:

- **Track 1 (Lyra-led):** re-read the parked UX card on schedule (30-day cadence). On 2026-07-21, read the PostHog dashboards (Phase 44.4 setup). Write a 1-page Phase 46 design-shape brief using telemetry data. Two-week effort at most.
- **Track 2 (Beru / Kaisel / Tusk):** Tier-2 illustration set per Option C. Three deliverables + visual-QA tests. Approximately 2-3 days.

No Igris work in Phase 45. LessonsScreen refactor (Phase 43 P2-2 PLANNED, ~4-6 hours) stays Phase 46+ as the parked card schedules.

---

## 4. Open follow-ups for Belion / Igris

- Confirm with Chris whether the 2-week telemetry wait is acceptable, OR if he wants to override Option A and dispatch Option B / Option C instead. Recommend Option A but don't auto-decide.
- If the wait is acceptable, schedule Track 2 (Tier-2 illustration) into a Phase 45 sub-work-card with Beru as WHAT-owner and Kaisel as HOW-owner. Tusk reviews after integration.
- If the wait is NOT acceptable, defer the parked UX card formally to Phase 46 with a date-stamped note on `ux-simplification-parked-2026-07-04.md` so we don't accidentally re-park-and-forget again.
