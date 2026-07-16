import { describe, expect, it } from 'vitest';

import { reserveProviderLease, type KoiProviderLease } from '../src/providerSemaphore.js';

const lease = (id: string, expiresAtMs: number): KoiProviderLease => ({
  id,
  ownerUid: `user-${id}`,
  expiresAtMs,
});

describe('provider semaphore', () => {
  it('admits no more than two active provider calls', () => {
    const nowMs = 1_000;
    const first = reserveProviderLease([], lease('1', 5_000), nowMs);
    const second = reserveProviderLease(first.leases, lease('2', 6_000), nowMs);
    const third = reserveProviderLease(second.leases, lease('3', 7_000), nowMs);
    expect(first.retryAtMs).toBeUndefined();
    expect(second.retryAtMs).toBeUndefined();
    expect(third.leases).toHaveLength(2);
    expect(third.retryAtMs).toBe(5_000);
  });

  it('prunes expired and malformed leases before admission', () => {
    const result = reserveProviderLease([
      lease('expired', 999),
      { id: 'bad' },
      lease('active', 2_000),
    ], lease('new', 3_000), 1_000);
    expect(result.leases.map(({ id }) => id)).toEqual(['active', 'new']);
  });
});

