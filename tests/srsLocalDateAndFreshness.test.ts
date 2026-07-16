import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SqliteLikeDatabase } from '../src/repositories/sqliteLearningRepository';
import {
  createInMemorySrsStore,
  createPersistentSrsStore,
} from '../src/services/persistentSrsStore';
import { createSpacedRepetitionScheduler } from '../src/services/spacedRepetitionService';

const originalTimezone = process.env.TZ;

describe('SRS learner-local dates and fresh due results', () => {
  beforeAll(() => {
    process.env.TZ = 'Asia/Tokyo';
  });

  afterAll(() => {
    if (originalTimezone == null) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    // 00:30 in Japan, while the UTC calendar date is still July 13.
    vi.setSystemTime(new Date('2026-07-13T15:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates, reviews, and releases cards at the learner local midnight', () => {
    const scheduler = createSpacedRepetitionScheduler();
    const created = scheduler.createCard('japan-midnight');

    expect(created.dueOn).toBe('2026-07-14');
    scheduler.setStage(created.id, 'memorized');
    expect(scheduler.dueCards()).toHaveLength(1);

    const reviewed = scheduler.review(created.id, 'good');
    expect(reviewed.lastReviewedOn).toBe('2026-07-14');
    expect(reviewed.dueOn).toBe('2026-07-15');

    expect(scheduler.dueCards(new Date('2026-07-14T14:59:00.000Z'))).toHaveLength(0);
    expect(scheduler.dueCards(new Date('2026-07-14T15:01:00.000Z'))).toHaveLength(1);
  });

  it('uses the learner local date in persistent due-count decisions', async () => {
    const db = {
      async execAsync() {},
      async runAsync() { return { changes: 0 }; },
      async getAllAsync<T>(sql: string): Promise<T[]> {
        if (!sql.includes('SELECT id, ref_id')) return [];
        return [{
          id: 'local-midnight-card',
          ref_id: 'local-midnight-ref',
          interval_days: 1,
          repetitions: 1,
          ease_factor: 2.5,
          due_on: '2026-07-14',
          last_reviewed_on: '2026-07-13',
          stage: 'memorized',
        } as T];
      },
    } as SqliteLikeDatabase;

    const store = createPersistentSrsStore(db);
    await expect(store.dueCount(new Date('2026-07-13T15:30:00.000Z'))).resolves.toBe(1);
  });

  it('drops a reviewed card from web dueCards immediately', async () => {
    const store = createInMemorySrsStore();
    const created = store.createCard('web-review-refresh');
    await store.setStage(created.id, 'memorized');

    expect(store.dueCards()).toHaveLength(1);
    await store.review(created.id, 'good');

    expect(store.dueCards()).toHaveLength(0);
    await expect(store.listCards()).resolves.toEqual([
      expect.objectContaining({ id: created.id, repetitions: 1, dueOn: '2026-07-15' }),
    ]);
  });

  it('returns the post-reschedule state instead of a stale catch-up row on web', async () => {
    const store = createInMemorySrsStore();
    store.adoptCard({
      id: 'web-overdue-card',
      refId: 'web-overdue-ref',
      intervalDays: 12,
      repetitions: 3,
      easeFactor: 2.5,
      dueOn: '2026-06-08',
      lastReviewedOn: '2026-06-08',
      stage: 'memorized',
    });

    const due = store.dueCards(new Date('2026-07-08T03:00:00.000Z'));

    expect(due).toEqual([]);
    expect(store.getCard('web-overdue-card')?.dueOn).toBe('2026-07-14');
    await expect(store.listCards()).resolves.toEqual([
      expect.objectContaining({ id: 'web-overdue-card', dueOn: '2026-07-14' }),
    ]);
  });

  it('persists a catch-up date even though the rescheduled card is no longer due', async () => {
    const persistedDueDates: unknown[] = [];
    const db = {
      async execAsync() {},
      async runAsync(sql: string, ...params: unknown[]) {
        if (sql.includes('INSERT OR REPLACE INTO kv_srs_cards')) persistedDueDates.push(params[5]);
        return { changes: 1 };
      },
      async getAllAsync<T>(): Promise<T[]> { return []; },
    } as SqliteLikeDatabase;
    const store = createPersistentSrsStore(db);
    store.adoptCard({
      id: 'persistent-overdue-card',
      refId: 'persistent-overdue-ref',
      intervalDays: 12,
      repetitions: 3,
      easeFactor: 2.5,
      dueOn: '2026-06-08',
      lastReviewedOn: '2026-06-08',
      stage: 'memorized',
    });

    expect(store.dueCards(new Date('2026-07-08T03:00:00.000Z'))).toEqual([]);
    await store.flush();

    expect(persistedDueDates).toEqual(['2026-07-14']);
  });

  it('applies catch-up scheduling through the listCards path used by screens', async () => {
    let row = {
      id: 'screen-overdue-card',
      ref_id: 'screen-overdue-ref',
      interval_days: 12,
      repetitions: 3,
      ease_factor: 2.5,
      due_on: '2026-06-08',
      last_reviewed_on: '2026-06-08',
      stage: 'memorized' as const,
    };
    const db = {
      async execAsync() {},
      async runAsync(sql: string, ...params: unknown[]) {
        if (sql.includes('INSERT OR REPLACE INTO kv_srs_cards')) {
          row = {
            id: params[0] as string,
            ref_id: params[1] as string,
            interval_days: params[2] as number,
            repetitions: params[3] as number,
            ease_factor: params[4] as number,
            due_on: params[5] as string,
            last_reviewed_on: params[6] as string,
            stage: params[7] as typeof row.stage,
          };
        }
        return { changes: 1 };
      },
      async getAllAsync<T>(sql: string): Promise<T[]> {
        return sql.includes('SELECT id, ref_id') ? [row as T] : [];
      },
    } as SqliteLikeDatabase;

    const store = createPersistentSrsStore(db);
    const listed = await store.listCards();

    expect(listed).toEqual([
      expect.objectContaining({ id: row.id, dueOn: '2026-07-20' }),
    ]);
    expect(row.due_on).toBe('2026-07-20');
    await expect(store.dueCount()).resolves.toBe(0);
  });

  it('waits for a queued native create before a screen-facing list read', async () => {
    type Row = {
      id: string;
      ref_id: string;
      interval_days: number;
      repetitions: number;
      ease_factor: number;
      due_on: string;
      last_reviewed_on: string | null;
      stage: 'seen' | 'recognized' | 'memorized';
    };
    const rows: Row[] = [];
    let releaseInsert!: () => void;
    const insertGate = new Promise<void>(resolve => { releaseInsert = resolve; });
    let selectCalls = 0;
    const db = {
      async execAsync() {},
      async runAsync(sql: string, ...params: unknown[]) {
        if (sql.includes('INSERT OR REPLACE INTO kv_srs_cards')) {
          await insertGate;
          rows.push({
            id: params[0] as string,
            ref_id: params[1] as string,
            interval_days: params[2] as number,
            repetitions: params[3] as number,
            ease_factor: params[4] as number,
            due_on: params[5] as string,
            last_reviewed_on: params[6] as string | null,
            stage: params[7] as Row['stage'],
          });
        }
        return { changes: 1 };
      },
      async getAllAsync<T>(sql: string): Promise<T[]> {
        if (!sql.includes('SELECT id, ref_id')) return [];
        selectCalls += 1;
        return rows.map(row => ({ ...row })) as T[];
      },
    } as SqliteLikeDatabase;

    const store = createPersistentSrsStore(db);
    const created = store.createCard('queued-native-card');
    const listing = store.listCards();
    await Promise.resolve();

    expect(selectCalls).toBe(0);
    releaseInsert();
    await expect(listing).resolves.toEqual([
      expect.objectContaining({ id: created.id, refId: created.refId }),
    ]);
    expect(selectCalls).toBe(1);
  });
});
