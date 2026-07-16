# Personalized Mastery System 1.0

The mastery system sits above SRS. SRS decides **when** a card should return;
mastery explains **what the learner can currently do** with that item.

## Learner-visible model

Each item has four independent scores from 0–100:

- Recognition — recalling meaning during Flashcards and Daily Rush.
- Reading — connecting Japanese writing or kana to the intended reading.
- Listening — identifying an item after hearing it.
- Production — saying or reconstructing the Japanese independently.

The weighted overall score uses recognition 40%, reading 25%, listening 20%,
and production 15%. Scores produce four states: New, Learning, Familiar, and
Mastered. Mastered requires broad evidence rather than recognition alone.

The Progress screen aggregates items by nouns, verbs, adjectives, phrases and
expressions, and content topic. Learners can start a filtered Flashcards session
from any word-group row or one of the three weakest topics. A daily compact
snapshot provides the seven-day change shown on the map.

## Evidence and persistence

Evidence is normalized to 0–1 and recorded by Flashcards, Daily Rush,
listening, shadowing, and Sentence Lab. It is stored inside the existing
schema-versioned progress blob, capped at 5,000 entries. Daily snapshots are
capped at 60. Older progress blobs omit these optional fields and remain valid.

## Scheduling and progression

Adaptive Daily Plan 2.0 uses the weakest evidence-backed mastery group and its
weakest modality when selecting and explaining practice. New learners retain
the prior SRS fallback until mastery evidence exists.

Course progression uses a conservative prerequisite gate. It does not activate
until at least five distinct items have evidence and a mastery snapshot exists.
After activation, overall mastery below 35% prevents the next week from opening
even if its weekly todos are complete. The UI explains the score and sends the
learner to focused practice. This avoids false locks during onboarding or after
migration.

## Analytics and privacy

`mastery_focus_opened` records only the selected group or topic, aggregate
score, and weakest modality. Japanese text, translations, names, and other PII
are not included.
