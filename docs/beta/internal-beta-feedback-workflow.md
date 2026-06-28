# Internal Beta Feedback Workflow

## Status
Updated in Phase 13.

## Principle
Feedback remains local-only inside the app. The app does not submit tester notes to a backend or network service.

## How testers submit feedback

1. Open the app in Expo Go.
2. Go to `Stats`.
3. Tap `Open beta feedback`.
4. Choose the simple feedback type:
   - `Report a problem`
   - `Confusing / hard to use`
   - `Translation or Japanese issue`
   - `Suggestion / idea`
5. Choose the screen being reviewed.
6. Add a short note.
7. Optionally choose rating from 1–5.
8. Tap `Save local feedback`.
9. Send screenshot(s) or copied notes to Chris/Belion manually.

Developer testers can open `Advanced details for developer testers` if they need to override severity or category manually.

## Simple feedback mapping

The app maps simple tester choices into internal triage automatically:

- `Report a problem` → Bug; Blocker if it stopped app use, otherwise Important.
- `Confusing / hard to use` → Learning flow; Important.
- `Translation or Japanese issue` → Content; Important.
- `Suggestion / idea` → UI polish; Minor.

## Internal severity guide

### Blocker
Use when the app cannot be used or beta must stop.

Examples:

- app crashes
- lesson cannot open
- major text is unreadable
- navigation is blocked
- saved data disappears unexpectedly

### Important
Use when the app works but should be fixed before broad beta.

Examples:

- screen title is too close to phone status bar
- layout is crowded on a real device
- quiz feedback is confusing
- a primary workflow takes too many taps

### Minor
Use for polish or nice-to-have improvements.

Examples:

- wording preference
- color/spacing could be better
- add more encouragement text
- a non-blocking content suggestion

## Category guide

### UI polish
Spacing, color, readability, card layout, button shape, visual hierarchy.

### Content
Japanese, romaji, translations, missing workplace phrase, lesson explanation.

### Device layout
Phone-specific status bar, bottom navigation, clipping, viewport, Android/iOS layout.

### Learning flow
Confusing lesson order, quiz flow, progress/streak clarity, practice flow.

### Bug
Crash, broken button, runtime error, bad save/load behavior.

## Triage order

1. Blockers first.
2. Important device-layout or bug reports second.
3. Learning-flow issues third.
4. Content expansion fourth.
5. Minor UI polish last.

## Current app behavior
The Beta Feedback screen now shows a local Polish Queue summary:

```text
Blockers: N
Important: N
Minor: N
```

It also gives a next-action recommendation based on the queue.
