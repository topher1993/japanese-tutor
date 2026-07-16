/**
 * Phase 25 / P0-2 — Real native reset path.
 *
 * GPT-5.5 re-audit (Phase 24, 2026-06-25) found that the Settings "Reset all
 * progress" affordance was a no-op on React Native — `clearOnboardingPreference`
 * only knew `window.localStorage`, the practice-progress store had no `reset()`,
 * the SRS store had no `clearAll()`, and the SQLite repository had no
 * `deleteAllProgress()`.
 *
 * This test proves the fix is real:
 *   1. Practice-progress store has a `reset()` that calls `repo.deleteAllProgress()`.
 *   2. In-memory repo `deleteAllProgress()` actually clears `progress`.
 *   3. Practice-progress store has `getDashboard()` returning initial-state after reset.
 *   4. Both SRS store impls have `clearAll()` and the persistent impl executes a
 *      `DELETE FROM kv_srs_cards` SQL via the underlying SqliteLikeDatabase.
 *   5. After `clearAll()`, `listCards()` returns [].
 *   6. The LearningRepositoryProvider context exposes `resetAll` that wipes both.
 *   7. SettingsScreen calls `resetAll()` from the context (not the onReset prop alone).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPracticeProgressStore } from '../src/services/practiceProgressStore';
import { createInMemoryLearningRepository } from '../src/repositories/inMemoryLearningRepository';
import type { PersistentLearningRepository } from '../src/repositories/sqliteLearningRepository';
import {
  createPersistentSrsStore,
  createInMemorySrsStore,
} from '../src/services/persistentSrsStore';
import { createSqliteLearningRepository } from '../src/repositories/sqliteLearningRepository';
import { getPhraseLessons } from '../src/services/lessonService';

describe('Phase 25 / P0-2 — Real native reset path', () => {
  it('practiceProgressStore has a reset() method', () => {
    const repo = createInMemoryLearningRepository() as unknown as PersistentLearningRepository;
    const store = createPracticeProgressStore(repo);
    expect(typeof store.reset).toBe('function');
  });

  it('in-memory repo deleteAllProgress() resets progress to initial state', async () => {
    const repo = createInMemoryLearningRepository() as unknown as PersistentLearningRepository;
    // Save a lesson
    await repo.saveCompletedLesson('lesson-1', 95, '2026-06-25');
    const before = await repo.getProgress();
    expect(before.quizScores.length).toBeGreaterThan(0);
    // Reset
    await repo.deleteAllProgress();
    const after = await repo.getProgress();
    expect(after.quizScores.length).toBe(0);
  });

  it('practiceProgressStore.reset() actually wipes via repo.deleteAllProgress()', async () => {
    const repo = createInMemoryLearningRepository() as unknown as PersistentLearningRepository;
    const store = createPracticeProgressStore(repo);
    await repo.saveCompletedLesson(getPhraseLessons()[0].id, 95, '2026-06-25');
    const before = await store.getDashboard();
    expect(before.completedLessons).toBeGreaterThanOrEqual(1);
    await store.reset();
    const after = await store.getDashboard();
    expect(after.completedLessons).toBe(0);
  });

  it('practiceProgressStore uses bundled lessons when repo has no saved lesson catalog', async () => {
    const repo = createInMemoryLearningRepository() as unknown as PersistentLearningRepository;
    const store = createPracticeProgressStore(repo);
    const dashboard = await store.getDashboard();
    expect(dashboard.completedLessons).toBe(0);
    expect(dashboard.totalLessons).toBe(getPhraseLessons().length);
    expect(dashboard.totalLessons).toBeGreaterThan(0);
    expect(dashboard.nextRecommendedLesson?.id).toBe(getPhraseLessons()[0].id);
  });

  it('PersistentSpacedRepetitionScheduler has clearAll()', () => {
    const srs = createInMemorySrsStore();
    expect(typeof srs.clearAll).toBe('function');
  });

  it('in-memory SRS clearAll() empties listCards()', async () => {
    const srs = createInMemorySrsStore();
    srs.createCard('ref-1');
    srs.createCard('ref-2');
    expect((await srs.listCards()).length).toBe(2);
    await srs.clearAll();
    expect((await srs.listCards()).length).toBe(0);
  });

  it('persistent SRS clearAll() issues DELETE FROM kv_srs_cards via the db adapter', async () => {
    const runAsync = vi.fn<(sql: string, ...params: unknown[]) => Promise<{ changes?: number }>>(
      async (_sql: string) => ({ changes: 0 }),
    );
    const db = {
      execAsync: vi.fn(async () => undefined),
      runAsync,
      getAllAsync: vi.fn(async () => []),
    };
    const srs = createPersistentSrsStore(db as never);
    await srs.clearAll();
    const calls = runAsync.mock.calls.map((c) => String(c[0]));
    expect(
      calls.some((sql: string) => /DELETE\s+FROM\s+kv_srs_cards/i.test(sql)),
      `Expected DELETE FROM kv_srs_cards in runAsync calls, got: ${JSON.stringify(calls)}`,
    ).toBe(true);
  });

  it('persistent SRS clearAll() handles missing table gracefully (recreates schema)', async () => {
    const runAsync = vi.fn<(sql: string, ...params: unknown[]) => Promise<{ changes?: number }>>(
      async () => {
        throw new Error('no such table: kv_srs_cards');
      },
    );
    const execAsync = vi.fn(async () => undefined);
    const db = {
      execAsync,
      runAsync,
      getAllAsync: vi.fn(async () => []),
    };
    const srs = createPersistentSrsStore(db as never);
    // Must not throw.
    await expect(srs.clearAll()).resolves.toBeUndefined();
    // And must have attempted to recreate the schema after the failure.
    expect(execAsync).toHaveBeenCalled();
  });

  it('persistent repo deleteAllProgress() issues DELETE FROM progress and resets progressCache', async () => {
    const runAsync = vi.fn<(sql: string, ...params: unknown[]) => Promise<{ changes?: number }>>(
      async () => ({ changes: 0 }),
    );
    const db = {
      execAsync: vi.fn(async () => undefined),
      runAsync,
      getAllAsync: vi.fn(async () => []),
    };
    const repo = createSqliteLearningRepository(db as never);
    await repo.initialize();
    await repo.deleteAllProgress();
    const calls = runAsync.mock.calls.map((c) => String(c[0]));
    expect(
      calls.some((sql: string) => /DELETE\s+FROM\s+progress/i.test(sql)),
      `Expected DELETE FROM progress in runAsync calls, got: ${JSON.stringify(calls)}`,
    ).toBe(true);
    const after = await repo.getProgress();
    expect(after.quizScores.length).toBe(0);
  });

  it('SettingsScreen imports resetAll from useLearningContext and calls it before onReset', () => {
    const src = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
    expect(src).toMatch(/const\s*\{\s*ready\s*,\s*durable\s*,\s*resetAll\s*\}\s*=\s*useLearningContext\(\)/);
    // The order matters: resetAll() must run BEFORE onReset() so the SRS row
    // count we display reflects what was actually persisted before clearing.
    const resetAllIdx = src.search(/await\s+resetAll\(\)/);
    const onResetIdx = src.search(/await\s+onReset\(\)/);
    expect(resetAllIdx).toBeGreaterThan(-1);
    expect(onResetIdx).toBeGreaterThan(-1);
    expect(resetAllIdx).toBeLessThan(onResetIdx);
  });

  it('LearningRepositoryProvider value shape exposes resetAll', () => {
    const src = readFileSync('src/services/learningContext.tsx', 'utf8');
    expect(src).toMatch(/resetAll:\s*\(\)\s*=>\s*Promise</);
    expect(src).toMatch(/resetAll:\s*makeResetAll\(store,\s*srs\)/);
  });
});
