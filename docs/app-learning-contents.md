# Japanese Tutor — Learning Content Reference

> Verified from the live TypeScript services on 2026-07-15 by importing the
> runtime modules through Vite SSR. Counts below describe the app's runtime
> output, not a raw file-line count. Placement-dependent pools are called out
> explicitly.

## Catalog summary

| Runtime pool | Count | Authoritative source |
|---|---:|---|
| Phrase curriculum | 38 lessons / 210 items | `getPhraseLessons()` |
| Grammar curriculum | 61 lessons / 159 items | `getGrammarLessons()` |
| Full de-duplicated course catalog | 99 lessons / 369 items | `getAllCourseLessons()` |
| Workplace Survival | 100 phrases / 14 categories | `workplaceSurvivalService.ts` |
| Additional topic packs | 100 phrases / 5 packs | `additionalLessonContentService.ts` |
| Maximum base flashcard pool | 549 cards | 369 course items + 180 supplemental cards |
| Approved candidate vocabulary | 2,315 cards | N5 584 + N4 731 + N3 1,000 |
| Review Mode | 1,315 items | N5/N4 candidate vocabulary only |
| Authored quiz bank | 366 questions | 15 starter + 351 app-ready candidates |
| Placement test | 15 questions | 5 each for N5, N4, and N3 |
| Kanji section | 905 visible cards | merged and de-duplicated base + candidates |
| Example-sentence reference | 235 entries | connected, in-app lesson examples only |
| Sentence Lab eligible | 125 entries | validated subset of the 235-entry app-facing pool |

## Lessons

The Lessons screen has separate Phrase and Grammar tracks. The full catalog is
the de-duplicated union of both tracks.

### Phrase track

| Level | Lessons | Items | Authoring weeks |
|---|---:|---:|---|
| Absolute Beginner | 8 | 32 | 1 |
| N5 | 18 | 110 | 1–3 |
| N4 | 8 | 48 | 6 |
| N3 | 4 | 20 | 7 |
| **Total** | **38** | **210** | |

Placement chooses a starting level and the normal path continues upward:

| Placement | Forward phrase path | Lessons | Items |
|---|---|---:|---:|
| Unplaced or N5 | N5 → N4 → N3 | 30 | 178 |
| Absolute Beginner | Foundation → N5 → N4 → N3 | 38 | 210 |
| N4 | N4 → N3 | 12 | 68 |
| N3 or N3+ | N3 | 4 | 20 |

Selecting a level chip in Lessons is an explicit single-level review view; it
does not change the saved placement.

### Grammar track

| Level | Lessons | Items | Authoring weeks |
|---|---:|---:|---|
| N5 | 32 | 64 | 1–5 |
| N4 | 28 | 90 | 4–8 |
| N3 | 1 | 5 | 7 |
| **Total** | **61** | **159** | |

Learner-facing course categories currently populated by these tracks are
`workplace`, `safety`, `daily-life`, `emergency`, and `grammar`. Lesson items
carry Japanese, romaji, English, Vietnamese, Filipino, examples, vocabulary
taxonomy, and translation-review metadata.

## Topic phrase packs

Workplace Survival contains 100 phrases, including 12 marked emergency
priority.

| Workplace category | Phrases |
|---|---:|
| greetings | 4 |
| help | 5 |
| safety | 6 |
| schedule | 5 |
| tools | 5 |
| breaks | 3 |
| absence | 3 |
| health | 4 |
| directions | 5 |
| polite | 4 |
| emergency | 6 |
| meetings | 20 |
| phone | 15 |
| office | 15 |

Lessons also exposes five additional topic packs totaling 100 phrases: Daily
Conversation, Shopping, Safety / Emergency, Directions, and Grammar Basics.

## Flashcards and Daily Rush

Every base deck contains the 180 supplemental flashcards plus course-item
cards from the learner's level-forward full curriculum. Candidate vocabulary
is then added according to placement.

| Placement | Base cards | Candidate cards included | Total deck |
|---|---:|---|---:|
| Absolute Beginner | 549 | none | 549 |
| Unplaced or N5 | 517 | 584 N5 | 1,101 |
| N4 | 343 | 584 N5 + 731 N4 | 1,658 |
| N3 or N3+ | 205 | 584 N5 + 731 N4 + 1,000 N3 | 2,520 |

Flashcards use the persistent spaced-repetition scheduler. Daily Rush draws
from the same placement-aware deck, creates up to 10 distinct cards per run,
and awards progression XP only for the first completed run on a local calendar
day. Later same-day runs remain available as practice.

Review Mode is a separate candidate-vocabulary quiz pool:

- N5: 584 items.
- N4: N5 + N4, 1,315 items.
- All: 1,315 items.
- N3 candidate vocabulary is not currently exposed in Review Mode.

## Quiz and placement

The authored multiple-choice bank contains 366 runtime-valid questions:

- 15 starter workplace questions.
- 351 candidate questions marked `approved-for-beta`.
- Every approved candidate currently has exactly four unique choices and a
  valid correct-choice id; the adapter enforces this contract before loading.

