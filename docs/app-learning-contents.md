# Japanese Tutor — Learning Contents Reference

> Source of truth: the live app services verified at runtime on 2026-06-29.
> All counts in this document were measured by importing the actual app code
> (lesson service, flashcard service, candidate adapters, profile service) and
> reading the candidate packs directly.

## 1. Top-level summary

| Pool | Visible to learner | Approved for beta | Source |
|---|---|---|---|
| Lessons | 36 | 36 | `src/data/mockSenseiLessons.ts` |
| Lesson phrases (items) | 210 | 210 | `src/data/mockSenseiLessons.ts` |
| Lesson weeks | 6 | 6 | `src/data/mockSenseiLessons.ts` |
| Sensei lesson categories | 6 | 6 | `src/services/lessonService.ts` |
| Workplace survival phrases | 100 | 100 | `src/data/workplaceSurvivalPhrases.ts` |
| Workplace survival categories | 14 | 14 | `src/data/workplaceSurvivalPhrases.ts` |
| Workplace emergency-priority phrases | 12 | 12 | `src/data/workplaceSurvivalPhrases.ts` |
| Flashcards (base lesson) | 390 | 390 | `src/services/flashcardService.ts` |
| Flashcards (candidate vocab loaded) | 1,130 | 1,130 | `src/services/candidateFlashcardAdapter.ts` |
| Flashcards (total in deck) | 1,520 | 1,520 | combined |
| Review Mode pool | 1,130 | 1,130 | `src/services/candidateReviewAdapter.ts` |
| Quiz/Test active question pool | 366 | 366 | `src/services/quizService.ts` |
| Quiz candidate questions (approved) | 351 | 351 | `src/data/candidates/quizQuestionCandidateData.ts` |
| Kanji section merged visible | 905 | 905 | `src/services/kanjiSectionService.ts` + `candidateKanjiAdapter.ts` |
| Example sentences (reference) | 300 | 300 | `src/data/candidates/exampleSentenceCandidateData.ts` |

## 2. Lessons (Sensei)

- 36 lessons total
- 18 N5 lessons
- 18 N4 lessons
- 0 Beginner lessons
- 210 lesson phrases (items) total
- 6 weeks
- 6 sensei lesson categories
- Each lesson item has: id, japanese, romaji, english, vietnamese, filipino, category, exampleJapanese, exampleEnglish, translationReviewStatus

Sensei lesson categories

- workplace
- safety
- daily-life
- hr
- emergency
- grammar

Per-week lesson distribution

- Week 1: 6 lessons
- Week 2: 6 lessons
- Week 3: 6 lessons
- Week 4: 6 lessons
- Week 5: 6 lessons
- Week 6: 6 lessons

## 3. Workplace Survival

- 100 phrases total
- 12 emergency-priority phrases
- 14 categories

Phrases per category (live verified)

| Category | Phrases |
|---|---|
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

Each phrase has: id, japanese, romaji, english, vietnamese, filipino, categoryId, priority, usageNote, jlptLevel.

## 4. Flashcards

- 390 base lesson flashcards
- 1,130 approved candidate flashcards
- 1,520 total in deck
- 529 N5 candidate vocab
- 601 N4 candidate vocab
- Each card has: id, japanese, romaji, english, vietnamese, filipino, level, due/nextReviewDate for SRS, support language translation

## 5. Daily Flashcard Rush

- 10 cards per day
- Once-per-day XP cap (same-day reruns are practice-only and award 0 XP)
- Loads the full flashcard pool (base lesson + approved candidate vocab)
- Saves persistent stats to the user profile
  - totalRuns
  - totalGood
  - totalAgain
  - totalXpEarned
  - lastCompletedDate
  - lastSummary

## 6. Review Mode

- 1,130 review items
- 529 N5 review items
- 601 N4 review items
- Level filter: N5 uses N5 only, N4 includes N5+N4, "All" uses full pool
- Each item has: id, prompt, 4 choices, correctIndex, jlptLevel, category

## 7. Test / Quiz

- 366 active quiz questions
- 15 base starter questions
- 351 approved candidate quiz questions
- Categories in the candidate quiz pool: meaning, numbers, kana, grammar, vocabulary, workplace
- Each question has: id, prompt, 4 choices, correctChoice, explanation

## 8. Kanji section

