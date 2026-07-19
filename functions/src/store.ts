import { randomUUID } from 'node:crypto';

import {
  Timestamp,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

import {
  KOI_CURRENT_AI_POLICY_VERSION,
  KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION,
  KOI_CURRENT_PRIVACY_POLICY_VERSION,
  askKoiSenseiResponseSchema,
  completeKoiRegistrationResponseSchema,
  koiAllowanceSchema,
  koiLearnerContextSchema,
  revokeKoiConsentResponseSchema,
  setKoiDetailedProgressConsentResponseSchema,
  synthesizeKoiReplyResponseSchema,
  type AskKoiSenseiResponse,
  type CompleteKoiRegistrationRequest,
  type CompleteKoiRegistrationResponse,
  type ExportKoiDataResponse,
  type KoiLearnerContext,
  type KoiPetPresentation,
  type ReportKoiMessageRequest,
  type RevokeKoiConsentResponse,
  type RevokeKoiConsentRequest,
  type SetKoiDetailedProgressConsentRequest,
  type SetKoiDetailedProgressConsentResponse,
  type SynthesizeKoiReplyResponse,
  type UpsertKoiMemoryRequest,
} from '../../shared/koi/contracts.js';
import {
  KOI_CONSENT_PROVIDER_OPERATION_LEASE_MS,
  KOI_CONSENT_REVOCATION_DRAIN_TIMEOUT_MS,
  KOI_CONSENT_REVOCATION_POLL_MS,
  decideKoiConsentLedgerOperation,
  ownsKoiConsentProviderOperation,
  parseKoiConsentProviderOperationLeases,
  type KoiConsentProviderOperationKind,
  type KoiConsentProviderOperationLease,
} from './consentState.js';
import {
  consumeKoiAllowance,
  reconcileKoiAllowanceGrant,
  type KoiAllowanceGrantV1,
  type KoiAllowanceKind,
  type KoiAllowanceLimits,
} from '../../src/features/koi-sensei/api/quotaPolicy.js';
import {
  KOI_ACTIVE_ACCOUNT_LIMIT,
  KOI_ALLOWANCE_REFRESH_COOLDOWN_MS,
  KOI_ALLOWANCE_REFRESH_LEASE_MS,
  KOI_CALLABLE_TIMEOUT_MS,
  KOI_PROVIDER_CAPACITY_CACHE_TTL_MS,
  KOI_PROVIDER_CAPACITY_REFRESH_LEASE_MS,
} from './config.js';
import { KoiBackendError } from './errors.js';
import {
  decideKoiAllowanceRefresh,
  ownsKoiAllowanceRefresh,
  type KoiAllowanceRefreshState,
} from './allowanceRefresh.js';
import {
  decideKoiCapacityRefresh,
  ownsKoiCapacityRefresh,
  parseKoiProviderCapacityBundle,
} from './providerCapacityCache.js';
import type { KoiProviderCapacityBundle } from './providers/types.js';
import {
  decideKoiRequestReservation,
  fingerprintKoiRequestPayload,
  ownsKoiRequestReservation,
} from './requestReservation.js';

export const KOI_CHAT_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const KOI_REPORT_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;
export const KOI_MAX_STORED_MESSAGES = 200;
export const KOI_MAX_USER_APPROVED_MEMORIES = 20;
// Must outlive the 60-second callable deadline so an old invocation cannot be
// reclaimed while its provider request is still unwinding.
export const KOI_REQUEST_RESERVATION_MS = KOI_CALLABLE_TIMEOUT_MS + 30_000;
export const KOI_TTS_RESULT_RETENTION_MS = 24 * 60 * 60 * 1_000;

export type KoiRequestReservation<T> =
  | { kind: 'cached'; response: T }
  | { kind: 'reserved'; ownerToken: string };

export interface RegistrationRecord {
  schemaVersion: 1;
  status: 'active' | 'waitlisted';
  ageBand: '16_17' | '18_plus';
  supportLanguage: 'en' | 'vi' | 'tl';
  aiPolicyVersion: string;
  privacyPolicyVersion: string;
  acknowledgedUsProcessing: true;
  consentStatus: 'granted' | 'revoked';
  consentedAtMs: number;
  consentEpoch: number;
  cleanupPending: boolean;
  detailedProgressConsentStatus: 'granted' | 'revoked';
  detailedProgressPolicyVersion: typeof KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION | null;
  detailedProgressConsentedAtMs: number | null;
  detailedProgressEpoch: number;
  deletionState?: 'deleting';
  revocationPending?: {
    requestId: string;
    payloadFingerprint: string;
    consentEpoch: number;
    startedAtMs: number;
  };
  providerOperationLeases?: KoiConsentProviderOperationLease[];
  revokedAtMs?: number;
  createdAtMs: number;
  updatedAtMs: number;
}

interface StoredMemory {
  schemaVersion: 1;
  category: 'goal' | 'preference' | 'recurring_mistake' | 'useful_phrase';
  text: string;
  approvedByUserAtMs: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface KoiAdmissionDecision {
  status: 'active' | 'waitlisted';
  incrementActiveCount: boolean;
}

export interface KoiDeletionDecision {
  shouldMarkDeleting: boolean;
  nextActiveCount: number;
}

export function decideKoiDeletion(
  storedRegistration: DocumentData | undefined,
  activeCount: number,
): KoiDeletionDecision {
  if (!storedRegistration || storedRegistration.deletionState === 'deleting') {
    return { shouldMarkDeleting: false, nextActiveCount: activeCount };
  }
  return {
    shouldMarkDeleting: true,
    nextActiveCount: storedRegistration.status === 'active'
      ? Math.max(0, activeCount - 1)
      : activeCount,
  };
}

export function decideKoiAdmission(
  existingStatus: 'active' | 'waitlisted' | null,
  activeCount: number,
): KoiAdmissionDecision {
  if (existingStatus === 'active') return { status: 'active', incrementActiveCount: false };
  if (activeCount >= KOI_ACTIVE_ACCOUNT_LIMIT) {
    return { status: 'waitlisted', incrementActiveCount: false };
  }
  return { status: 'active', incrementActiveCount: true };
}

export const registrationFrom = (data: DocumentData | undefined): RegistrationRecord | null => {
  if (
    data?.schemaVersion !== 1
    || (data.status !== 'active' && data.status !== 'waitlisted')
    || (data.ageBand !== '16_17' && data.ageBand !== '18_plus')
    || !['en', 'vi', 'tl'].includes(data.supportLanguage)
    || typeof data.aiPolicyVersion !== 'string'
    || typeof data.privacyPolicyVersion !== 'string'
    || data.acknowledgedUsProcessing !== true
    || typeof data.createdAtMs !== 'number'
    || typeof data.updatedAtMs !== 'number'
    || (data.consentStatus !== 'granted' && data.consentStatus !== 'revoked')
    || typeof data.consentedAtMs !== 'number'
    || !Number.isInteger(data.consentEpoch)
    || data.consentEpoch < 1
    || typeof data.cleanupPending !== 'boolean'
    || (data.detailedProgressConsentStatus !== 'granted' && data.detailedProgressConsentStatus !== 'revoked')
    || (data.detailedProgressPolicyVersion !== null
      && data.detailedProgressPolicyVersion !== KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION)
    || (data.detailedProgressConsentedAtMs !== null
      && typeof data.detailedProgressConsentedAtMs !== 'number')
    || !Number.isInteger(data.detailedProgressEpoch)
    || data.detailedProgressEpoch < 0
    || (data.deletionState !== undefined && data.deletionState !== 'deleting')
  ) return null;
  return data as RegistrationRecord;
};

export type KoiRegistrationAccess = 'active' | 'missing' | 'waitlisted' | 'consent_required';

export const isKoiRegistrationCleanupPending = (data: DocumentData | undefined): boolean => (
  data?.cleanupPending === true || data?.deletionState === 'deleting' || data?.revocationPending !== undefined
);

export function evaluateKoiRegistrationAccess(data: DocumentData | undefined): KoiRegistrationAccess {
  const registration = registrationFrom(data);
  if (!registration) return 'missing';
  if (registration.status !== 'active') return 'waitlisted';
  if (
    registration.consentStatus !== 'granted'
    || registration.cleanupPending
    || registration.deletionState === 'deleting'
    || registration.aiPolicyVersion !== KOI_CURRENT_AI_POLICY_VERSION
    || registration.privacyPolicyVersion !== KOI_CURRENT_PRIVACY_POLICY_VERSION
  ) return 'consent_required';
  return 'active';
}

const requireActiveRegistrationData = (data: DocumentData | undefined): RegistrationRecord => {
  const registration = registrationFrom(data);
  const access = evaluateKoiRegistrationAccess(data);
  if (access === 'missing') {
    throw new KoiBackendError('CONSENT_REQUIRED', 'Complete Koi Sensei registration and consent first.');
  }
  if (access === 'waitlisted') {
    throw new KoiBackendError('BETA_WAITLISTED', 'The 50-person Koi Sensei beta is currently full.');
  }
  if (access === 'consent_required' || !registration) {
    throw new KoiBackendError('CONSENT_REQUIRED', 'Accept the current Koi AI and privacy notices first.');
  }
  return registration;
};

const requireConsentProviderOperationData = (
  data: DocumentData | undefined,
  leaseId: string,
  consentEpoch: number,
  nowMs: number,
): RegistrationRecord => {
  const registration = registrationFrom(data);
  if (
    !registration
    || registration.deletionState === 'deleting'
    || registration.consentStatus !== 'granted'
    || registration.consentEpoch !== consentEpoch
    || registration.aiPolicyVersion !== KOI_CURRENT_AI_POLICY_VERSION
    || registration.privacyPolicyVersion !== KOI_CURRENT_PRIVACY_POLICY_VERSION
    || !ownsKoiConsentProviderOperation(
      registration.providerOperationLeases,
      leaseId,
      consentEpoch,
      nowMs,
    )
  ) throw new KoiBackendError('CONSENT_REQUIRED', 'The consent generation changed during this Koi answer.');
  return registration;
};

export function refreshKoiRegistration(
  existing: RegistrationRecord | null,
  status: RegistrationRecord['status'],
  input: Pick<CompleteKoiRegistrationRequest, 'ageBand' | 'supportLanguage'>,
  nowMs: number,
  legacyCreatedAtMs?: number,
): RegistrationRecord {
  const preservesCurrentConsent = existing?.consentStatus === 'granted'
    && existing.aiPolicyVersion === KOI_CURRENT_AI_POLICY_VERSION
    && existing.privacyPolicyVersion === KOI_CURRENT_PRIVACY_POLICY_VERSION
    && !existing.cleanupPending
    && existing.deletionState !== 'deleting';
  return {
    schemaVersion: 1,
    status,
    ageBand: input.ageBand,
    supportLanguage: input.supportLanguage,
    aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
    privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
    acknowledgedUsProcessing: true,
    consentStatus: 'granted',
    consentedAtMs: nowMs,
    consentEpoch: preservesCurrentConsent ? existing.consentEpoch : (existing?.consentEpoch ?? 0) + 1,
    cleanupPending: false,
    detailedProgressConsentStatus: preservesCurrentConsent
      ? existing.detailedProgressConsentStatus
      : 'revoked',
    detailedProgressPolicyVersion: preservesCurrentConsent
      ? existing.detailedProgressPolicyVersion
      : null,
    detailedProgressConsentedAtMs: preservesCurrentConsent
      ? existing.detailedProgressConsentedAtMs
      : null,
    detailedProgressEpoch: existing?.detailedProgressEpoch ?? 0,
    createdAtMs: existing?.createdAtMs ?? legacyCreatedAtMs ?? nowMs,
    updatedAtMs: nowMs,
  };
}

export function revokeKoiRegistration(
  existing: RegistrationRecord,
  nowMs: number,
): RegistrationRecord {
  const revoked: RegistrationRecord = {
    ...existing,
    consentStatus: 'revoked',
    consentEpoch: existing.consentEpoch + 1,
    cleanupPending: true,
    detailedProgressConsentStatus: 'revoked',
    detailedProgressPolicyVersion: null,
    detailedProgressConsentedAtMs: null,
    detailedProgressEpoch: existing.detailedProgressEpoch + 1,
    revokedAtMs: nowMs,
    updatedAtMs: nowMs,
  };
  delete revoked.revocationPending;
  revoked.providerOperationLeases = [];
  return revoked;
}

const memoryFrom = (data: DocumentData | undefined): StoredMemory | null => {
  if (
    data?.schemaVersion !== 1
    || !['goal', 'preference', 'recurring_mistake', 'useful_phrase'].includes(data.category)
    || typeof data.text !== 'string'
    || typeof data.createdAtMs !== 'number'
    || typeof data.updatedAtMs !== 'number'
  ) return null;
  return data as StoredMemory;
};

const allowanceFrom = (data: DocumentData | undefined): KoiAllowanceGrantV1 | null => {
  const parsed = koiAllowanceSchema.safeParse(data?.grant);
  if (!parsed.success) return null;
  return {
    schemaVersion: 1,
    grantedAtMs: parsed.data.grantedAtMs,
    expiresAtMs: parsed.data.expiresAtMs,
    chatLimit: parsed.data.chatLimit,
    chatUsed: parsed.data.chatUsed,
    voiceLimit: parsed.data.voiceLimit,
    voiceUsed: parsed.data.voiceUsed,
    capacityBand: parsed.data.capacityBand,
    usageMode: parsed.data.usageMode ?? 'metered',
  };
};

const allowanceRefreshStateFrom = (data: DocumentData | undefined): KoiAllowanceRefreshState => ({
  grant: allowanceFrom(data),
  lastRefreshAtMs: typeof data?.lastRefreshAtMs === 'number' ? data.lastRefreshAtMs : null,
  refreshOwnerToken: typeof data?.refreshOwnerToken === 'string' ? data.refreshOwnerToken : null,
  refreshExpiresAtMs: typeof data?.refreshExpiresAtMs === 'number' ? data.refreshExpiresAtMs : null,
});

export class KoiStore {
  constructor(private readonly db: Firestore) {}

  private userRef(uid: string) {
    return this.db.doc(`koiUsers/${uid}`);
  }

  async completeRegistration(
    uid: string,
    input: CompleteKoiRegistrationRequest,
    nowMs: number,
  ): Promise<CompleteKoiRegistrationResponse> {
    const userRef = this.userRef(uid);
    const admissionRef = this.db.doc('koiSystem/admission');
    const operationRef = userRef.collection('consentOperations').doc(input.requestId);
    const payloadFingerprint = fingerprintKoiRequestPayload('register', {
      acknowledgedUsProcessing: String(input.acknowledgedUsProcessing),
      ageBand: input.ageBand,
      aiPolicyVersion: input.aiPolicyVersion,
      privacyPolicyVersion: input.privacyPolicyVersion,
      supportLanguage: input.supportLanguage,
    });
    return this.db.runTransaction(async (transaction) => {
      const [userSnapshot, admissionSnapshot, operationSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(admissionRef),
        transaction.get(operationRef),
      ]);
      const ledgerDecision = decideKoiConsentLedgerOperation(
        operationSnapshot.data(),
        'register',
        payloadFingerprint,
      );
      if (ledgerDecision.kind === 'mismatch') {
        throw new KoiBackendError('INVALID_REQUEST', 'This consent requestId was used with different content.');
      }
      if (ledgerDecision.kind === 'corrupt') {
        throw new KoiBackendError('INTERNAL', 'The stored registration operation is invalid.');
      }
      if (ledgerDecision.kind === 'pending') {
        throw new KoiBackendError('TOKEN_PLAN_BUSY', 'This registration operation is still in progress.');
      }
      if (ledgerDecision.kind === 'completed') {
        const response = completeKoiRegistrationResponseSchema.safeParse(ledgerDecision.record.response);
        const current = registrationFrom(userSnapshot.data());
        if (
          !response.success
          || !current
          || current.consentStatus !== 'granted'
          || isKoiRegistrationCleanupPending(userSnapshot.data())
          || current.consentEpoch !== ledgerDecision.record.consentEpochAfter
        ) {
          throw new KoiBackendError(
            'INVALID_REQUEST',
            'This registration requestId belongs to an older consent generation.',
          );
        }
        return response.data;
      }
      const storedCount = admissionSnapshot.data()?.activeCount;
      const activeCount = Number.isInteger(storedCount) && storedCount >= 0 ? storedCount : 0;
      const rawRegistration = userSnapshot.data();
      if (isKoiRegistrationCleanupPending(rawRegistration)) {
        throw new KoiBackendError('TOKEN_PLAN_BUSY', 'Koi consent cleanup is still in progress.');
      }
      const existing = registrationFrom(rawRegistration);
      const legacyStatus = rawRegistration?.status === 'active' || rawRegistration?.status === 'waitlisted'
        ? rawRegistration.status
        : null;
      const decision = decideKoiAdmission(existing?.status ?? legacyStatus, activeCount);
      const nextStatus = decision.status;
      const legacyCreatedAtMs = typeof rawRegistration?.createdAtMs === 'number'
        ? rawRegistration.createdAtMs
        : undefined;
      const refreshed = refreshKoiRegistration(existing, nextStatus, input, nowMs, legacyCreatedAtMs);
      const response: CompleteKoiRegistrationResponse = {
        schemaVersion: 1,
        status: refreshed.status,
        activeAccountLimit: KOI_ACTIVE_ACCOUNT_LIMIT,
        aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
        privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
        consentedAtMs: refreshed.consentedAtMs,
        serverTimeMs: nowMs,
      };
      transaction.set(userRef, refreshed);
      transaction.create(operationRef, {
        schemaVersion: 1,
        operation: 'register',
        payloadFingerprint,
        status: 'completed',
        consentEpochBefore: existing?.consentEpoch ?? refreshed.consentEpoch,
        consentEpochAfter: refreshed.consentEpoch,
        response,
        createdAtMs: nowMs,
        completedAtMs: nowMs,
      });
      if (decision.incrementActiveCount) {
        transaction.set(admissionRef, {
          schemaVersion: 1,
          activeCount: activeCount + 1,
          limit: KOI_ACTIVE_ACCOUNT_LIMIT,
          updatedAtMs: nowMs,
        }, { merge: true });
      }
      return response;
    });
  }

  async requireActiveRegistration(uid: string): Promise<RegistrationRecord> {
    const snapshot = await this.userRef(uid).get();
    return requireActiveRegistrationData(snapshot.data());
  }

  async reserveConsentProviderOperation(
    uid: string,
    expectedConsentEpoch: number,
    kind: KoiConsentProviderOperationKind,
    nowMs: number,
  ): Promise<KoiConsentProviderOperationLease> {
    const userRef = this.userRef(uid);
    const lease: KoiConsentProviderOperationLease = {
      id: randomUUID(),
      kind,
      consentEpoch: expectedConsentEpoch,
      expiresAtMs: nowMs + KOI_CONSENT_PROVIDER_OPERATION_LEASE_MS,
    };
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef);
      const registration = requireActiveRegistrationData(snapshot.data());
      if (registration.consentEpoch !== expectedConsentEpoch) {
        throw new KoiBackendError('CONSENT_REQUIRED', 'The Koi consent generation is stale.');
      }
      const active = parseKoiConsentProviderOperationLeases(
        registration.providerOperationLeases,
        nowMs,
      );
      transaction.set(userRef, {
        providerOperationLeases: [...active, lease],
        updatedAtMs: nowMs,
      }, { merge: true });
    });
    return lease;
  }

  async releaseConsentProviderOperation(
    uid: string,
    leaseId: string,
    nowMs: number,
  ): Promise<void> {
    const userRef = this.userRef(uid);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef);
      const active = parseKoiConsentProviderOperationLeases(
        snapshot.data()?.providerOperationLeases,
        nowMs,
      ).filter((lease) => lease.id !== leaseId);
      if (!snapshot.exists) return;
      transaction.set(userRef, { providerOperationLeases: active, updatedAtMs: nowMs }, { merge: true });
    });
  }

  async revokeConsent(
    uid: string,
    input: RevokeKoiConsentRequest,
    nowMs: number,
  ): Promise<RevokeKoiConsentResponse> {
    const userRef = this.userRef(uid);
    const operationRef = userRef.collection('consentOperations').doc(input.requestId);
    const payloadFingerprint = fingerprintKoiRequestPayload('revoke', {
      confirmation: input.confirmation,
    });
    const response: RevokeKoiConsentResponse = {
      schemaVersion: 1,
      requestId: input.requestId,
      revoked: true,
      serverTimeMs: nowMs,
    };

    const preparation = await this.db.runTransaction(async (transaction) => {
      const [userSnapshot, operationSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(operationRef),
      ]);
      const raw = userSnapshot.data();
      const ledgerDecision = decideKoiConsentLedgerOperation(
        operationSnapshot.data(),
        'revoke',
        payloadFingerprint,
      );
      if (ledgerDecision.kind === 'mismatch') {
        throw new KoiBackendError('INVALID_REQUEST', 'This consent requestId was used for another operation.');
      }
      if (ledgerDecision.kind === 'corrupt') {
        throw new KoiBackendError('INTERNAL', 'The stored revocation operation is invalid.');
      }
      if (ledgerDecision.kind === 'completed') {
        const cached = revokeKoiConsentResponseSchema.safeParse(ledgerDecision.record.response);
        const current = registrationFrom(raw);
        if (
          !cached.success
          || !current
          || current.consentStatus !== 'revoked'
          || current.consentEpoch !== ledgerDecision.record.consentEpochAfter
        ) {
          throw new KoiBackendError(
            'INVALID_REQUEST',
            'This revocation requestId belongs to an older consent generation.',
          );
        }
        return {
          kind: 'completed' as const,
          consentEpochBefore: ledgerDecision.record.consentEpochBefore,
          consentEpochAfter: ledgerDecision.record.consentEpochAfter,
          response: cached.data,
        };
      }
      if (ledgerDecision.kind === 'pending') {
        if (
          raw?.revocationPending?.requestId !== input.requestId
          || raw.revocationPending.payloadFingerprint !== payloadFingerprint
          || raw.revocationPending.consentEpoch !== ledgerDecision.record.consentEpochBefore
        ) throw new KoiBackendError('INTERNAL', 'The pending revocation state is inconsistent.');
        return {
          kind: 'pending' as const,
          consentEpochBefore: ledgerDecision.record.consentEpochBefore,
        };
      }

      const existing = registrationFrom(raw);
      if (!existing || existing.deletionState === 'deleting') {
        throw new KoiBackendError('CONSENT_REQUIRED', 'No Koi consent registration is available to revoke.');
      }
      if (existing.revocationPending) {
        throw new KoiBackendError('TOKEN_PLAN_BUSY', 'Another Koi consent revocation is in progress.');
      }
      if (existing.consentStatus === 'revoked') {
        transaction.set(userRef, { cleanupPending: true, updatedAtMs: nowMs }, { merge: true });
        transaction.create(operationRef, {
          schemaVersion: 1,
          operation: 'revoke',
          payloadFingerprint,
          status: 'completed',
          consentEpochBefore: existing.consentEpoch,
          consentEpochAfter: existing.consentEpoch,
          response,
          createdAtMs: nowMs,
          completedAtMs: nowMs,
        });
        return {
          kind: 'completed' as const,
          consentEpochBefore: existing.consentEpoch,
          consentEpochAfter: existing.consentEpoch,
          response,
        };
      }
      const revocationPending = {
        requestId: input.requestId,
        payloadFingerprint,
        consentEpoch: existing.consentEpoch,
        startedAtMs: nowMs,
      };
      transaction.set(userRef, {
        cleanupPending: true,
        revocationPending,
        updatedAtMs: nowMs,
      }, { merge: true });
      transaction.create(operationRef, {
        schemaVersion: 1,
        operation: 'revoke',
        payloadFingerprint,
        status: 'pending',
        consentEpochBefore: existing.consentEpoch,
        createdAtMs: nowMs,
      });
      return { kind: 'pending' as const, consentEpochBefore: existing.consentEpoch };
    });

    let revokedEpoch = preparation.kind === 'completed'
      ? preparation.consentEpochAfter
      : preparation.consentEpochBefore;

    if (preparation.kind === 'pending') {
      const deadlineMs = Date.now() + KOI_CONSENT_REVOCATION_DRAIN_TIMEOUT_MS;
      while (true) {
        const snapshot = await userRef.get();
        const activeLeases = parseKoiConsentProviderOperationLeases(
          snapshot.data()?.providerOperationLeases,
          Date.now(),
        ).filter((lease) => lease.consentEpoch === preparation.consentEpochBefore);
        if (activeLeases.length === 0) break;
        const retryAtMs = Math.min(...activeLeases.map((lease) => lease.expiresAtMs));
        if (Date.now() >= deadlineMs) {
          throw new KoiBackendError('TOKEN_PLAN_BUSY', 'Koi is finishing an in-progress answer.', retryAtMs);
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, Math.min(KOI_CONSENT_REVOCATION_POLL_MS, Math.max(1, retryAtMs - Date.now())));
        });
      }

      revokedEpoch = await this.db.runTransaction(async (transaction) => {
        const [userSnapshot, operationSnapshot] = await Promise.all([
          transaction.get(userRef),
          transaction.get(operationRef),
        ]);
        const ledgerDecision = decideKoiConsentLedgerOperation(
          operationSnapshot.data(),
          'revoke',
          payloadFingerprint,
        );
        if (ledgerDecision.kind === 'completed') {
          return ledgerDecision.record.consentEpochAfter as number;
        }
        if (ledgerDecision.kind !== 'pending') {
          throw new KoiBackendError('INTERNAL', 'The revocation operation could not be finalized.');
        }
        const current = registrationFrom(userSnapshot.data());
        if (
          !current
          || current.consentEpoch !== preparation.consentEpochBefore
          || current.revocationPending?.requestId !== input.requestId
          || current.revocationPending.payloadFingerprint !== payloadFingerprint
        ) throw new KoiBackendError('INVALID_REQUEST', 'The consent generation changed during revocation.');
        const activeLeases = parseKoiConsentProviderOperationLeases(
          current.providerOperationLeases,
          Date.now(),
        ).filter((lease) => lease.consentEpoch === preparation.consentEpochBefore);
        if (activeLeases.length > 0) {
          throw new KoiBackendError(
            'TOKEN_PLAN_BUSY',
            'Koi is finishing an in-progress answer.',
            Math.min(...activeLeases.map((lease) => lease.expiresAtMs)),
          );
        }
        const revoked = revokeKoiRegistration(current, nowMs);
        transaction.set(userRef, revoked);
        transaction.set(operationRef, {
          status: 'completed',
          consentEpochAfter: revoked.consentEpoch,
          response,
          completedAtMs: nowMs,
        }, { merge: true });
        return revoked.consentEpoch;
      });
    }

    // Registration is retained so a learner can re-consent without creating a
    // second beta seat. AI-derived and approved-memory data is removed.
    await Promise.all([
      'private',
      'koiRequests',
      'koiTtsRequests',
      'koiMessages',
      'koiMemories',
      'koiReports',
    ].map((collection) => this.db.recursiveDelete(userRef.collection(collection))));

    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef);
      const raw = snapshot.data();
      if (
        raw?.deletionState === 'deleting'
        || raw?.consentStatus !== 'revoked'
        || raw?.consentEpoch !== revokedEpoch
      ) return;
      transaction.set(userRef, { cleanupPending: false, updatedAtMs: nowMs }, { merge: true });
    });

    return preparation.kind === 'completed' ? preparation.response : response;
  }

  async setDetailedProgressConsent(
    uid: string,
    input: SetKoiDetailedProgressConsentRequest,
    nowMs: number,
  ): Promise<SetKoiDetailedProgressConsentResponse> {
    const userRef = this.userRef(uid);
    const operationRef = userRef.collection('consentOperations').doc(input.requestId);
    const contextRef = userRef.collection('private').doc('learnerContext');
    const payloadFingerprint = fingerprintKoiRequestPayload('detailed_progress', {
      enabled: String(input.enabled),
      policyVersion: input.enabled ? input.policyVersion : 'revoked',
    });
    return this.db.runTransaction(async (transaction) => {
      const [userSnapshot, operationSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(operationRef),
      ]);
      const ledgerDecision = decideKoiConsentLedgerOperation(
        operationSnapshot.data(),
        'detailed_progress',
        payloadFingerprint,
      );
      if (ledgerDecision.kind === 'mismatch') {
        throw new KoiBackendError('INVALID_REQUEST', 'This detailed-progress requestId was reused.');
      }
      if (ledgerDecision.kind === 'corrupt') {
        throw new KoiBackendError('INTERNAL', 'The detailed-progress consent operation is invalid.');
      }
      if (ledgerDecision.kind === 'pending') {
        throw new KoiBackendError('TOKEN_PLAN_BUSY', 'Detailed-progress consent is still updating.');
      }
      const registration = requireActiveRegistrationData(userSnapshot.data());
      if (ledgerDecision.kind === 'completed') {
        const cached = setKoiDetailedProgressConsentResponseSchema.safeParse(ledgerDecision.record.response);
        if (
          !cached.success
          || registration.detailedProgressEpoch !== ledgerDecision.record.consentEpochAfter
        ) {
          throw new KoiBackendError(
            'INVALID_REQUEST',
            'This detailed-progress requestId belongs to an older consent generation.',
          );
        }
        return cached.data;
      }

      const nextDetailedEpoch = registration.detailedProgressEpoch + 1;
      const response: SetKoiDetailedProgressConsentResponse = {
        schemaVersion: 1,
        requestId: input.requestId,
        enabled: input.enabled,
        policyVersion: input.enabled ? KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION : null,
        serverTimeMs: nowMs,
      };
      transaction.set(userRef, {
        detailedProgressConsentStatus: input.enabled ? 'granted' : 'revoked',
        detailedProgressPolicyVersion: input.enabled ? KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION : null,
        detailedProgressConsentedAtMs: input.enabled ? nowMs : null,
        detailedProgressEpoch: nextDetailedEpoch,
        updatedAtMs: nowMs,
      }, { merge: true });
      if (!input.enabled) transaction.delete(contextRef);
      transaction.create(operationRef, {
        schemaVersion: 1,
        operation: 'detailed_progress',
        payloadFingerprint,
        status: 'completed',
        consentEpochBefore: registration.detailedProgressEpoch,
        consentEpochAfter: nextDetailedEpoch,
        response,
        createdAtMs: nowMs,
        completedAtMs: nowMs,
      });
      return response;
    });
  }

  async syncLearnerContext(uid: string, context: KoiLearnerContext, nowMs: number): Promise<number> {
    const ref = this.userRef(uid).collection('private').doc('learnerContext');
    return this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, snapshot] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      const registration = requireActiveRegistrationData(registrationSnapshot.data());
      if (
        registration.detailedProgressConsentStatus !== 'granted'
        || registration.detailedProgressPolicyVersion !== KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION
        || registration.detailedProgressConsentedAtMs === null
      ) {
        throw new KoiBackendError(
          'DETAILED_PROGRESS_CONSENT_REQUIRED',
          'Enable the current detailed-progress consent before syncing learning data.',
        );
      }
      const snapshotData = snapshot.data();
      const current = snapshotData?.consentEpoch === registration.consentEpoch
        && snapshotData?.detailedProgressEpoch === registration.detailedProgressEpoch
        && snapshotData?.detailedProgressPolicyVersion === KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION
        ? koiLearnerContextSchema.safeParse(snapshotData.context)
        : null;
      const currentRevision = current?.success ? current.data.revision : -1;
      if (context.revision < currentRevision) return currentRevision;
      transaction.set(ref, {
        schemaVersion: 1,
        consentEpoch: registration.consentEpoch,
        detailedProgressEpoch: registration.detailedProgressEpoch,
        detailedProgressPolicyVersion: KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION,
        context: {
          ...context,
          consentVersion: KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION,
        },
        updatedAtMs: nowMs,
      });
      return context.revision;
    });
  }

  /** Syncs presentation-only pet state. It intentionally excludes coins,
   * bond, progression, and claims so this endpoint cannot mint rewards. */
  async syncPetPresentation(uid: string, presentation: KoiPetPresentation, nowMs: number): Promise<number> {
    const ref = this.userRef(uid).collection('private').doc('petPresentation');
    return this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, snapshot] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      const registration = requireActiveRegistrationData(registrationSnapshot.data());
      const currentRevision = typeof snapshot.data()?.presentation?.revision === 'number'
        && Number.isSafeInteger(snapshot.data()?.presentation?.revision)
        ? snapshot.data()?.presentation?.revision as number
        : -1;
      if (presentation.revision < currentRevision) return currentRevision;
      transaction.set(ref, {
        schemaVersion: 1,
        consentEpoch: registration.consentEpoch,
        presentation,
        updatedAtMs: nowMs,
      });
      return presentation.revision;
    });
  }

  async getLearnerContext(uid: string): Promise<KoiLearnerContext | null> {
    const userRef = this.userRef(uid);
    const contextRef = userRef.collection('private').doc('learnerContext');
    return this.db.runTransaction(async (transaction) => {
      const [userSnapshot, contextSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(contextRef),
      ]);
      const registration = registrationFrom(userSnapshot.data());
      const data = contextSnapshot.data();
      if (
        !registration
        || evaluateKoiRegistrationAccess(userSnapshot.data()) !== 'active'
        || registration.detailedProgressConsentStatus !== 'granted'
        || registration.detailedProgressPolicyVersion !== KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION
        || data?.consentEpoch !== registration.consentEpoch
        || data?.detailedProgressEpoch !== registration.detailedProgressEpoch
        || data?.detailedProgressPolicyVersion !== KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION
      ) return null;
      const parsed = koiLearnerContextSchema.safeParse(data.context);
      return parsed.success ? parsed.data : null;
    });
  }

  async reserveProviderCapacityRefresh(nowMs: number) {
    const ref = this.db.doc('koiSystem/providerCapacity');
    const ownerToken = randomUUID();
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const decision = decideKoiCapacityRefresh(
        snapshot.data(),
        ownerToken,
        nowMs,
        KOI_PROVIDER_CAPACITY_CACHE_TTL_MS,
        KOI_PROVIDER_CAPACITY_REFRESH_LEASE_MS,
      );
      if (decision.kind === 'reserved') {
        transaction.set(ref, {
          schemaVersion: 1,
          refreshOwnerToken: decision.ownerToken,
          refreshExpiresAtMs: decision.expiresAtMs,
          updatedAtMs: nowMs,
        }, { merge: true });
      }
      return decision;
    });
  }

  async completeProviderCapacityRefresh(
    ownerToken: string,
    capacity: KoiProviderCapacityBundle,
    nowMs: number,
  ): Promise<void> {
    if (!parseKoiProviderCapacityBundle(capacity)) {
      throw new KoiBackendError('INTERNAL', 'The provider returned an invalid capacity snapshot.');
    }
    const ref = this.db.doc('koiSystem/providerCapacity');
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!ownsKoiCapacityRefresh(snapshot.data(), ownerToken)) {
        throw new KoiBackendError('TOKEN_PLAN_BUSY', 'The capacity refresh was superseded by another request.');
      }
      transaction.set(ref, {
        schemaVersion: 1,
        capacity,
        refreshOwnerToken: null,
        refreshExpiresAtMs: 0,
        updatedAtMs: nowMs,
      }, { merge: true });
    });
  }

  async releaseProviderCapacityRefresh(ownerToken: string, nowMs: number): Promise<void> {
    const ref = this.db.doc('koiSystem/providerCapacity');
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!ownsKoiCapacityRefresh(snapshot.data(), ownerToken)) return;
      transaction.set(ref, {
        refreshOwnerToken: null,
        refreshExpiresAtMs: 0,
        updatedAtMs: nowMs,
      }, { merge: true });
    });
  }

  async reserveAllowanceRefresh(uid: string, nowMs: number) {
    const ref = this.userRef(uid).collection('private').doc('allowance');
    const ownerToken = randomUUID();
    return this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, snapshot] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      requireActiveRegistrationData(registrationSnapshot.data());
      const decision = decideKoiAllowanceRefresh(
        allowanceRefreshStateFrom(snapshot.data()),
        ownerToken,
        nowMs,
        KOI_ALLOWANCE_REFRESH_COOLDOWN_MS,
        KOI_ALLOWANCE_REFRESH_LEASE_MS,
      );
      if (decision.kind === 'reserved') {
        transaction.set(ref, {
          schemaVersion: 1,
          refreshOwnerToken: decision.ownerToken,
          refreshExpiresAtMs: decision.expiresAtMs,
          updatedAtMs: nowMs,
        }, { merge: true });
      }
      return decision;
    });
  }

  async completeAllowanceRefresh(
    uid: string,
    ownerToken: string,
    limits: KoiAllowanceLimits,
    nowMs: number,
  ): Promise<KoiAllowanceGrantV1> {
    const ref = this.userRef(uid).collection('private').doc('allowance');
    return this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, snapshot] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      requireActiveRegistrationData(registrationSnapshot.data());
      const state = allowanceRefreshStateFrom(snapshot.data());
      if (!ownsKoiAllowanceRefresh(state, ownerToken)) {
        if (state.grant && state.grant.expiresAtMs > nowMs) return state.grant;
        throw new KoiBackendError('TOKEN_PLAN_BUSY', 'The allowance refresh was superseded by another request.');
      }
      const grant = reconcileKoiAllowanceGrant(state.grant, limits, nowMs);
      transaction.set(ref, {
        schemaVersion: 1,
        grant,
        lastRefreshAtMs: nowMs,
        refreshOwnerToken: null,
        refreshExpiresAtMs: 0,
        updatedAtMs: nowMs,
      }, { merge: true });
      return grant;
    });
  }

  async releaseAllowanceRefresh(uid: string, ownerToken: string, nowMs: number): Promise<void> {
    const ref = this.userRef(uid).collection('private').doc('allowance');
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!ownsKoiAllowanceRefresh(allowanceRefreshStateFrom(snapshot.data()), ownerToken)) return;
      transaction.set(ref, {
        refreshOwnerToken: null,
        refreshExpiresAtMs: 0,
        updatedAtMs: nowMs,
      }, { merge: true });
    });
  }

  async reconcileAllowance(
    uid: string,
    limits: KoiAllowanceLimits,
    nowMs: number,
  ): Promise<KoiAllowanceGrantV1> {
    const ref = this.userRef(uid).collection('private').doc('allowance');
    return this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, snapshot] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      requireActiveRegistrationData(registrationSnapshot.data());
      const grant = reconcileKoiAllowanceGrant(allowanceFrom(snapshot.data()), limits, nowMs);
      transaction.set(ref, { schemaVersion: 1, grant, updatedAtMs: nowMs }, { merge: true });
      return grant;
    });
  }

  async consumeAllowance(
    uid: string,
    kind: KoiAllowanceKind,
    limits: KoiAllowanceLimits,
    nowMs: number,
  ): Promise<KoiAllowanceGrantV1> {
    const ref = this.userRef(uid).collection('private').doc('allowance');
    return this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, snapshot] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      requireActiveRegistrationData(registrationSnapshot.data());
      const grant = reconcileKoiAllowanceGrant(allowanceFrom(snapshot.data()), limits, nowMs);
      const decision = consumeKoiAllowance(grant, kind, limits);
      if (!decision.allowed) {
        throw new KoiBackendError(decision.reason, 'Koi Sensei allowance is temporarily unavailable.', decision.retryAtMs);
      }
      transaction.set(ref, { schemaVersion: 1, grant: decision.grant, updatedAtMs: nowMs }, { merge: true });
      return decision.grant;
    });
  }

  async reserveRequest(
    uid: string,
    requestId: string,
    payloadFingerprint: string,
    consentEpoch: number,
    nowMs: number,
  ): Promise<KoiRequestReservation<AskKoiSenseiResponse>> {
    const ref = this.userRef(uid).collection('koiRequests').doc(requestId);
    const ownerToken = randomUUID();
    return this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, snapshot] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      const registration = requireActiveRegistrationData(registrationSnapshot.data());
      if (registration.consentEpoch !== consentEpoch) {
        throw new KoiBackendError('CONSENT_REQUIRED', 'The Koi consent generation is stale.');
      }
      const decision = decideKoiRequestReservation(
        snapshot.data(),
        payloadFingerprint,
        consentEpoch,
        ownerToken,
        nowMs,
        KOI_REQUEST_RESERVATION_MS,
        (value) => {
          const parsed = askKoiSenseiResponseSchema.safeParse(value);
          return parsed.success ? parsed.data : null;
        },
      );
      if (decision.kind === 'cached') return decision;
      if (decision.kind === 'fingerprint_mismatch') {
        throw new KoiBackendError('INVALID_REQUEST', 'This requestId was already used with different Koi content.');
      }
      if (decision.kind === 'consent_epoch_mismatch') {
        throw new KoiBackendError('CONSENT_REQUIRED', 'This requestId belongs to an older consent generation.');
      }
      if (decision.kind === 'busy') {
        throw new KoiBackendError('TOKEN_PLAN_BUSY', 'This Koi request is already in progress.', decision.retryAtMs);
      }
      if (decision.kind === 'corrupt') {
        throw new KoiBackendError('INTERNAL', 'The stored Koi request result is invalid.');
      }
      transaction.set(ref, {
        ...decision.record,
        retentionExpiresAt: Timestamp.fromMillis(nowMs + KOI_CHAT_RETENTION_MS),
      });
      return { kind: 'reserved' as const, ownerToken };
    });
  }

  async releaseRequest(
    uid: string,
    requestId: string,
    ownerToken: string,
    payloadFingerprint: string,
    consentEpoch: number,
  ): Promise<void> {
    const ref = this.userRef(uid).collection('koiRequests').doc(requestId);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (ownsKoiRequestReservation(snapshot.data(), ownerToken, payloadFingerprint, consentEpoch)) transaction.delete(ref);
    });
  }

  async completeRequest(
    uid: string,
    requestId: string,
    ownerToken: string,
    payloadFingerprint: string,
    consentEpoch: number,
    consentProviderLeaseId: string | null,
    response: AskKoiSenseiResponse,
    nowMs: number,
  ): Promise<void> {
    const ref = this.userRef(uid).collection('koiRequests').doc(requestId);
    await this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, requestSnapshot] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      if (consentProviderLeaseId) {
        requireConsentProviderOperationData(
          registrationSnapshot.data(),
          consentProviderLeaseId,
          consentEpoch,
          nowMs,
        );
      } else {
        const registration = requireActiveRegistrationData(registrationSnapshot.data());
        if (registration.consentEpoch !== consentEpoch) {
          throw new KoiBackendError('CONSENT_REQUIRED', 'The Koi consent generation changed.');
        }
      }
      if (!ownsKoiRequestReservation(requestSnapshot.data(), ownerToken, payloadFingerprint, consentEpoch)) {
        throw new KoiBackendError('TOKEN_PLAN_BUSY', 'This Koi request was superseded by a retry.');
      }
      transaction.set(ref, {
        schemaVersion: 1,
        status: 'completed',
        ownerToken: null,
        payloadFingerprint,
        consentEpoch,
        response,
        completedAtMs: nowMs,
        retentionExpiresAt: Timestamp.fromMillis(nowMs + KOI_CHAT_RETENTION_MS),
      });
    });
  }

  async reserveSynthesisRequest(
    uid: string,
    requestId: string,
    payloadFingerprint: string,
    consentEpoch: number,
    nowMs: number,
  ): Promise<KoiRequestReservation<SynthesizeKoiReplyResponse>> {
    const ref = this.userRef(uid).collection('koiTtsRequests').doc(requestId);
    const ownerToken = randomUUID();
    return this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, snapshot] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      const registration = requireActiveRegistrationData(registrationSnapshot.data());
      if (registration.consentEpoch !== consentEpoch) {
        throw new KoiBackendError('CONSENT_REQUIRED', 'The Koi consent generation is stale.');
      }
      const decision = decideKoiRequestReservation(
        snapshot.data(),
        payloadFingerprint,
        consentEpoch,
        ownerToken,
        nowMs,
        KOI_REQUEST_RESERVATION_MS,
        (value) => {
          const parsed = synthesizeKoiReplyResponseSchema.safeParse(value);
          return parsed.success ? parsed.data : null;
        },
      );
      if (decision.kind === 'cached') return decision;
      if (decision.kind === 'fingerprint_mismatch') {
        throw new KoiBackendError('INVALID_REQUEST', 'This requestId was already used with a different Koi reply.');
      }
      if (decision.kind === 'consent_epoch_mismatch') {
        throw new KoiBackendError('CONSENT_REQUIRED', 'This voice requestId belongs to an older consent generation.');
      }
      if (decision.kind === 'busy') {
        throw new KoiBackendError('TOKEN_PLAN_BUSY', 'This Koi voice request is already in progress.', decision.retryAtMs);
      }
      if (decision.kind === 'corrupt') {
        throw new KoiBackendError('INTERNAL', 'The stored Koi voice result is invalid.');
      }
      transaction.set(ref, {
        ...decision.record,
        retentionExpiresAt: Timestamp.fromMillis(nowMs + KOI_TTS_RESULT_RETENTION_MS),
      });
      return { kind: 'reserved' as const, ownerToken };
    });
  }

  async releaseSynthesisRequest(
    uid: string,
    requestId: string,
    ownerToken: string,
    payloadFingerprint: string,
    consentEpoch: number,
  ): Promise<void> {
    const ref = this.userRef(uid).collection('koiTtsRequests').doc(requestId);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (ownsKoiRequestReservation(snapshot.data(), ownerToken, payloadFingerprint, consentEpoch)) transaction.delete(ref);
    });
  }

  async completeSynthesisRequest(
    uid: string,
    requestId: string,
    ownerToken: string,
    payloadFingerprint: string,
    consentEpoch: number,
    consentProviderLeaseId: string | null,
    response: SynthesizeKoiReplyResponse,
    nowMs: number,
  ): Promise<void> {
    const ref = this.userRef(uid).collection('koiTtsRequests').doc(requestId);
    await this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, requestSnapshot] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      if (consentProviderLeaseId) {
        requireConsentProviderOperationData(
          registrationSnapshot.data(),
          consentProviderLeaseId,
          consentEpoch,
          nowMs,
        );
      } else {
        const registration = requireActiveRegistrationData(registrationSnapshot.data());
        if (registration.consentEpoch !== consentEpoch) {
          throw new KoiBackendError('CONSENT_REQUIRED', 'The Koi consent generation changed.');
        }
      }
      if (!ownsKoiRequestReservation(requestSnapshot.data(), ownerToken, payloadFingerprint, consentEpoch)) {
        throw new KoiBackendError('TOKEN_PLAN_BUSY', 'This Koi voice request was superseded by a retry.');
      }
      transaction.set(ref, {
        schemaVersion: 1,
        status: 'completed',
        ownerToken: null,
        payloadFingerprint,
        consentEpoch,
        response,
        completedAtMs: nowMs,
        retentionExpiresAt: Timestamp.fromMillis(nowMs + KOI_TTS_RESULT_RETENTION_MS),
      });
    });
  }

  async saveConversationExchange(
    uid: string,
    input: {
      requestId: string;
      conversationId: string;
      question: string;
      assistantMessageId: string;
      answer: string;
      spokenText: string;
      nowMs: number;
    },
  ): Promise<void> {
    const messages = this.userRef(uid).collection('koiMessages');
    const expiresAt = Timestamp.fromMillis(input.nowMs + KOI_CHAT_RETENTION_MS);
    const userMessageId = randomUUID();
    await this.db.runTransaction(async (transaction) => {
      const registrationSnapshot = await transaction.get(this.userRef(uid));
      requireActiveRegistrationData(registrationSnapshot.data());
      transaction.create(messages.doc(userMessageId), {
        schemaVersion: 1,
        id: userMessageId,
        requestId: input.requestId,
        conversationId: input.conversationId,
        role: 'user',
        text: input.question,
        createdAtMs: input.nowMs,
        expiresAt,
      });
      transaction.create(messages.doc(input.assistantMessageId), {
        schemaVersion: 1,
        id: input.assistantMessageId,
        requestId: input.requestId,
        conversationId: input.conversationId,
        role: 'assistant',
        text: input.answer,
        spokenText: input.spokenText,
        createdAtMs: input.nowMs,
        expiresAt,
      });
    });
    await this.trimMessages(uid);
  }

  private async trimMessages(uid: string): Promise<void> {
    const snapshot = await this.userRef(uid)
      .collection('koiMessages')
      .orderBy('createdAtMs', 'desc')
      .limit(KOI_MAX_STORED_MESSAGES + 50)
      .get();
    const overflow = snapshot.docs.slice(KOI_MAX_STORED_MESSAGES);
    if (overflow.length === 0) return;
    const batch = this.db.batch();
    for (const document of overflow) batch.delete(document.ref);
    await batch.commit();
  }

  async getAssistantSpokenText(uid: string, messageId: string): Promise<string | null> {
    const snapshot = await this.userRef(uid).collection('koiMessages').doc(messageId).get();
    const data = snapshot.data();
    if (data?.role !== 'assistant' || typeof data.spokenText !== 'string') return null;
    return data.spokenText.slice(0, 240);
  }

  async upsertMemory(uid: string, input: UpsertKoiMemoryRequest, nowMs: number): Promise<void> {
    const collection = this.userRef(uid).collection('koiMemories');
    const ref = collection.doc(input.memoryId);
    await this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, existing] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(ref),
      ]);
      requireActiveRegistrationData(registrationSnapshot.data());
      if (!existing.exists) {
        const all = await transaction.get(collection.limit(KOI_MAX_USER_APPROVED_MEMORIES + 1));
        if (all.size >= KOI_MAX_USER_APPROVED_MEMORIES) {
          throw new KoiBackendError('CONTENT_BLOCKED', 'Koi Sensei can remember at most 20 approved items.');
        }
      }
      const previous = memoryFrom(existing.data());
      const memory: StoredMemory = {
        schemaVersion: 1,
        category: input.category,
        text: input.text,
        approvedByUserAtMs: nowMs,
        createdAtMs: previous?.createdAtMs ?? nowMs,
        updatedAtMs: nowMs,
      };
      transaction.set(ref, memory);
    });
  }

  async deleteMemory(uid: string, memoryId: string): Promise<void> {
    const ref = this.userRef(uid).collection('koiMemories').doc(memoryId);
    await this.db.runTransaction(async (transaction) => {
      const registrationSnapshot = await transaction.get(this.userRef(uid));
      requireActiveRegistrationData(registrationSnapshot.data());
      transaction.delete(ref);
    });
  }

  async getApprovedMemories(uid: string): Promise<Array<Pick<StoredMemory, 'category' | 'text'>>> {
    const snapshot = await this.userRef(uid).collection('koiMemories').limit(KOI_MAX_USER_APPROVED_MEMORIES).get();
    return snapshot.docs
      .map((document) => memoryFrom(document.data()))
      .filter((memory): memory is StoredMemory => memory !== null)
      .map(({ category, text }) => ({ category, text }));
  }

  async reportMessage(uid: string, input: ReportKoiMessageRequest, nowMs: number): Promise<void> {
    const messageRef = this.userRef(uid).collection('koiMessages').doc(input.messageId);
    const reports = this.userRef(uid).collection('koiReports');
    await this.db.runTransaction(async (transaction) => {
      const [registrationSnapshot, message] = await Promise.all([
        transaction.get(this.userRef(uid)),
        transaction.get(messageRef),
      ]);
      requireActiveRegistrationData(registrationSnapshot.data());
      if (!message.exists) throw new KoiBackendError('INVALID_REQUEST', 'The reported Koi message was not found.');
      transaction.set(reports.doc(input.requestId), {
        schemaVersion: 1,
        reporterUid: uid,
        messagePath: message.ref.path,
        messageId: input.messageId,
        reason: input.reason,
        ...(input.note === undefined ? {} : { note: input.note }),
        createdAtMs: nowMs,
        expiresAt: Timestamp.fromMillis(nowMs + KOI_REPORT_RETENTION_MS),
      });
    });
    const snapshot = await reports.orderBy('createdAtMs', 'desc').limit(KOI_MAX_STORED_MESSAGES + 50).get();
    const overflow = snapshot.docs.slice(KOI_MAX_STORED_MESSAGES);
    if (overflow.length > 0) {
      const batch = this.db.batch();
      for (const document of overflow) batch.delete(document.ref);
      await batch.commit();
    }
  }

  async exportData(uid: string, requestId: string, nowMs: number): Promise<ExportKoiDataResponse> {
    const userRef = this.userRef(uid);
    const [user, context, messages, memories, reports] = await Promise.all([
      userRef.get(),
      userRef.collection('private').doc('learnerContext').get(),
      userRef.collection('koiMessages').orderBy('createdAtMs', 'desc').limit(KOI_MAX_STORED_MESSAGES).get(),
      userRef.collection('koiMemories').limit(KOI_MAX_USER_APPROVED_MEMORIES).get(),
      userRef.collection('koiReports').orderBy('createdAtMs', 'desc').limit(KOI_MAX_STORED_MESSAGES).get(),
    ]);
    const registration = registrationFrom(user.data());
    const parsedContext = koiLearnerContextSchema.safeParse(context.data()?.context);
    return {
      schemaVersion: 1,
      requestId,
      exportedAtMs: nowMs,
      registration: registration ? {
        ageBand: registration.ageBand,
        supportLanguage: registration.supportLanguage,
        status: registration.status,
        createdAtMs: registration.createdAtMs,
      } : null,
      learnerContext: parsedContext.success ? parsedContext.data : null,
      messages: messages.docs
        .map((document) => this.exportMessage(document))
        .filter((message): message is NonNullable<typeof message> => message !== null)
        .reverse(),
      memories: memories.docs
        .map((document) => {
          const memory = memoryFrom(document.data());
          return memory ? {
            id: document.id,
            category: memory.category,
            text: memory.text,
            createdAtMs: memory.createdAtMs,
            updatedAtMs: memory.updatedAtMs,
          } : null;
        })
        .filter((memory): memory is NonNullable<typeof memory> => memory !== null),
      reports: reports.docs
        .map((document) => {
          const data = document.data();
          if (
            typeof data.messageId !== 'string'
            || !['incorrect', 'unsafe', 'offensive', 'privacy', 'other'].includes(data.reason)
            || typeof data.createdAtMs !== 'number'
          ) return null;
          return {
            id: document.id,
            messageId: data.messageId,
            reason: data.reason as 'incorrect' | 'unsafe' | 'offensive' | 'privacy' | 'other',
            ...(typeof data.note === 'string' ? { note: data.note } : {}),
            createdAtMs: data.createdAtMs,
          };
        })
        .filter((report): report is NonNullable<typeof report> => report !== null)
        .reverse(),
    };
  }

  private exportMessage(document: QueryDocumentSnapshot<DocumentData>) {
    const data = document.data();
    if (
      typeof data.id !== 'string'
      || typeof data.conversationId !== 'string'
      || (data.role !== 'user' && data.role !== 'assistant')
      || typeof data.text !== 'string'
      || typeof data.createdAtMs !== 'number'
    ) return null;
    return {
      id: data.id,
      conversationId: data.conversationId,
      role: data.role as 'user' | 'assistant',
      text: data.text,
      createdAtMs: data.createdAtMs,
    };
  }

  async deleteData(uid: string, nowMs: number): Promise<void> {
    const userRef = this.userRef(uid);
    const admissionRef = this.db.doc('koiSystem/admission');
    await this.db.runTransaction(async (transaction) => {
      const [user, admission] = await Promise.all([
        transaction.get(userRef),
        transaction.get(admissionRef),
      ]);
      const raw = user.data();
      const storedCount = admission.data()?.activeCount;
      const activeCount = Number.isInteger(storedCount) && storedCount >= 0 ? storedCount : 0;
      const decision = decideKoiDeletion(raw, activeCount);
      if (!decision.shouldMarkDeleting || !raw) return;
      const currentEpoch = Number.isInteger(raw.consentEpoch) && raw.consentEpoch >= 1
        ? raw.consentEpoch
        : 0;
      transaction.set(userRef, {
        consentStatus: 'revoked',
        consentEpoch: currentEpoch + 1,
        cleanupPending: true,
        deletionState: 'deleting',
        revokedAtMs: nowMs,
        updatedAtMs: nowMs,
      }, { merge: true });
      if (decision.nextActiveCount === activeCount) return;
      transaction.set(admissionRef, {
        activeCount: decision.nextActiveCount,
        updatedAtMs: nowMs,
      }, { merge: true });
    });
    await this.db.recursiveDelete(userRef);
  }
}
