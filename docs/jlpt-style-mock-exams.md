# JLPT-style mock exams

Japanese Tutor provides **unofficial JLPT-style practice** for N5, N4, and
N3. It is not affiliated with or endorsed by the Japan Foundation or Japan
Educational Exchanges and Services (JEES).

The feature reproduces the publicly documented section order, timing, item
families, and multiple-choice interaction. It does not claim to reproduce a
live JLPT administration, its exact question counts, or its scaled score.

## Published section timings

| Level | Vocabulary | Grammar / Reading | Listening |
|---|---:|---:|---:|
| N5 | 20 minutes | 40 minutes | 30 minutes |
| N4 | 25 minutes | 55 minutes | 35 minutes |
| N3 | 30 minutes | 70 minutes | 40 minutes |

Source: <https://www.jlpt.jp/e/guideline/testsections.html>

Full mock mode uses these section timers. Mini mode uses shorter,
app-defined timers and is always labeled as a mini mock.

## Learner flow

1. Choose N5, N4, or N3 and mini or full mode.
2. Read the timing, audio, background, and scoring rules.
3. Answer, revisit, and flag questions inside the active section.
4. Submit the section or let its timer expire. Submitted sections are locked.
5. Continue through the break screen to the next section.
6. Review raw accuracy, unanswered questions, time used, scoring groups, and
   item-type strengths after the complete attempt is submitted.

Strict mock timers continue while the app is backgrounded. The active attempt
is saved after answer, flag, navigation, and lifecycle changes. Resume restores
the exact question and option order. Practice timers may pause while the app is
backgrounded.

## Content and provenance

Exam questions are built only from app-approved content and original authored
exam material:

- JMdict supplies dictionary spellings, readings, meanings, and part-of-speech
  metadata for vocabulary questions and distractor validation.
- KANJIDIC2 supplies kanji readings and meanings used as source metadata.
- Japanese Tutor grammar lessons and connected example sentences provide
  reviewed curriculum context.
- Reading passages, listening scripts, question wording, explanations, and
  distractors are original Japanese Tutor material.
- Listening currently uses the device's Japanese text-to-speech voice and is
  labeled as TTS in the exam; it does not claim to be recorded official audio.
- Tatoeba rows are excluded unless the individual sentence ID, license, and
  attribution metadata are present and the row has passed review.

Curriculum N5/N4/N3 placement is an app editorial classification, not an
official JLPT vocabulary list. Every exam question carries a source reference,
content version, and review status. Candidate or review-needed content cannot
enter an assembled mock.

Official JLPT questions, leaked tests, official audio, logos, and visual trade
dress must never be copied into the app. The official copyright policy is at
<https://www.jlpt.jp/e/policy.html>.

## Scoring boundary

Results report raw practice accuracy and diagnostic breakdowns. The official
JLPT uses scaled scores derived from response patterns, so a local raw score is
not an official 0–180 score and cannot guarantee a pass. Published official
scoring information is available at:

- <https://www.jlpt.jp/e/guideline/results.html>
- <https://www.jlpt.jp/e/about/pdf/scaledscore_e.pdf>

Any future readiness estimate must be calibrated on Japanese Tutor attempt
data, versioned, and visibly labeled as an internal unofficial estimate.

## Engineering invariants

- Blueprint and content versions are pinned into every attempt.
- Assembly is deterministic for a saved seed and contains no duplicate IDs.
- Exact question and option ordering survives a cold start.
- Deadlines use absolute timestamps; UI intervals are display-only.
- Timeout submission and normal submission are idempotent.
- Completed attempts are immutable and added to history once.
- Exam answers do not mutate SRS or mastery state before completion.
- Analytics contain level, mode, counts, duration, and completion reason only;
  question text and learner answers are never sent.
- Audio failures remain recoverable and are distinguished from an unanswered
  question.
- Screen-reader labels expose selected, flagged, answered, and timer states
  without announcing every timer tick.

## Release validation

Before promoting a content version:

1. Validate every blueprint quota against its approved question pool.
2. Validate three/four unique choices and one valid correct choice.
3. Review ambiguity, level placement, Japanese naturalness, and explanations.
4. Verify provenance and reject copied or unattributed material.
5. Test deterministic assembly, timers, background/resume, section locks,
   corrupt-save recovery, audio policy, idempotent submission, and reset.
6. Run typecheck, targeted JLPT tests, the full test suite, and a physical
   device listening/timer smoke test.
