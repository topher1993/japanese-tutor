import type { KoiProviderCapacityBundle } from './providers/types.js';

export type KoiCapacityRefreshDecision =
  | { kind: 'cached'; capacity: KoiProviderCapacityBundle }
  | {
      kind: 'reserved';
      ownerToken: string;
      expiresAtMs: number;
      staleCapacity: KoiProviderCapacityBundle | null;
    }
  | {
      kind: 'in_progress';
      retryAtMs: number;
      staleCapacity: KoiProviderCapacityBundle | null;
    };

const recordFrom = (value: unknown): Record<string, unknown> | null => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const validNonnegative = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
);

const validPercent = (value: unknown): value is number => validNonnegative(value) && value <= 100;

export function parseKoiProviderCapacityBundle(value: unknown): KoiProviderCapacityBundle | null {
  const bundle = recordFrom(value);
  const chat = recordFrom(bundle?.chat);
  const tts = recordFrom(bundle?.tts);
  if (
    !bundle
    || !chat
    || !tts
    || !validPercent(chat.rollingRemainingPercent)
    || (chat.weeklyRemainingPercent !== undefined && !validPercent(chat.weeklyRemainingPercent))
    || !validNonnegative(chat.fetchedAtMs)
    || (chat.retryAtMs !== undefined && !validNonnegative(chat.retryAtMs))
    || !Number.isInteger(tts.remainingCharacters)
    || !validNonnegative(tts.remainingCharacters)
    || !validNonnegative(tts.fetchedAtMs)
    || (tts.retryAtMs !== undefined && !validNonnegative(tts.retryAtMs))
    || !validNonnegative(bundle.fetchedAtMs)
  ) return null;
  return bundle as unknown as KoiProviderCapacityBundle;
}

export function decideKoiCapacityRefresh(
  storedValue: unknown,
  ownerToken: string,
  nowMs: number,
  cacheTtlMs: number,
  refreshLeaseMs: number,
): KoiCapacityRefreshDecision {
  const stored = recordFrom(storedValue);
  const capacity = parseKoiProviderCapacityBundle(stored?.capacity);
  if (capacity && capacity.fetchedAtMs + cacheTtlMs > nowMs) {
    return { kind: 'cached', capacity };
  }
  if (
    typeof stored?.refreshOwnerToken === 'string'
    && typeof stored.refreshExpiresAtMs === 'number'
    && stored.refreshExpiresAtMs > nowMs
  ) {
    return {
      kind: 'in_progress',
      retryAtMs: stored.refreshExpiresAtMs,
      staleCapacity: capacity,
    };
  }
  return {
    kind: 'reserved',
    ownerToken,
    expiresAtMs: nowMs + refreshLeaseMs,
    staleCapacity: capacity,
  };
}

export function ownsKoiCapacityRefresh(storedValue: unknown, ownerToken: string): boolean {
  const stored = recordFrom(storedValue);
  return stored?.refreshOwnerToken === ownerToken;
}