The Test screen builds a default 10-question practice session. Depending on
the selected mode and source, it combines authored choices, grammar-derived
choices, listening questions, sentence builders, and 12 authored fill-blank
seeds. Consequently, 366 is the static authored multiple-choice bank—not the
number of all possible generated practice exercises.

The placement test is separate: 15 questions, with five each for N5, N4, and
N3. Its result selects the learner's starting level.

## JLPT-style mock exams

The Test tab also offers an unofficial N5/N4/N3 mock-exam flow without
replacing the existing 10-question quick practice:

- Mini mocks contain 14 questions at N5, 15 at N4, and 17 at N3.
- Full mocks contain 36 questions at N5, 40 at N4, and 43 at N3.
- Full timers follow the public section durations; mini timers are shorter
  app-defined practice sessions.
- Strict timers continue in the background. Practice timers pause there.
- Attempts, exact question/choice order, and a bounded result history persist
  locally; Reset all progress clears both attempts and history.

The candidate bank connects all 688 approved source-backed JMdict verbs: 56
N5, 131 N4, and 501 N3. Each N5 verb generates four supported vocabulary task
variants, while each N4/N3 verb generates five, for 3,384 verb-backed exam
candidates before deterministic mock assembly. Grammar lessons, KANJIDIC2
readings, connected reviewed example sentences, and original app-authored
reading/listening material supply the remaining item families. This is app
editorial level placement and raw practice scoring, not an official JLPT list,
scaled score, or pass prediction. See [JLPT-style mock exams](jlpt-style-mock-exams.md).

## Kanji

- 30 base cards.
- 936 candidate cards: 78 N5 and 858 N4.
- 905 visible after merge/de-duplication: 84 N5 and 821 N4.

Visible cards contain one kanji character, meanings, on/kun readings, and
example words. The section supports N5/N4 filters, previous/next/skip
navigation, and Jisho links.

## Example sentences and Sentence Lab

- 300 candidate examples remain in the repository as disconnected staging
  data. They are not exposed because they do not yet carry the per-sentence
  provenance needed by the Tatoeba import policy.
- 235 connected examples adapted from the lesson fixture are shown by the
  Example Sentences screen.
- 125 connected examples pass Sentence Lab's review, Japanese/romaji/English,
  and tokenization eligibility checks.
- 69 of those eligible examples are non-grammar entries available to
  phrase-sourced Quiz listening and sentence-builder questions. Quiz uses the
  same app-facing selector, so disconnected staging candidates cannot enter
  those pools either.

Sentence Lab produces listening-meaning and romaji sentence-order exercises.
Misses enter a persistent Mistake Notebook and use the same scheduling model
without inflating the flashcard due count.

## Editorial review state

The translation-review service aggregates 749 source entries:

- 369 full-course lesson items.
- 100 Workplace Survival phrases.
- 100 additional-topic phrases.
- 180 supplemental flashcards.

The repository's static metadata currently labels 749 entries approved and 0
draft. This is an internal workflow flag, not evidence of independent human
translation review; the verification scope and remaining limitations are
documented in [translation-verification.md](translation-verification.md).
Reviewer overrides are stored per device/browser, so an individual
installation can have a different effective status count.

One internal-beta pack is defined: five N5 workplace lessons, eight Workplace
Survival categories, and one quiz.

## Persistence and account model

- Native: profile, learning progress, weekly state, and SRS data persist in
  SQLite.
- Web: versioned localStorage snapshots persist profile, learning progress,
  weekly state, SRS data, and JLPT-style mock attempts/history across reloads.
- Native JLPT-style mock attempts/history use the shared SQLite-backed key/value
  store and resume with the original deterministic seed and option order.
- In-memory repositories are fallback/test implementations when durable
  storage cannot initialize.
- The legacy onboarding preference is migrated into the single profile and
  then removed.
- There is no login, server account, cloud sync, or multi-profile support.

## Runtime source map

- `src/services/lessonService.ts`
- `src/services/placementPathService.ts`
- `src/data/absoluteBeginnerLessons.ts`
- `src/data/grammarLessons.ts`
- `src/data/mockSenseiLessons.ts`
- `src/services/workplaceSurvivalService.ts`
- `src/services/additionalLessonContentService.ts`
- `src/services/flashcardService.ts`
- `src/services/candidateFlashcardAdapter.ts`
- `src/services/reviewModeService.ts`
- `src/services/quizService.ts`
- `src/services/quizPracticeService.ts`
- `src/services/jlptExamContentService.ts`
- `src/services/jlptExamAssembler.ts`
- `src/services/jlptExamSessionService.ts`
- `src/repositories/jlptExamAttemptRepository.ts`
- `src/services/candidateQuizAdapter.ts`
- `src/services/kanjiSectionService.ts`
- `src/services/candidateKanjiAdapter.ts`
- `src/data/candidates/exampleSentenceCandidatePack.ts`
- `src/services/sentenceLabService.ts`
- `src/services/senseiReviewService.ts`
- `src/services/learningContext.tsx`
