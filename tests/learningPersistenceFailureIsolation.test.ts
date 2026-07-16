import { describe, expect, it, vi } from 'vitest';

import {
  createKeyValueLearningRepository,
  type LearningKeyValueStorage,
} from '../src/repositories/keyValueLearningRepository';
import {
  createLearningRuntimeWithSrsFallback,
  makeResetAll,
} from '../src/services/learningRuntimeService';
import { createInMemorySrsStore } from '../src/services/persistentSrsStore';

function createStorage(): LearningKeyValueStorage {
  const values = new Map<string, string>();
  return {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

describe('learning persistence failure isolation', () => {
  it('keeps the durable learning repository when only SRS hydration fails', async () => {
    const repo = createKeyValueLearningRepository(createStorage());
    await repo.initialize();
    const durableClear = vi.fn(async () => undefined);
    const brokenSrs = {
      ...createInMemorySrsStore(),
      async hydrate() { throw new Error('bad SRS row'); },
      clearAll: durableClear,
    };

    const runtime = await createLearningRuntimeWithSrsFallback(repo, () => brokenSrs);
    expect(runtime.repo).toBe(repo);
    expect(runtime.srsDurable).toBe(false);

    await runtime.store.completeCurrentLesson('lesson-workplace-greetings', 3, '2026-07-14');
    await expect(repo.getProgress()).resolves.toMatchObject({
      completedLessonIds: ['lesson-workplace-greetings'],
    });

    // The in-memory review facade still retains the failed durable handle for
    // Settings recovery, so reset can remove the bad on-disk rows.
    await runtime.srs.clearAll();
    expect(durableClear).toHaveBeenCalledTimes(1);
  });

  it('attempts both clears even when the pre-reset SRS count cannot be read', async () => {
    const repo = createKeyValueLearningRepository(createStorage());
    await repo.initialize();
    const runtime = await createLearningRuntimeWithSrsFallback(
      repo,
      () => createInMemorySrsStore(),
    );
    await runtime.store.completeCurrentLesson('lesson-workplace-greetings', 3, '2026-07-14');

    const clearAll = vi.fn(async () => undefined);
    const unreadableSrs = {
      ...createInMemorySrsStore(),
      async listCards() { throw new Error('cannot read SRS table'); },
      clearAll,
    };
    const resetAll = makeResetAll(runtime.store, unreadableSrs);

    await expect(resetAll()).resolves.toEqual({ srsRowsCleared: 0 });
    expect(clearAll).toHaveBeenCalledTimes(1);
    await expect(repo.getProgress()).resolves.toMatchObject({ completedLessonIds: [] });
  });
});
