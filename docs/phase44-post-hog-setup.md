# Phase 44.4 — PostHog dashboard setup

**Time:** ~30 minutes.
**What you'll build:** Two PostHog dashboards that answer "is onboarding
working?" and "are users frustrated enough to reset?"

Both can be done entirely in the PostHog UI — no code changes needed
beyond what's already in `cfd9753` (Phase 44.2 wiring) and `a46436d`
(Phase 44.3 PostHog init).

---

## Pre-flight

1. Sign in to PostHog (US: https://us.posthog.com · EU: https://eu.posthog.com)
2. Select the project you created for Japanese Tutor
3. Confirm Live Events shows your test events from the smoke test

---

## Dashboard 1: Onboarding funnel

**Answers:** Where do users drop off in the 4-step onboarding?

### Steps

1. In the left sidebar, click **Insights** → **+ New insight**
2. Click **Funnels** (top of the screen)
3. Configure the funnel:

   | Step | Event | Filter (optional) |
   |---|---|---|
   | 1 | `onboarding_step_viewed` | `step == welcome` |
   | 2 | `onboarding_step_viewed` | `step == language` |
   | 3 | `onboarding_step_viewed` | `step == workplace-goal` |
   | 4 | `onboarding_step_viewed` | `step == daily-habit` |
   | 5 | `onboarding_completed` | — |
   | 6 | `tab_visited` | `initial == true` (the first visible tab after onboarding) |

4. **Conversion window:** leave at default (7 days) for now. After 2
   weeks of data, narrow to 1 day if your onboarding usually happens
   in one session.
5. **Breakdown:** none (you want the overall funnel first).
6. Click **Save** → name it "Onboarding funnel (Phase 44.4)".
7. Pin it to a dashboard: click **+ Add to dashboard** → **+ Create
   dashboard** → name it "Tutor — Onboarding & Retention".

### How to read it

PostHog will show you 6 bars, one per step. The drop between bar N
and bar N+1 is your drop-off at step N.

**Example interpretation:**
- 100% saw the welcome step
- 92% reached language → 8% closed the app before tapping Next
- 80% reached language → 12% dropped off at welcome-to-language
- 65% reached workplace-goal → 15% dropped at language-to-workplace
- 55% completed onboarding → 10% dropped at daily-habit-to-completion
- 54% reached the initial tab → 1% closed during completion persistence

The biggest single drop tells you where to focus first. If it's
welcome → language, your welcome screen is unclear. If it's daily-habit
→ completion, your daily habit question is too personal or too long.

---

## Dashboard 2: Reset-event alert

**Answers:** Are users resetting their progress more than expected?

### Step A — Create a trend insight

1. **Insights** → **+ New insight** → **Trends**
2. Event: `settings_reset_app`
3. Aggregation: **Unique users** (not total events — a single user can
   reset multiple times and we want to count people, not actions)
4. Date range: last 7 days
5. Interval: **Day**
6. Click **Save** → name it "Daily reset users (7d)"
7. Add to the "Tutor — Onboarding & Retention" dashboard.

### Step B — Set an alert

1. On the insight you just created, click the **⋯ menu** (top right of
   the insight) → **Set up alert**
2. **Trigger condition:** "Insight value exceeds"
3. **Threshold:** 5 (PostHog will alert when daily unique users who
   reset > 5). Adjust based on your user volume.
4. **Notification destination:** pick whatever you check daily (email,
   Slack, Discord, etc.)
5. Click **Save**

### What the alert means

- **Steady-state:** low baseline of resets (people experimenting).
- **Spike above threshold:** either (a) something broke and users are
  giving up, or (b) the app feels disposable. Either way, investigate.

---

## What to do with the data

### After 1 week

Open both dashboards. Note:
- Total users who completed onboarding vs dropped off
- Average reset rate per day

**Don't act yet.** One week isn't enough to call anything a trend.

### After 2 weeks

Compare week 1 vs week 2:
- Is funnel drop-off stable or shifting?
- Is reset rate climbing or stable?
- Which onboarding step has the worst drop-off?

Pick ONE thing to change. Implement it. Wait another 2 weeks.

### After 1 month

You should be able to answer:
- "What % of users complete onboarding?" (overall funnel conversion)
- "Which step is our biggest leak?" (per-step drop-off)
- "Are we losing users to frustration?" (reset rate trend)

If you can answer those three confidently, the dashboards have done
their job.

---

## What's deliberately NOT in this setup

- **Session replay** — disabled in our config. Skip.
- **Feature flags** — not needed yet. PostHog has them if you want
  A/B testing later.
- **Path analysis** — interesting but premature. Revisit after 1 month.
- **Cohorts based on lesson completion** — useful but requires more
  events than we have. Revisit in Phase 44.5+.

---

## Optional: Pin the dashboard to your phone

In the PostHog mobile app (iOS/Android), you can star a dashboard to
see it on your phone. Useful if you want to check funnel health
without opening a laptop.

---

## What comes next

After 2-4 weeks of data, we'll have real numbers. The Phase 44.5+
decisions will be:

1. **Drop a step if drop-off is severe** — code change, removes
   friction.
2. **Add an "are you sure you want to reset?" extra confirmation** if
   resets spike (different code path — `settings_reset_app` already
   records the source).
3. **Build lesson-level dashboards** if onboarding looks healthy and
   we want to dig into per-lesson engagement.

For now: build the dashboards, drive the app a few times to seed
data, and wait.
