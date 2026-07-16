import { randomUUID } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

import { KOI_MINIMAX_TTS_DAILY_CHARACTER_LIMIT } from './config.js';

export const KOI_TTS_BUDGET_WINDOW_MS = 24 * 60 * 60 * 1_000;

export interface KoiTtsReservation {
  id: string;
  characterCount: number;
  createdAtMs: number;
}

export interface KoiTtsBudgetDecision {
  allowed: boolean;
  reservations: KoiTtsReservation[];
  remainingCharacters: number;
}

const isReservation = (value: unknown): value is KoiTtsReservation => {
  if (typeof value !== 'object' || value === null) return false;
  const reservation = value as Partial<KoiTtsReservation>;
  return typeof reservation.id === 'string'
    && typeof reservation.characterCount === 'number'
    && Number.isInteger(reservation.characterCount)
    && reservation.characterCount > 0
    && typeof reservation.createdAtMs === 'number'
    && Number.isFinite(reservation.createdAtMs);
};

export function reserveTtsCharacters(
  storedReservations: unknown,
  reservation: KoiTtsReservation,
  nowMs: number,
): KoiTtsBudgetDecision {
  const active = Array.isArray(storedReservations)
    ? storedReservations
      .filter(isReservation)
      .filter((candidate) => candidate.createdAtMs > nowMs - KOI_TTS_BUDGET_WINDOW_MS)
    : [];
  const used = active.reduce((sum, candidate) => sum + candidate.characterCount, 0);
  const remainingCharacters = Math.max(0, KOI_MINIMAX_TTS_DAILY_CHARACTER_LIMIT - used);
  if (
    reservation.characterCount <= 0
    || reservation.characterCount > remainingCharacters
  ) {
    return { allowed: false, reservations: active, remainingCharacters };
  }
  return {
    allowed: true,
    reservations: [...active, reservation],
    remainingCharacters: remainingCharacters - reservation.characterCount,
  };
}

export function getTtsRemainingCharacters(storedReservations: unknown, nowMs: number): number {
  const probe = reserveTtsCharacters(storedReservations, {
    id: 'remaining-probe',
    characterCount: 0,
    createdAtMs: nowMs,
  }, nowMs);
  return probe.remainingCharacters;
}

export async function readTtsRemainingCharacters(db: Firestore, nowMs: number): Promise<number> {
  const snapshot = await db.doc('koiSystem/ttsCharacterBudget').get();
  return getTtsRemainingCharacters(snapshot.data()?.reservations, nowMs);
}

export async function withTtsCharacterReservation<T>(
  db: Firestore,
  characterCount: number,
  work: () => Promise<T>,
  now: () => number = Date.now,
): Promise<{ result: T; remainingCharacters: number } | null> {
  const ref = db.doc('koiSystem/ttsCharacterBudget');
  const reservation: KoiTtsReservation = {
    id: randomUUID(),
    characterCount,
    createdAtMs: now(),
  };
  let remainingCharacters = 0;
  const accepted = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const decision = reserveTtsCharacters(snapshot.data()?.reservations, reservation, now());
    remainingCharacters = decision.remainingCharacters;
    if (!decision.allowed) return false;
    transaction.set(ref, { reservations: decision.reservations, updatedAtMs: now() }, { merge: true });
    return true;
  });
  if (!accepted) return null;

  // Keep the reservation even when the network result is ambiguous. MiniMax may
  // have consumed characters before a timeout, so releasing it could spend Credits.
  return { result: await work(), remainingCharacters };
}
