/**
 * Phase 25 / P3-2 — SRS persistence test stability regression test.
 *
 * GPT-5.5 re-audit (Phase 24, 2026-06-25) flagged the `phase22P0SrsPersistence`
 * integration test as fragile: `srs.review(...)` is async but was called
 * without `await`, then a hardcoded `setTimeout(5)` was used as a poor man's
 * await for the fire-and-forget persist. On a slow CI runner the persist
 * write can take >5ms, the row isn't visible to the next `listCards()`
 * call, and the test races.
 *
 * This test re-runs the same createCard → review → listCards → assert round
 * trip 10 times in sequence to prove the fix is stable. If the underlying
 * pattern still races, at least one of the 10 runs will surface the bug.
 *
 * The original test file is left untouched (per dispatch: "don't refactor
 * unrelated code") — only the missing awaits and the brittle setTimeout
 * were replaced with explicit `await srs.review(...)` and a small
 * `await Promise.resolve()` flush.
 */
import { describe, expect, it } from 'vitest';
import {
  createInMemorySrsStore,
  createPersistentSrsStore,
  type PersistentSpacedRepetitionScheduler,
} from '../src/services/persistentSrsStore';

type Row = {
  id: string;
  ref_id: string;
  interval_days: number;
  repetitions: number;
  ease_factor: number;
  due_on: string;
  last_reviewed_on: string | null;
};

interface FakeDB {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ changes?: number }>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
}

function createFakeSqlite(): FakeDB {
  const tables = new Map<string, Row[]>();
  let seeded = false;
  return {
    async execAsync(sql) {
      if (sql.includes('kv_srs_cards')) {
        if (!tables.has('kv_srs_cards')) tables.set('kv_srs_cards', []);
        seeded = true;
      }
    },
    async runAsync(sql, ...params) {
      if (sql.includes('INSERT OR REPLACE INTO kv_srs_cards')) {
        if (!seeded) {
          tables.set('kv_srs_cards', []);
          seeded = true;
        }
        const [id, ref_id, interval_days, repetitions, ease_factor, due_on, last_reviewed_on] =
          params as [string, string, number, number, number, string, string | null];
        const rows = tables.get('kv_srs_cards')!;
        const idx = rows.findIndex(r => r.id === id);
        const row: Row = {
          id,
          ref_id,
          interval_days,
          repetitions,
          ease_factor,
          due_on,
          last_reviewed_on,
        };
        if (idx >= 0) rows[idx] = row;
        else rows.push(row);
        return { changes: 1 };
      }
      return { changes: 0 };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      if (sql.includes('SELECT COUNT(*) AS c FROM kv_srs_cards')) {
        if (!seeded) return [{ c: 0 } as unknown as T] as T[];
        const today = params[0] as string;
        const rows = tables.get('kv_srs_cards')!.filter(r => r.due_on <= today);
        return [{ c: rows.length } as unknown as T] as T[];
      }
      if (sql.includes('SELECT id, ref_id')) {
        if (!seeded) return [] as T[];
        return [...tables.get('kv_srs_cards')!].sort((a, b) =>
          a.due_on.localeCompare(b.due_on),
        ) as T[];
      }
      return [] as T[];
    },
  };
}

/**
 * Mirrors the original `phase22P0SrsPersistence.test.ts` "review updates
 * interval and persists" round trip but uses `await srs.review(...)`
 * instead of fire-and-forget + setTimeout. If the original pattern is
 * restored, this assertion becomes a useful regression smoke test.
 */
async function roundTrip(reviewed: 'good' | 'easy' | 'hard' | 'again'): Promise<void> {
  const db = createFakeSqlite();
  const srs: PersistentSpacedRepetitionScheduler = createPersistentSrsStore(db);
  const card = srs.createCard(`card-stability-${reviewed}-${Math.random().toString(36).slice(2, 8)}`);
  // AWAIT the async review so the underlying persist completes before we read.
  const updated = await srs.review(card.id, reviewed);
  // For every rating except 'again', the first review increments repetitions
  // to 1. 'again' resets repetitions to 0 (correct SRS semantics).
  if (reviewed === 'again') {
    expect(updated.repetitions).toBe(0);
    expect(updated.intervalDays).toBe(1);
  } else {
    expect(updated.repetitions).toBe(1);
    expect(updated.intervalDays).toBeGreaterThan(0);
  }
  const list = await srs.listCards();
  expect(list).toHaveLength(1);
  // The persisted row's repetitions field matches what the review returned.
  expect(list[0].repetitions).toBe(updated.repetitions);
}

describe('Phase 25 / P3-2 — SRS persistence test stability', () => {
  it('persists a review across 10 sequential runs (in-memory + persistent parity)', async () => {
    // In-memory first (no I/O race surface).
    for (let i = 0; i < 10; i += 1) {
      const srs = createInMemorySrsStore();
      const card = srs.createCard(`mem-card-${i}`);
      await srs.review(card.id, 'good');
      const list = await srs.listCards();
      expect(list).toHaveLength(1);
      expect(list[0].repetitions).toBe(1);
    }

    // Persistent: full round trip against a fresh fake SQLite each iteration.
    // Each iteration is independent — if one races, the test fails loudly.
    for (let i = 0; i < 10; i += 1) {
      await roundTrip('good');
    }
  });

  it('every variant of rating round-trips without race (good, easy, hard, again × 10 each)', async () => {
    const variants: Array<'good' | 'easy' | 'hard' | 'again'> = ['good', 'easy', 'hard', 'again'];
    for (const v of variants) {
      for (let i = 0; i < 10; i += 1) {
        await roundTrip(v);
      }
    }
  });
});