- 905 deduped visible cards after merging base + candidate
- 84 N5 visible
- 821 N4 visible
- 30 base kanji
- 936 candidate kanji (single-character only)
  - 78 N5 candidate
  - 858 N4 candidate
- Each card has: id, kanji, meanings, readings (on/kun), jlptLevel, exampleWords
- On-tap examples, Jisho corner badge, prev/next/skip nav

## 9. Example sentences

- 300 reference sentences
- 300 approved for beta
- Visible in Lessons → More tools → Example sentences
- Status: visible reference material, not yet integrated into practice/SRS

## 10. Onboarding and user profile

Editable in the Profile screen and onboarding screen

- supportLanguage: en | vi | tl
- studyGoal: daily-conversation | workplace-survival | jlpt-prep | travel-basics
- jlptTarget: N5 | N4 | N3 | N2 | N1
- dailyStudyMinutes: 2 | 5 | 10 | 15 | 30
- workplace (only when studyGoal = workplace-survival)
  - industry (text, capped at 40 chars)
  - role (text, capped at 40 chars)
  - commonSituations (array, capped at 5 entries)

Dynamic state (mutated by app usage)

- xp
- streak (currentStreak, longestStreak)
- dailyRush (see section 5)
- lastStudyActivityAt

Default profile on fresh install

- onboarded: false
- supportLanguage: en
- studyGoal: daily-conversation
- jlptTarget: N5
- dailyStudyMinutes: 10
- xp: 0
- streak: { currentStreak: 0, longestStreak: 0 }
- dailyRush: all zeros

Storage

- Primary: SQLite row in `user_profile` table (single row keyed `primary`, JSON value)
- Fallback: in-memory repository for web and tests
- Legacy: `onboarding-preference:v1` key in `kv_preferences` migrates into the profile on first load, then is deleted

## 11. Translation review pipeline

- 594 phrases tracked in the translation review pipeline
- 214 approved translations
- 380 draft translations
- 5 internal beta content packs
- Each candidate entry has a review status of: candidate | sensei-review-needed | approved-for-beta | rejected

## 12. Tabs and entry points

- Home
  - Today's plan
  - Start Daily Flashcard Rush
  - Open Progress / Profile / Settings
- Lessons
  - Week-by-week list
  - Sensei categories
  - Kanji section (More tools)
  - Example sentences (More tools)
  - Workplace Survival (Lessons → workplace category)
- Kanji section
  - N5 / N4 level toggle
  - Card-by-card navigation with swipe
  - Jisho corner badge
- Practice
  - Flashcards
- Test
  - Quiz session
  - Review Mode (Switch to Review Mode)
- Progress
  - Today's plan
  - Your level
  - Achievements
  - JLPT levels
  - More tools
    - Edit learner profile
    - Settings
    - Sources
    - Feedback
- Settings
  - Reset (clears progress, profile, SRS)
- Profile
  - Edit support language, study goal, daily study target, JLPT target, workplace info
  - XP, level, badge progress, recent study history, next milestone
  - Daily Rush stats

## 13. Auth and accounts

- None. The app has no login, no account, no server, no auth provider.
- Profile is a single local row, no multi-account, no cloud sync.

## 14. Source files

- `src/data/mockSenseiLessons.ts`
- `src/data/workplaceSurvivalPhrases.ts`
- `src/data/candidates/n5VocabularyCandidateData.ts`
- `src/data/candidates/n4VocabularyCandidateData.ts`
- `src/data/candidates/n5KanjiCandidateData.ts`
- `src/data/candidates/n4KanjiCandidateData.ts`
- `src/data/candidates/quizQuestionCandidateData.ts`
- `src/data/candidates/exampleSentenceCandidateData.ts`
- `src/services/lessonService.ts`
- `src/services/flashcardService.ts`
- `src/services/quizService.ts`
- `src/services/reviewModeService.ts`
- `src/services/dailyFlashcardRushService.ts`
- `src/services/kanjiSectionService.ts`
- `src/services/candidateFlashcardAdapter.ts`
- `src/services/candidateKanjiAdapter.ts`
- `src/services/candidateReviewAdapter.ts`
- `src/services/candidateQuizAdapter.ts`
- `src/services/workplaceSurvivalService.ts`
- `src/services/userProfileService.ts`
- `src/repositories/userProfileRepository.ts`
- `src/db/schema.ts`
- `src/types/userProfile.ts`
