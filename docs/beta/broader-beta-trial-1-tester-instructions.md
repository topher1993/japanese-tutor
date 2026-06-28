# Broader Beta Trial 1 — Tester Instructions

## Status
Ready for limited broader beta.

## Remote tester URL

Use this if the tester is **not in Chris's house / not on the same Wi-Fi**:

```text
exp://zujugea-anonymous-8081.exp.direct
```

This is the current Expo tunnel URL. It works across different networks while the tunnel server is running.

## Local same-Wi-Fi URL

Use this only if the tester is on the same local network as Chris's computer:

```text
exp://192.168.10.109:8081
```

## Required app

Use Expo Go with SDK 54 support.

## Important tunnel note

Expo tunnel URLs can change when the dev server restarts. If the remote URL stops working, ask Belion/Igris to restart tunnel mode and provide the new `exp.direct` URL.

## Trial size

Up to 5 testers for 3 days.

## Who should test first

1. Chris control device
2. 1-2 close testers
3. 2-3 additional learners/helpers

## What each tester should do

1. Install/open Expo Go.
2. Confirm Expo Go supports SDK 54.
3. Open the remote tunnel URL or scan the QR code Chris sends.
4. Complete or review onboarding.
5. Study one lesson or workplace survival phrase set.
6. Try one quiz interaction.
7. Open Progress/Stats.
8. Open Beta Feedback.
9. Save one simple feedback item or send one screenshot/note.

## What to report immediately

Send screenshot and short note immediately for:

- crash
- Expo SDK/runtime error
- screen that will not open
- text clipped or unreadable
- title/status-bar overlap
- bottom navigation blocking content
- incorrect Japanese/romaji/translation

## Feedback choices

Use the simple choices first:

- Report a problem
- Confusing / hard to use
- Translation or Japanese issue
- Suggestion / idea

Developer testers may open advanced details if they need to set severity/category manually.

## Internal feedback severity

### Blocker
Stops the tester from using the app.

### Important
The app works, but the issue should be fixed before a broader group tests.

### Minor
Nice-to-have polish or content suggestion.

## Feedback categories

- UI polish
- Content
- Device layout
- Learning flow
- Bug

## Exit gate

The trial can continue/expand only if:

- unresolved blockers: 0
- unresolved important issues: 2 or fewer
- at least 3 testers complete one study session
- all required screens are opened by at least one tester
- no SDK compatibility errors occur

## Required screens

- Onboarding
- Home
- Lessons
- Lessons → Workplace / Workplace Survival
- Lessons → Daily Conversation
- Lessons → Shopping
- Lessons → Safety / Emergency
- Lessons → Directions
- Lessons → Grammar Basics
- Flashcards
- Quiz
- Progress
- Beta Feedback
