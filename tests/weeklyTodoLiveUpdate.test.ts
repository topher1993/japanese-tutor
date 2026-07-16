import { describe, expect, it, vi } from 'vitest';
import { createFakeSqliteDatabase } from './support/fakeSqliteDatabase';
import { createSqliteLearningRepository } from '../src/repositories/sqliteLearningRepository';
import { createPracticeProgressStore } from '../src/services/practiceProgressStore';
import { getAllLessons } from '../src/services/lessonService';
import { buildDailyTodoBoard } from '../src/services/dailyTodoService';
import { createFlashcardDeck } from '../src/services/flashcardService';
import { createInMemoryLearningRepository } from '../src/repositories/inMemoryLearningRepository';
import type { PersistentLearningRepository } from '../src/repositories/sqliteLearningRepository';

describe('weekly todo live updates', () => {
  it('resolves the five-card kanji requirement before the learner answers the first card', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    await store.ready();

    expect(store.getExtendedProgress().todoStates['n5-w1-kanji']).toMatchObject({
      progress: 0,
      target: 5,
    });
  });

  it('preserves web-session flashcard activity when a lesson completes', async () => {
    const repo = createInMemoryLearningRepository() as unknown as PersistentLearningRepository;
    await repo.saveLessons(getAllLessons());
    const store = createPracticeProgressStore(repo);
    await store.ready();
    const card = createFlashcardDeck(getAllLessons().filter(lesson => lesson.week === 1)).cards[0];

    await store.recordFlashcardReview(1, card.id, '2026-07-12');
    expect(store.getExtendedProgress().todoStates['n5-w1-flashcards']?.progress).toBe(1);

    await store.completeCurrentLesson('lesson-workplace-greetings', 100, '2026-07-12');

    const extended = store.getExtendedProgress();
    expect(extended.todoStates['n5-w1-flashcards']?.progress).toBe(1);
    expect(extended.todoEventCounts.flashcardReviews[1]).toContain(card.id);
    expect(extended.todoEventCounts.dailyActivity['2026-07-12']?.flashcardReviewIds).toContain(card.id);
    expect(extended.todoEventCounts.dailyActivity['2026-07-12']?.lessonIds).toContain('lesson-workplace-greetings');
  });

  it('persists mastery evidence and date-keyed snapshots across reloads', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    const store = createPracticeProgressStore(repo);
    await store.ready();
    await store.recordMasteryEvidence({
      id: 'mastery-one', refId: 'card-one', modality: 'listening', score: 0.8,
      source: 'listening', occurredAt: '2026-07-11T12:00:00.000Z',
    });
    await store.recordMasterySnapshot({ date: '2026-07-11', overallScore: 42, groupScores: { verb: 51 } });
    await store.recordFlashcardReview(1, 'card-two', '2026-07-11');

    const reloaded = createPracticeProgressStore(repo);
    await reloaded.ready();
    const events = reloaded.getExtendedProgress().todoEventCounts;
    expect(events.masteryEvidence).toContainEqual(expect.objectContaining({ id: 'mastery-one', score: 0.8 }));
    expect(events.masterySnapshots).toContainEqual(expect.objectContaining({ date: '2026-07-11', overallScore: 42 }));
  });
  it('persists date-scoped quiz and Sentence Lab signals for the adaptive plan', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 11, 12, 0, 0));
    try {
      const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
      await repo.initialize();
      await repo.saveLessons(getAllLessons());
      const store = createPracticeProgressStore(repo);
      await store.ready();

      await store.recordQuizAttempt(1, 82);
      await store.recordSentenceLabReview('sentence-one', '2026-07-11');

      const reloaded = createPracticeProgressStore(repo);
      await reloaded.ready();
      const activity = reloaded.getExtendedProgress().todoEventCounts.dailyActivity['2026-07-11'];
      expect(activity).toMatchObject({ quizCompleted: true, quizBestScore: 82 });
      expect(activity?.sentenceLabReviewIds).toContain('sentence-one');
    } finally {
      vi.useRealTimers();
    }
  });
  it('attributes Sentence Lab activity to a placed learner\'s active week', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    const store = createPracticeProgressStore(repo);
    await store.ready();

    await store.recordSentenceLabReview('n4-sentence', '2026-07-11', 'N4');

    expect(
      store.getExtendedProgress().todoEventCounts.dailyActivity['2026-07-11'],
    ).toMatchObject({ weekNumber: 6, sentenceLabReviewIds: ['n4-sentence'] });
  });
  it('notifies subscribers when one completed lesson updates the todo cache', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    await repo.saveLessons(getAllLessons());
    const store = createPracticeProgressStore(repo);
    await store.ready();
    const before = store.getExtendedProgressRevision();
    let notifications = 0;
    const unsubscribe = store.subscribeExtendedProgress(() => { notifications += 1; });

    await store.completeCurrentLesson('lesson-workplace-greetings', 100, '2026-07-11');

    unsubscribe();
    expect(store.getExtendedProgressRevision()).toBeGreaterThan(before);
    expect(notifications).toBeGreaterThan(0);
    expect(Object.values(store.getExtendedProgress().todoStates).some(state => state.progress > 0)).toBe(true);
  });

  it('stores daily rush and flashcard activity under the completion date', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    await repo.saveLessons(getAllLessons());
    const store = createPracticeProgressStore(repo);
    await store.ready();

    await store.recordFlashcardReview(1, 'daily-card-1', '2026-07-11');
    await store.recordDailyRushComplete(1, '2026-07-11');

    const activity = store.getExtendedProgress().todoEventCounts.dailyActivity['2026-07-11'];
    expect(activity?.flashcardReviewIds).toContain('daily-card-1');
    expect(activity?.dailyRushCompleted).toBe(true);
  });

  it('keeps the daily lesson complete after navigation advances to the next lesson', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    await repo.saveLessons(getAllLessons());
    const store = createPracticeProgressStore(repo);
    await store.ready();

    await store.completeCurrentLesson('lesson-workplace-greetings', 100, '2026-07-11');

    const activity = store.getExtendedProgress().todoEventCounts.dailyActivity['2026-07-11'];
    const board = buildDailyTodoBoard('2026-07-11', activity);
    expect(activity?.lessonIds).toContain('lesson-workplace-greetings');
    expect(board.todos.find(todo => todo.todo.kind === 'lesson')?.completed).toBe(true);
  });

  it('persists daily lesson and flashcard activity even when no weekly plan exists', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    await repo.saveLessons(getAllLessons());
    const store = createPracticeProgressStore(repo);
    await store.ready();

    await store.completeCurrentLesson('lesson-week2-requests', 100, '2026-07-12');
    await store.recordFlashcardReview(2, 'week2-card', '2026-07-12');

    const reloaded = createPracticeProgressStore(repo);
    await reloaded.ready();
    const activity = reloaded.getExtendedProgress().todoEventCounts.dailyActivity['2026-07-12'];
    expect(activity?.weekNumber).toBe(2);
    expect(activity?.lessonIds).toContain('lesson-week2-requests');
    expect(activity?.flashcardReviewIds).toContain('week2-card');
  });

  it('adds the same five cards on different days toward the 35-review weekly target', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    await repo.saveLessons(getAllLessons());
    const store = createPracticeProgressStore(repo);
    await store.ready();
    const cards = createFlashcardDeck(getAllLessons().filter(lesson => lesson.week === 1)).cards.slice(0, 5);

    for (const date of ['2026-07-11', '2026-07-12']) {
      for (const card of cards) await store.recordFlashcardReview(1, card.id, date);
    }

    expect(store.getExtendedProgress().todoStates['n5-w1-flashcards']?.progress).toBe(10);
    expect(store.getExtendedProgress().todoStates['n5-w1-flashcards']?.target).toBe(35);
  });

  it('counts adaptive Daily Rush cards outside the authored Week 1 pool', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    await repo.saveLessons(getAllLessons());
    const store = createPracticeProgressStore(repo);
    await store.ready();

    for (const cardId of ['adaptive-a', 'adaptive-b', 'adaptive-c', 'adaptive-d', 'adaptive-e']) {
      await store.recordFlashcardReview(1, cardId, '2026-07-11');
    }

    expect(store.getExtendedProgress().todoStates['n5-w1-flashcards']?.progress).toBe(5);
  });

  it('repairs a stale weekly flashcard snapshot from persisted daily activity on restart', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    await repo.saveLessons(getAllLessons());
    const store = createPracticeProgressStore(repo);
    await store.ready();
    for (const cardId of ['adaptive-a', 'adaptive-b', 'adaptive-c', 'adaptive-d', 'adaptive-e']) {
      await store.recordFlashcardReview(1, cardId, '2026-07-11');
    }
    const persisted = await repo.getProgress() as unknown as Record<string, unknown> & {
      todoStates: Record<string, { progress: number }>;
    };
    await repo.saveExtendedProgress?.({
      ...persisted,
      todoStates: {
        ...persisted.todoStates,
        'n5-w1-flashcards': { ...persisted.todoStates['n5-w1-flashcards'], progress: 1 },
      },
    } as never);

    const reloaded = createPracticeProgressStore(repo);
    await reloaded.ready();
    expect(reloaded.getExtendedProgress().todoStates['n5-w1-flashcards']?.progress).toBe(5);
  });

  it('waits for an older progress write before reset clears the durable snapshot', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    const store = createPracticeProgressStore(repo);
    await store.ready();

    const originalSave = repo.saveExtendedProgress!.bind(repo);
    let signalSaveStarted!: () => void;
    let releaseSave!: () => void;
    const saveStarted = new Promise<void>(resolve => { signalSaveStarted = resolve; });
    const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
    let blockNextSave = true;
    repo.saveExtendedProgress = async snapshot => {
      if (blockNextSave) {
        blockNextSave = false;
        signalSaveStarted();
        await saveGate;
      }
      await originalSave(snapshot);
    };

    const olderWrite = store.recordSentenceLabReview('pending-review', '2026-07-14');
    await saveStarted;
    let resetFinished = false;
    const reset = store.reset().then(() => { resetFinished = true; });
    await Promise.resolve();
    expect(resetFinished).toBe(false);

    releaseSave();
    await Promise.all([olderWrite, reset]);

    const persisted = await repo.getProgress() as unknown as {
      completedLessonIds: string[];
      todoEventCounts: { dailyActivity?: Record<string, unknown>; masteryEvidence?: unknown[] };
    };
    expect(persisted.completedLessonIds).toEqual([]);
    expect(persisted.todoEventCounts.dailyActivity ?? {}).toEqual({});
    expect(persisted.todoEventCounts.masteryEvidence ?? []).toEqual([]);
    expect(store.getExtendedProgress().todoEventCounts.dailyActivity).toEqual({});
  });
});
