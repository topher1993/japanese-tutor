# Phase 44.3 smoke test — live PostHog verification

**Goal:** Confirm that real events actually flow from the app to your
PostHog dashboard. Everything up to this point has been unit tests + code
review; this is the first end-to-end verification.

**Time:** ~10 minutes.

## Pre-flight (1 min)

In `C:\Users\tophe\japanese-tutor-mobile-app\.env`, confirm the key is
still set. First 8 + last 4 only:

```bash
cd "C:/Users/tophe/japanese-tutor-mobile-app"
head -c 8 .env && echo "..." && tail -c 4 .env
```

Should show `EXPO_PUB...e4i` (or whatever the last 4 chars of your key are).

## Step 1 — Start the app in browser (2 min)

```bash
cd "C:/Users/tophe/japanese-tutor-mobile-app"
npm run web
```

Wait for Metro to bundle and a browser tab to open at
http://localhost:8081 (or similar). First load takes 30-60 seconds.

## Step 2 — Open PostHog Live Events (1 min)

In a separate browser tab:

- US cloud: https://us.i.posthog.com/activity/live
- EU cloud: https://eu.i.posthog.com/activity/live

Make sure the right project is selected in the top-left dropdown.

## Step 3 — Drive the app (3 min)

In the app tab, do these in order:

1. Wait for the app to finish loading (you should see onboarding OR the
   Home tab if you've onboarded before).
2. Switch tabs: Home → Lessons → Flashcards → Progress → Home
3. Open any lesson and tap "Mark complete" if it's not already done
4. Open Settings → tap "Reset all progress" → confirm

## Step 4 — Verify in PostHog (2 min)

Within ~30 seconds, you should see these events appear in the Live Events
feed (most recent first):

| Event | When it fires |
|---|---|
| `tab_visited` (initial: true) | App loaded |
| `tab_visited` | Every tab switch you did |
| `lesson_opened` | When you opened the lesson detail |
| `lesson_mark_complete_attempt` | When you tapped Mark complete |
| `lesson_mark_complete_success` OR `..._failure` | After the mark-complete resolved |
| `settings_reset_app` | When you confirmed the reset |

If you see **at least 5 of these 7** within 30 seconds, the smoke test
passes.

## What "pass" looks like

- Events arrive within 30s (PostHog batches)
- Each event has a `$lib` property of `posthog-react-native`
- Each event has `distinct_id` set (looks like a UUID)
- The `tab_visited` events have a `tab` property with values like
  `"Home"`, `"Lessons"`, `"Flashcards"`, `"Progress"`

## What "fail" looks like + how to debug

### Symptom: no events after 1 minute

1. Check the browser console (F12 → Console tab) for these:
   - `[analytics] tab_visited` → confirms track() is firing locally
   - `[analyticsBackend] PostHog init failed` → confirms backend init
     error (paste the error)
2. Verify the dev debug card in Settings is GONE — that confirms
   `isAnalyticsEnabled()` is true.
3. Check `node_modules/posthog-react-native/package.json` version
   matches `package.json` (should both be 4.54.4).

### Symptom: events arrive but `distinct_id` is missing or wrong

This is OK for now — PostHog auto-assigns one. The `installId.ts` UUID
will get bridged in a later phase if needed.

### Symptom: events arrive but PII leaked through (e.g. your email
appears in props)

STOP. This is a regression of the Phase 44.2 PII scrubber.
Tell me immediately and I'll fix scrubPii.

## After you verify

Come back and tell me:

- **PASS** with: total events seen + first 3 event names in order
- **FAIL** with: what you saw + what you expected + any console errors

I'll use that to either confirm Phase 44 is fully done, or diagnose
what's broken.