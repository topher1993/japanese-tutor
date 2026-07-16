import { randomUUID } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

import { KOI_PROVIDER_CONCURRENCY_LIMIT } from './config.js';
import { KoiBackendError } from './errors.js';

// Longer than the 60-second callable timeout, so a timed-out instance cannot
// overlap a replacement call while it is still winding down.
export const KOI_PROVIDER_LEASE_MS = 65_000;

export interface KoiProviderLease {
  id: string;
  ownerUid: string;
  expiresAtMs: number;
}

const isLease = (value: unknown): value is KoiProviderLease => {
  if (typeof value !== 'object' || value === null) return false;
  const lease = value as Partial<KoiProviderLease>;
  return typeof lease.id === 'string'
    && typeof lease.ownerUid === 'string'
    && typeof lease.expiresAtMs === 'number'
    && Number.isFinite(lease.expiresAtMs);
};

export function reserveProviderLease(
  storedLeases: unknown,
  lease: KoiProviderLease,
  nowMs: number,
): { leases: KoiProviderLease[]; retryAtMs?: number } {
  const active = Array.isArray(storedLeases)
    ? storedLeases.filter(isLease).filter((candidate) => candidate.expiresAtMs > nowMs)
    : [];
  if (active.length >= KOI_PROVIDER_CONCURRENCY_LIMIT) {
    return {
      leases: active,
      retryAtMs: Math.min(...active.map((candidate) => candidate.expiresAtMs)),
    };
  }
  return { leases: [...active, lease] };
}

export async function withProviderLease<T>(
  db: Firestore,
  ownerUid: string,
  work: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const ref = db.doc('koiSystem/providerConcurrency');
  const lease: KoiProviderLease = {
    id: randomUUID(),
    ownerUid,
    expiresAtMs: now() + KOI_PROVIDER_LEASE_MS,
  };
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const reservation = reserveProviderLease(snapshot.data()?.leases, lease, now());
    if (reservation.retryAtMs !== undefined) {
      throw new KoiBackendError('TOKEN_PLAN_BUSY', 'Koi Sensei is helping two learners right now.', reservation.retryAtMs);
    }
    transaction.set(ref, { leases: reservation.leases, updatedAtMs: now() }, { merge: true });
  });

  try {
    return await work();
  } finally {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const stored = snapshot.data()?.leases;
      const leases = Array.isArray(stored)
        ? stored.filter(isLease).filter((candidate) => candidate.id !== lease.id && candidate.expiresAtMs > now())
        : [];
      transaction.set(ref, { leases, updatedAtMs: now() }, { merge: true });
    }).catch(() => {
      // The lease expires automatically; never mask the provider result with cleanup failure.
    });
  }
}
