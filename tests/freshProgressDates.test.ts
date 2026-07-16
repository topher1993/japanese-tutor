import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInMemoryLearningRepository } from '../src/repositories/inMemoryLearningRepository';
import { createSqliteLearningRepository } from '../src/repositories/sqliteLearningRepository';
import { createFakeSqliteDatabase } from './support/fakeSqliteDatabase';

describe('fresh learner start dates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-02-03T03:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the current learner-local date for in-memory and SQLite fallbacks', async () => {
    const memory = createInMemoryLearningRepository();
    const sqlite = createSqliteLearningRepository(createFakeSqliteDatabase());
    await sqlite.initialize();

    await expect(memory.getProgress()).resolves.toMatchObject({ startedAt: '2031-02-03' });
    await expect(sqlite.getProgress()).resolves.toMatchObject({ startedAt: '2031-02-03' });
  });

  it('reconstructs the durable start date from the first persisted study event', async () => {
    const db = createFakeSqliteDatabase();
    const first = createSqliteLearningRepository(db);
    await first.initialize();
    await first.saveCompletedLesson('lesson-one', 3, '2031-01-27');

    const reloaded = createSqliteLearningRepository(db);
    await reloaded.initialize();
    const progress = await reloaded.getProgress();

    expect(progress.startedAt).toBe('2031-01-27');
  });
});
