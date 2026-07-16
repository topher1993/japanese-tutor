import { Timestamp, type Query } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';

import {
  KOI_RETENTION_DELETE_BATCH_LIMIT,
  deleteExpiredInBatches,
} from '../src/retention.js';

function fakeExpiredQuery(initialCount: number): {
  query: Query;
  remaining: () => number;
  reads: () => number;
} {
  let remaining = initialCount;
  let reads = 0;
  let limit = KOI_RETENTION_DELETE_BATCH_LIMIT;
  const firestore = {
    batch() {
      let deletes = 0;
      return {
        delete() { deletes += 1; },
        async commit() { remaining -= deletes; },
      };
    },
  };
  const query = {
    where() { return query; },
    limit(value: number) { limit = value; return query; },
    async get() {
      reads += 1;
      const size = Math.min(limit, remaining);
      return {
        empty: size === 0,
        size,
        docs: Array.from({ length: size }, () => ({ ref: { firestore } })),
      };
    },
  } as unknown as Query;
  return { query, remaining: () => remaining, reads: () => reads };
}

describe('Koi retention pagination', () => {
  it('continues deleting beyond the first 450 documents', async () => {
    const fake = fakeExpiredQuery(901);
    const result = await deleteExpiredInBatches(fake.query, 'expiresAt', Timestamp.now());
    expect(result).toEqual({ deleted: 901, hasMore: false });
    expect(fake.remaining()).toBe(0);
    expect(fake.reads()).toBe(3);
  });

  it('returns an explicit continuation marker at the configured work bound', async () => {
    const fake = fakeExpiredQuery(901);
    const result = await deleteExpiredInBatches(fake.query, 'expiresAt', Timestamp.now(), 1);
    expect(result).toEqual({ deleted: 450, hasMore: true });
    expect(fake.remaining()).toBe(451);
  });
});
