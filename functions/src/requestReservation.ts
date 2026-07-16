import { createHash } from 'node:crypto';

export interface KoiPendingRequestReservation {
  schemaVersion: 1;
  status: 'pending';
  ownerToken: string;
  payloadFingerprint: string;
  consentEpoch: number;
  createdAtMs: number;
  expiresAtMs: number;
}

export type KoiRequestReservationDecision<T> =
  | { kind: 'cached'; response: T }
  | { kind: 'reserved'; record: KoiPendingRequestReservation }
  | { kind: 'busy'; retryAtMs: number }
  | { kind: 'fingerprint_mismatch' }
  | { kind: 'consent_epoch_mismatch' }
  | { kind: 'corrupt' };

type ResponseParser<T> = (value: unknown) => T | null;

const recordFrom = (value: unknown): Record<string, unknown> | null => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

/**
 * Hash only the semantic payload, never credentials or mutable server state.
 * Including the operation name prevents a UUID reused across callables from
 * accidentally becoming a valid idempotency key for another operation.
 */
export function fingerprintKoiRequestPayload(
  operation: 'ask' | 'synthesize' | 'register' | 'revoke' | 'detailed_progress',
  payload: Readonly<Record<string, string>>,
): string {
  const canonicalEntries = Object.entries(payload).sort(([left], [right]) => left.localeCompare(right));
  return createHash('sha256')
    .update(JSON.stringify({ operation, payload: Object.fromEntries(canonicalEntries) }))
    .digest('hex');
}

export function decideKoiRequestReservation<T>(
  storedValue: unknown,
  payloadFingerprint: string,
  consentEpoch: number,
  ownerToken: string,
  nowMs: number,
  reservationMs: number,
  parseResponse: ResponseParser<T>,
): KoiRequestReservationDecision<T> {
  const stored = recordFrom(storedValue);
  const storedFingerprint = typeof stored?.payloadFingerprint === 'string'
    ? stored.payloadFingerprint
    : null;
  const storedConsentEpoch = typeof stored?.consentEpoch === 'number'
    && Number.isSafeInteger(stored.consentEpoch)
    && stored.consentEpoch >= 1
    ? stored.consentEpoch
    : null;

  if (stored && storedConsentEpoch !== consentEpoch) return { kind: 'consent_epoch_mismatch' };

  if (storedFingerprint !== null && storedFingerprint !== payloadFingerprint) {
    return { kind: 'fingerprint_mismatch' };
  }

  if (stored?.status === 'completed') {
    // Legacy or corrupt completed entries without a payload binding must not
    // authorize a replay or a second provider charge.
    if (storedFingerprint !== payloadFingerprint) return { kind: 'fingerprint_mismatch' };
    const response = parseResponse(stored.response);
    return response === null ? { kind: 'corrupt' } : { kind: 'cached', response };
  }

  if (
    stored?.status === 'pending'
    && typeof stored.expiresAtMs === 'number'
    && Number.isFinite(stored.expiresAtMs)
    && stored.expiresAtMs > nowMs
  ) {
    if (storedFingerprint !== payloadFingerprint) return { kind: 'fingerprint_mismatch' };
    return { kind: 'busy', retryAtMs: stored.expiresAtMs };
  }

  return {
    kind: 'reserved',
    record: {
      schemaVersion: 1,
      status: 'pending',
      ownerToken,
      payloadFingerprint,
      consentEpoch,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + reservationMs,
    },
  };
}

export function ownsKoiRequestReservation(
  storedValue: unknown,
  ownerToken: string,
  payloadFingerprint: string,
  consentEpoch: number,
): boolean {
  const stored = recordFrom(storedValue);
  return stored?.status === 'pending'
    && stored.ownerToken === ownerToken
    && stored.payloadFingerprint === payloadFingerprint
    && stored.consentEpoch === consentEpoch;
}
