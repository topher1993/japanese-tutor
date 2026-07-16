import { auditKoiMediaPersistence } from './persistenceSafety';

export const KOI_CHAT_RETENTION_DAYS = 30;
export const KOI_CHAT_RETENTION_MS = KOI_CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1_000;
export const KOI_MAX_RETAINED_MESSAGES = 200;
export const KOI_MAX_APPROVED_MEMORIES = 20;
const KOI_MAX_MEMORY_TEXT_LENGTH = 500;

export interface KoiRetainableChatMessage {
  id: string;
  createdAt: number;
}

/** Applies both the rolling 30-day window and newest-200 cap. */
export function applyKoiChatRetention<T extends KoiRetainableChatMessage>(
  messages: readonly T[],
  now = Date.now(),
): T[] {
  const cutoff = now - KOI_CHAT_RETENTION_MS;
  const newestById = new Map<string, T>();
  for (const message of messages) {
    if (!message.id.trim()
      || !Number.isSafeInteger(message.createdAt)
      || message.createdAt < cutoff
      || message.createdAt > now
      || !auditKoiMediaPersistence(message).safe) continue;
    const previous = newestById.get(message.id);
    if (!previous || previous.createdAt <= message.createdAt) newestById.set(message.id, message);
  }
  return [...newestById.values()]
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
    .slice(-KOI_MAX_RETAINED_MESSAGES);
}

export type KoiMemoryKind = 'learner-preference' | 'learning-goal' | 'correction' | 'custom';

export interface KoiMemoryCandidate {
  id: string;
  kind: KoiMemoryKind;
  text: string;
  createdAt: number;
  approvedAt?: number;
  approvedByUser: boolean;
  revokedAt?: number;
}

export interface KoiApprovedMemoryV1 {
  schemaVersion: 1;
  id: string;
  kind: KoiMemoryKind;
  text: string;
  createdAt: number;
  approvedAt: number;
  approval: 'explicit-user';
}

function isMemoryKind(value: unknown): value is KoiMemoryKind {
  return value === 'learner-preference'
    || value === 'learning-goal'
    || value === 'correction'
    || value === 'custom';
}

/** Keeps only explicit, non-revoked approvals and whitelists persisted fields. */
export function retainKoiApprovedMemories(
  candidates: readonly KoiMemoryCandidate[],
): KoiApprovedMemoryV1[] {
  const newestById = new Map<string, KoiApprovedMemoryV1>();
  for (const candidate of candidates) {
    const id = candidate.id.trim();
    const text = candidate.text.trim().slice(0, KOI_MAX_MEMORY_TEXT_LENGTH);
    const approvedAt = candidate.approvedAt;
    if (!candidate.approvedByUser
      || candidate.revokedAt !== undefined
      || !id
      || !text
      || !isMemoryKind(candidate.kind)
      || !Number.isSafeInteger(candidate.createdAt)
      || typeof approvedAt !== 'number'
      || !Number.isSafeInteger(approvedAt)
      || approvedAt < candidate.createdAt) continue;
    const memory: KoiApprovedMemoryV1 = {
      schemaVersion: 1,
      id,
      kind: candidate.kind,
      text,
      createdAt: candidate.createdAt,
      approvedAt,
      approval: 'explicit-user',
    };
    const previous = newestById.get(id);
    if (!previous || previous.approvedAt <= memory.approvedAt) newestById.set(id, memory);
  }
  return [...newestById.values()]
    .sort((left, right) => left.approvedAt - right.approvedAt || left.id.localeCompare(right.id))
    .slice(-KOI_MAX_APPROVED_MEMORIES);
}

export interface KoiProgressDisclosure<TSummary, TDetailed> {
  summary: TSummary;
  detailedProgress?: TDetailed;
  detailConsentApplied: boolean;
}

/** Detailed learner progress is omitted unless the user has opted in. */
export function selectKoiProgressDisclosure<TSummary, TDetailed>(
  summary: TSummary,
  detailedProgress: TDetailed,
  detailedProgressConsent: boolean,
): KoiProgressDisclosure<TSummary, TDetailed> {
  if (!detailedProgressConsent) return { summary, detailConsentApplied: false };
  return { summary, detailedProgress, detailConsentApplied: true };
}
