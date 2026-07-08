# JT Tier-2 Illustration Pedagogy Pick-List (v1)
Work-card: 2026-07-07_jt-tier2-illustration · Track 2 of Phase 45 · Beru · for Lyra → Kaisel → Clix → Tusk → Igris
Ground truth: 4 onboarding steps (OnboardingScreen.tsx lines 18, 117), 5 EmptyStateService surfaces (emptyStateService.ts:1), profileProgressionService badge rules (line 67–73).

## SET 1 — Onboarding (3 panels, 320×480 SVG, flat)
Skips Step 2 (language) per source — chip tap, no illustration hook.

- Panel A — Welcome (Step 1). Pedagogical moment: "first contact, lower the stakes." Scene: a calm desk scene, soft daylight, a laptop with a single hiragana character on screen, a coffee mug — the learner is at work, not in a classroom. Tone: **welcoming-only** (light, brand). Why it matters: working professionals self-select out of anything that feels like school; the workplace desk is the reassurance cue for a 30-second "I can do this here."
- Panel B — Workplace goal (Step 3). Pedagogical moment: "name the real reason you opened this app." Scene: the same workplace desk, but now a Japanese phrase on a sticky note next to the laptop and a colleague across the table mid-conversation — the goal is visibly external (used with people), not just learned. Tone: **decisional** (warmer, more weight). Why it matters: anchoring to a live social use case ("talk to a coworker") raises post-onboarding lesson completion; abstract goals decay.
- Panel C — Daily habit (Step 4). Pedagogical moment: "commit a calendar slot, not a willpower pledge." Scene: the workplace desk at evening, a calendar / planner page opened, a single ~10-min block circled, a small lantern or warm-light motif — intimate, evening. Tone: **decisional** (warmer, more weight; carries a softer "I made room for this" feeling, distinct from Panel B's social weight). Why it matters: time-boxing a specific 10-min window is the single highest-leverage habit predictor for working learners; the panel visualizes the slot, not the streak.

## SET 2 — Empty-state illustrations (6 screens, 240×240 SVG)
Three are already-wired component slots (home/lessons/progress per EmptyStateArt.tsx:8); flashcard/quiz/survival extend the EmptyStateService surface. Copy lifts emptyStateService.ts body lines where present; new copy stays in the same "let's fill this" register.

- Home. Intent: "your day is starting, choose where to begin." Scene: an open doorway with three labelled rooms labelled-less, just enough architecture to invite entry. Tone: encouraging. Copy suggestion: "Pick where to start — first lesson is on us."
- Lessons. Intent: "the bookshelf is empty, not the mind." Scene: a small empty bookshelf with a single hiragana-block on the bottom shelf, ladder leaning against it — scaffolding, not barren. Tone: encouraging. Copy: lifts "No lesson started yet — Start with one workplace phrase lesson today." (emptyStateService.ts:4).
- Flashcards. Intent: "nothing to review yet because nothing has been learned." Scene: a fresh stack of blank cards fanned on a table, pen resting — the cue is "go learn first," not "you failed." Tone: encouraging. Copy: lifts "No flashcards due — Complete a lesson to unlock review flashcards." (emptyStateService.ts:5).
- Progress. Intent: "the first chart point is missing; first lesson will draw it." Scene: a notepad graph with one empty X-axis and a small pencil hovering — the empty space is the start, not the end. Tone: encouraging. Copy: lifts "No progress yet — Your streak starts after your first lesson." (emptyStateService.ts:6).
- Quiz. Intent: "fresh quiz tray, no questions queued." Scene: a clipboard with a blank answer sheet and a small mascot peeking over the top — playful, not clinical. Tone: encouraging. Copy: lifts "No quiz selected — Try a quick quiz after reviewing today's phrases." (emptyStateService.ts:7).
- Survival. Intent: "pick the situation, the phrase will come." Scene: a small landscape with four signposts (safety, help, schedule, emergency) pointing in different directions — the user chooses the destination. Tone: encouraging. Copy: lifts "Choose a survival topic — Pick safety, help, schedule, or emergency phrases." (emptyStateService.ts:8).

## SET 3 — Streak / JLPT badges (4 PNG, 96×96)
Keeps existing `seven-day-streak` semantics (currentStreak ≥ 7, profileProgressionService:69). N4 already in tree at completed.size ≥ 5; N3/N5 are new.

- 7-day Streak — `streak7`. Locked milestone language: **"Week One Scholar"** — chosen over "First Seven Days" because the frame is identity (a scholar after one week), not elapsed time. Visual cue (for Lyra reference only, not pedagogical lock): flame motif (already in source via StreakFlame.tsx).
- N5 — `jlptN5`. Unlocks at: **first completed lesson set covering all five N5 workplace-phrase tracks (greetings / floor / schedule / safety / polite-forms).** Rationale: per-track completion guarantees breadth across the actual work scenarios, not just volume on one track.
- N4 — `jlptN4`. Unlocks at: **completion of all N5 workplace-phrase tracks AND ≥ 5 total lessons completed** (extends the existing profileProgressionService `n4-unlocked` rule at line 72 by adding the N5-breadth gate). Rationale: N4 represents "I can sustain cross-track conversation," which needs both breadth and volume.
- N3 — `jlptN3`. Unlocks at: **every N4 badge earned plus completion of the weekly-review feature for four consecutive weeks.** Rationale: N3 sits above the content library surface ("can keep up at work"), so the gate moves off the badge tree and into a behaviour signal — consistent review cadence — not just lesson counts.
