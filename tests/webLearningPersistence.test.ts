import { describe, expect, it } from 'vitest';

import {
  createKeyValueLearningRepository,
  type LearningKeyValueStorage,
} from '../src/repositories/keyValueLearningRepository';
import { createPracticeProgressStore } from '../src/services/practiceProgressStore';
import { createKeyValueSrsStore } from '../src/services/persistentSrsStore';
import { localDateKey } from '../src/utils/localDate';

function createStorage(): LearningKeyValueStorage {
  const values = new Map<string, string>();
  return {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

describe('durable web learning state', () => {
  it('restores lesson, streak, and weekly activity after a browser-style remount', async () => {
    const today = localDateKey();
    const storage = createStorage();
    const firstRepo = createKeyValueLearningRepository(storage);
    await firstRepo.initialize();
    const firstStore = createPracticeProgressStore(firstRepo);
    await firstStore.ready();
    await firstStore.completeCurrentLesson('lesson-workplace-greetings', 3, today);
    await firstStore.recordFlashcardReview(1, 'lesson-workplace-greetings-card-1', today);

    const reloadedRepo = createKeyValueLearningRepository(storage);
    await reloadedRepo.initialize();
    const reloadedStore = createPracticeProgressStore(reloadedRepo);
    await reloadedStore.ready();

    const dashboard = await reloadedStore.getDashboard();
    expect(dashboard.completedLessons).toBe(1);
    expect(dashboard.currentStreak).toBe(1);
    expect(reloadedStore.getExtendedProgress().todoEventCounts.dailyActivity[today])
      .toMatchObject({ flashcardReviewIds: ['lesson-workplace-greetings-card-1'] });
  });

  it('restores reviewed SRS cards and their stage after a browser-style remount', async () => {
    const storage = createStorage();
    const first = createKeyValueSrsStore(storage);
    await first.hydrate();
    const card = first.createCard('persistent-web-card');
    await first.setStage(card.id, 'memorized');
    const reviewed = await first.review(card.id, 'good');
    await first.flush();

    const reloaded = createKeyValueSrsStore(storage);
    await reloaded.hydrate();
    const cards = await reloaded.listCards();

    expect(cards).toEqual([
      expect.objectContaining({
        id: reviewed.id,
        refId: 'persistent-web-card',
        repetitions: 1,
        stage: 'memorized',
        dueOn: reviewed.dueOn,
      }),
    ]);
  });
});
