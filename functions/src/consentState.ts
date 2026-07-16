export const KOI_CONSENT_PROVIDER_OPERATION_LEASE_MS = 40_000;
export const KOI_CONSENT_REVOCATION_DRAIN_TIMEOUT_MS = 45_000;
export const KOI_CONSENT_REVOCATION_POLL_MS = 100;

export type KoiConsentOperationKind = 'register' | 'revoke' | 'detailed_progress';
export type KoiConsentProviderOperationKind = 'chat' | 'tts';

export interface KoiConsentProviderOperationLease {
  id: string;
  kind: KoiConsentProviderOperationKind;
  consentEpoch: number;
  expiresAtMs: number;
}

export interface KoiConsentOperationRecord {
  schemaVersion: 1;
  operation: KoiConsentOperationKind;
  payloadFingerprint: string;
  status: 'pending' | 'completed';
  consentEpochBefore: number;
  consentEpochAfter?: number;
  response?: unknown;
  createdAtMs: number;
  completedAtMs?: number;
}

const recordFrom = (value: unknown): Record<string, unknown> | null => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const isSafeEpoch = (value: unknown): value is number => (
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
);

const isSafeGeneration = (value: unknown): value is number => (
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

export function parseKoiConsentOperation(value: unknown): KoiConsentOperationRecord | null {
  const record = recordFrom(value);
  if (
    record?.schemaVersion !== 1
    || !['register', 'revoke', 'detailed_progress'].includes(String(record.operation))
    || typeof record.payloadFingerprint !== 'string'
    || !/^[0-9a-f]{64}$/u.test(record.payloadFingerprint)
    || (record.status !== 'pending' && record.status !== 'completed')
    || !isSafeGeneration(record.consentEpochBefore)
    || typeof record.createdAtMs !== 'number'
    || !Number.isSafeInteger(record.createdAtMs)
    || record.createdAtMs < 0
  ) return null;
  if (record.status === 'completed' && (
    !isSafeGeneration(record.consentEpochAfter)
    || record.response === undefined
    || typeof record.completedAtMs !== 'number'
  )) return null;
  return record as unknown as KoiConsentOperationRecord;
}

export type KoiConsentLedgerDecision =
  | { kind: 'new' }
  | { kind: 'pending'; record: KoiConsentOperationRecord }
  | { kind: 'completed'; record: KoiConsentOperationRecord }
  | { kind: 'mismatch' }
  | { kind: 'corrupt' };

export function decideKoiConsentLedgerOperation(
  storedValue: unknown,
  operation: KoiConsentOperationKind,
  payloadFingerprint: string,
): KoiConsentLedgerDecision {
  if (storedValue === undefined) return { kind: 'new' };
  const record = parseKoiConsentOperation(storedValue);
  if (!record) return { kind: 'corrupt' };
  if (record.operation !== operation || record.payloadFingerprint !== payloadFingerprint) {
    return { kind: 'mismatch' };
  }
  return record.status === 'completed'
    ? { kind: 'completed', record }
    : { kind: 'pending', record };
}

export function parseKoiConsentProviderOperationLeases(
  value: unknown,
  nowMs: number,
): KoiConsentProviderOperationLease[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const record = recordFrom(candidate);
    if (
      typeof record?.id !== 'string'
      || (record.kind !== 'chat' && record.kind !== 'tts')
      || !isSafeEpoch(record.consentEpoch)
      || typeof record.expiresAtMs !== 'number'
      || !Number.isSafeInteger(record.expiresAtMs)
      || record.expiresAtMs <= nowMs
    ) return [];
    return [record as unknown as KoiConsentProviderOperationLease];
  });
}

export function ownsKoiConsentProviderOperation(
  storedValue: unknown,
  leaseId: string,
  consentEpoch: number,
  nowMs: number,
): boolean {
  return parseKoiConsentProviderOperationLeases(storedValue, nowMs)
    .some((lease) => lease.id === leaseId && lease.consentEpoch === consentEpoch);
}
