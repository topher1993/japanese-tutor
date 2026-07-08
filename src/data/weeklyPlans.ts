import type { WeekPlan } from '../types/weeklyTodo';
import { mockSenseiLessons } from './mockSenseiLessons';

// Phase 37b ships ONLY the N5 week 1 plan, with exactly one `lesson`-kind
// todo. Authored by hand per docs/phase-37-todo-gated-progression-proposal.md
// §8 phase-37b step 2. The `lessonIds` are looked up from the actual lesson
// data module — never invented — so the gate verifier can cross-check against
// getAllLessons() at runtime.

const N5_WEEK_1_LESSON_IDS = mockSenseiLessons
  .filter(lesson => lesson.level === 'N5' && lesson.week === 1)
  .map(lesson => lesson.id);

export const WEEKLY_PLANS: WeekPlan[] = [
  {
    weekNumber: 1,
    passingStrategy: 'all',
    todos: [
      {
        id: 'n5-w1-lessons',
        kind: 'lesson',
        title: 'Complete every Week 1 lesson',
        // §11.2: target = lessonIds.length (every listed lesson complete).
        target: N5_WEEK_1_LESSON_IDS.length,
        unit: 'lessons',
        lessonIds: [...N5_WEEK_1_LESSON_IDS],
      },
      // Phase 37d-1: a daily-rush todo so end-to-end recompute can be
      // exercised against a real todo of this kind. Inactive while
      // todoFeatureEnabled stays false (37g flip); even when the gate UI
      // appears in 37c, adding this todo does not change learner-visible
      // behavior — the current lesson todo is still the gate.
      {
        id: 'n5-w1-daily-rush',
        kind: 'daily-rush',
        title: 'Complete one Daily Flashcard Rush',
        // §5 row `daily-rush`: target = 1. The recompute helper flips this
        // todo to progress=1 once any date appears in
        // todoEventCounts.dailyRushDates[1].
        target: 1,
        unit: 'rush',
      },
      // Phase 37d-2: a flashcards todo so the new `recordFlashcardReview`
      // store method can be exercised end-to-end against a real plan
      // (proposal §5 row 'flashcards', §11.2 default pool='week'). The
      // resolver counts the size of `createFlashcardDeck(week-1 lessons)`
      // and stores it as `target`. Inactive while todoFeatureEnabled is
      // false (37g flip); the gate UI in 37c reads this alongside the
      // lesson and daily-rush todos but learner-visible behavior is
      // unchanged because canAdvance still requires every todo complete.
      {
        id: 'n5-w1-flashcards',
        kind: 'flashcards',
        title: 'Review every Week 1 flashcard',
        pool: 'week',
        // The resolver fills expectedTarget when the todo's own target is 0;
        // we leave it at 0 so resolveCardPool drives the count.
        target: 0,
        unit: 'cards',
      },
      // Phase 48 — N5 week 1: add the 3 remaining todo kinds so the
      // weekly todo board exercises every wired CTA. Each new todo's
      // `target` and per-kind config is derived from the existing data
      // layer (kanji card ids, example-sentence ids) — no invented ids.
      //
      // passThreshold (70%) is the binary completion rule for `quiz`
      // (see practiceProgressStore.ts:668). target=1 makes the
      // "passes once" semantics explicit; a learner who scores >= 70%
      // once completes the todo.
      {
        id: 'n5-w1-quiz',
        kind: 'quiz',
        title: 'Pass a Week 1 quiz with 70% or better',
        // §11.2 default: target=1. The store flips this to progress=1
        // when best score >= passThreshold (70).
        target: 1,
        unit: '% correct',
      },
      // Phase 48 — kanji-kind todo for N5 week 1. kanjiSet is an
      // explicit list of kanji card ids from src/data/candidates/n5KanjiCandidateData.ts.
      // The first 5 are the N5 "1-5" kanji (一, 二, 三, 四, 五) — commonly
      // taught first. resolveKanjiSet returns them as card ids and sets
      // expectedTarget = kanjiSet.length (5). recordKanjiGood counts
      // intersection of kanjiGoodAnswers[1] ∩ kanjiSet.
      {
        id: 'n5-w1-kanji',
        kind: 'kanji',
        title: 'Mark these 5 Week 1 kanji as Good',
        // §11.2 default: leave target=0 so the resolver drives the count
        // (kanjiSet.length = 5).
        target: 0,
        unit: 'kanji',
        kanjiSet: [
          'kanji-n5-0001', // 一 (one)
          'kanji-n5-0002', // 二 (two)
          'kanji-n5-0003', // 三 (three)
          'kanji-n5-0004', // 四 (four)
          'kanji-n5-0005', // 五 (five)
        ],
      },
      // Phase 48 — example-sentences-kind todo for N5 week 1. The
      // resolver does NOT need an explicit id list (per §11.2 default);
      // recomputeTodoStatesForWeek counts the size of the intersection
      // of exampleSentencesViewed[1] with the week's example set.
      // Per the 37d-5 default, target=5 sentences.
      {
        id: 'n5-w1-example-sentences',
        kind: 'example-sentences',
        title: 'View 5 Week 1 example sentences',
        // §11.2 default: target=5 (5 distinct sentence views).
        target: 5,
        unit: 'sentences',
      },
    ],
  },
];
