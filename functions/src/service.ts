import { randomUUID } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

import type {
  AskKoiSenseiRequest,
  AskKoiSenseiResponse,
  CompleteKoiRegistrationRequest,
  CompleteKoiRegistrationResponse,
  DeleteKoiDataRequest,
  DeleteKoiDataResponse,
  DeleteKoiMemoryRequest,
  DeleteKoiMemoryResponse,
  ExportKoiDataRequest,
  ExportKoiDataResponse,
  GetKoiAllowanceRequest,
  GetKoiAllowanceResponse,
  ReportKoiMessageRequest,
  ReportKoiMessageResponse,
  RevokeKoiConsentRequest,
  RevokeKoiConsentResponse,
  SetKoiDetailedProgressConsentRequest,
  SetKoiDetailedProgressConsentResponse,
  SyncKoiLearningContextRequest,
  SyncKoiLearningContextResponse,
  SynthesizeKoiReplyRequest,
  SynthesizeKoiReplyResponse,
  UpsertKoiMemoryRequest,
  UpsertKoiMemoryResponse,
} from '../../shared/koi/contracts.js';
import {
  KOI_CAPACITY_STALE_AFTER_MS,
  deriveKoiAllowanceLimits,
  type KoiAllowanceGrantV1,
  type KoiAllowanceLimits,
} from '../../src/features/koi-sensei/api/quotaPolicy.js';
import { KoiBackendError } from './errors.js';
import { withProviderLease } from './providerSemaphore.js';
import type { KoiProvider } from './providers/types.js';
import type { KoiProviderCapacityBundle } from './providers/types.js';
import { fingerprintKoiRequestPayload } from './requestReservation.js';
import { KoiStore } from './store.js';
import {
  readTtsRemainingCharacters,
  withTtsCharacterReservation,
} from './ttsBudget.js';

const pausedLimits = (nowMs: number): KoiAllowanceLimits => deriveKoiAllowanceLimits({
  rollingRemainingPercent: 0,
  weeklyRemainingPercent: 0,
  fetchedAtMs: nowMs - KOI_CAPACITY_STALE_AFTER_MS - 1,
}, nowMs);

export class KoiService {
  constructor(
    private readonly db: Firestore,
    private readonly store: KoiStore,
    private readonly provider: KoiProvider,
    private readonly now: () => number = Date.now,
  ) {}

  async completeRegistration(
    uid: string,
    input: CompleteKoiRegistrationRequest,
  ): Promise<CompleteKoiRegistrationResponse> {
    return this.store.completeRegistration(uid, input, this.now());
  }

  private async getCapacity(nowMs: number): Promise<KoiProviderCapacityBundle> {
    const reservation = await this.store.reserveProviderCapacityRefresh(nowMs);
    if (reservation.kind === 'cached') return reservation.capacity;
    if (reservation.kind === 'in_progress') {
      const stale = reservation.staleCapacity;
      if (stale && nowMs - stale.fetchedAtMs <= KOI_CAPACITY_STALE_AFTER_MS) return stale;
      throw new KoiBackendError(
        'TOKEN_PLAN_BUSY',
        'Koi Sensei capacity is being refreshed.',
        reservation.retryAtMs,
      );
    }

    try {
      const capacity = await withProviderLease(
        this.db,
        'system-capacity-refresh',
        () => this.provider.getCapacityBundle(nowMs),
        this.now,
      );
      await this.store.completeProviderCapacityRefresh(reservation.ownerToken, capacity, this.now());
      return capacity;
    } catch (error) {
      await this.store.releaseProviderCapacityRefresh(reservation.ownerToken, this.now()).catch(() => undefined);
      if (
        reservation.staleCapacity
        && nowMs - reservation.staleCapacity.fetchedAtMs <= KOI_CAPACITY_STALE_AFTER_MS
      ) return reservation.staleCapacity;
      throw error;
    }
  }

  private async getLimits(nowMs: number): Promise<KoiAllowanceLimits> {
    const capacity = await this.getCapacity(nowMs);
    return deriveKoiAllowanceLimits(capacity.chat, nowMs);
  }

  async getAllowance(uid: string, input: GetKoiAllowanceRequest): Promise<GetKoiAllowanceResponse> {
    await this.store.requireActiveRegistration(uid);
    const nowMs = this.now();
    const refresh = await this.store.reserveAllowanceRefresh(uid, nowMs);
    if (refresh.kind === 'cached') {
      return { schemaVersion: 1, requestId: input.requestId, allowance: refresh.grant, serverTimeMs: nowMs };
    }
    if (refresh.kind === 'in_progress') {
      throw new KoiBackendError('TOKEN_PLAN_BUSY', 'Your Koi allowance is already being refreshed.', refresh.retryAtMs);
    }
    let limits: KoiAllowanceLimits;
    try {
      limits = await this.getLimits(nowMs);
    } catch {
      limits = pausedLimits(nowMs);
    }
    try {
      const allowance = await this.store.completeAllowanceRefresh(uid, refresh.ownerToken, limits, nowMs);
      return { schemaVersion: 1, requestId: input.requestId, allowance, serverTimeMs: nowMs };
    } catch (error) {
      await this.store.releaseAllowanceRefresh(uid, refresh.ownerToken, this.now()).catch(() => undefined);
      throw error;
    }
  }

  async syncLearnerContext(
    uid: string,
    input: SyncKoiLearningContextRequest,
  ): Promise<SyncKoiLearningContextResponse> {
    await this.store.requireActiveRegistration(uid);
    const nowMs = this.now();
    const acceptedRevision = await this.store.syncLearnerContext(uid, input.context, nowMs);
    return { schemaVersion: 1, requestId: input.requestId, acceptedRevision, serverTimeMs: nowMs };
  }

  async ask(uid: string, input: AskKoiSenseiRequest): Promise<AskKoiSenseiResponse> {
    const registration = await this.store.requireActiveRegistration(uid);
    const reservationTimeMs = this.now();
    const payloadFingerprint = fingerprintKoiRequestPayload('ask', {
      conversationId: input.conversationId,
      text: input.text,
    });
    const reservation = await this.store.reserveRequest(
      uid,
      input.requestId,
      payloadFingerprint,
      registration.consentEpoch,
      reservationTimeMs,
    );
    if (reservation.kind === 'cached') return reservation.response;

    try {
      const preflight = this.provider.preflightAnswer(input.text);
      if (preflight) {
        const nowMs = this.now();
        const allowance = await this.store.reconcileAllowance(uid, pausedLimits(nowMs), nowMs);
        const response: AskKoiSenseiResponse = {
          schemaVersion: 1,
          status: preflight.status,
          requestId: input.requestId,
          assistantMessage: {
            id: randomUUID(),
            conversationId: input.conversationId,
            text: preflight.text,
            spokenText: preflight.spokenText,
            expression: preflight.expression,
            createdAtMs: nowMs,
          },
          citations: preflight.citations,
          allowance,
        };
        await this.store.completeRequest(
          uid,
          input.requestId,
          reservation.ownerToken,
          payloadFingerprint,
          registration.consentEpoch,
          null,
          response,
          nowMs,
        );
        return response;
      }
      const limits = await this.getLimits(this.now());
      return await withProviderLease(this.db, uid, async () => {
        const nowMs = this.now();
        const allowance = await this.store.consumeAllowance(uid, 'chat', limits, nowMs);
        const [learnerContext, approvedMemories] = await Promise.all([
          this.store.getLearnerContext(uid),
          this.store.getApprovedMemories(uid),
        ]);
        const consentLease = await this.store.reserveConsentProviderOperation(
          uid,
          registration.consentEpoch,
          'chat',
          this.now(),
        );
        try {
          const answer = await this.provider.answer({
            question: input.text,
            learnerContext,
            approvedMemories,
          });
        const assistantMessageId = randomUUID();
        const response: AskKoiSenseiResponse = {
          schemaVersion: 1,
          status: answer.status,
          requestId: input.requestId,
          assistantMessage: {
            id: assistantMessageId,
            conversationId: input.conversationId,
            text: answer.text,
            spokenText: answer.spokenText,
            expression: answer.expression,
            createdAtMs: nowMs,
          },
          citations: answer.citations,
          allowance,
        };

        // Persist idempotency before best-effort chat history. A transient history
        // write must never cause a second provider request for the same requestId.
        await this.store.completeRequest(
          uid,
          input.requestId,
          reservation.ownerToken,
          payloadFingerprint,
          registration.consentEpoch,
          consentLease.id,
          response,
          nowMs,
        );
        await this.store.saveConversationExchange(uid, {
          requestId: input.requestId,
          conversationId: input.conversationId,
          question: input.text,
          assistantMessageId,
          answer: answer.text,
          spokenText: answer.spokenText,
          nowMs,
        }).catch(() => undefined);
          return response;
        } finally {
          await this.store.releaseConsentProviderOperation(uid, consentLease.id, this.now()).catch(() => undefined);
        }
      }, this.now);
    } catch (error) {
      await this.store.releaseRequest(
        uid,
        input.requestId,
        reservation.ownerToken,
        payloadFingerprint,
        registration.consentEpoch,
      ).catch(() => undefined);
      throw error;
    }
  }

  private ttsFallback(
    input: SynthesizeKoiReplyRequest,
    spokenText: string,
    allowance: KoiAllowanceGrantV1,
    reason: 'BUDGET_EXHAUSTED' | 'CAPACITY_STALE' | 'PROVIDER_UNAVAILABLE',
    remainingCharacters: number,
  ): SynthesizeKoiReplyResponse {
    return {
      schemaVersion: 1,
      requestId: input.requestId,
      status: 'system_voice_fallback',
      reason,
      spokenText,
      dailyCharacterRemaining: Math.max(0, Math.min(4_000, remainingCharacters)),
      allowance,
    };
  }

  async revokeConsent(
    uid: string,
    input: RevokeKoiConsentRequest,
  ): Promise<RevokeKoiConsentResponse> {
    return this.store.revokeConsent(uid, input, this.now());
  }

  async setDetailedProgressConsent(
    uid: string,
    input: SetKoiDetailedProgressConsentRequest,
  ): Promise<SetKoiDetailedProgressConsentResponse> {
    return this.store.setDetailedProgressConsent(uid, input, this.now());
  }

  async synthesize(
    uid: string,
    input: SynthesizeKoiReplyRequest,
  ): Promise<SynthesizeKoiReplyResponse> {
    const registration = await this.store.requireActiveRegistration(uid);
    const nowMs = this.now();
    const payloadFingerprint = fingerprintKoiRequestPayload('synthesize', {
      assistantMessageId: input.assistantMessageId,
    });
    const reservation = await this.store.reserveSynthesisRequest(
      uid,
      input.requestId,
      payloadFingerprint,
      registration.consentEpoch,
      nowMs,
    );
    if (reservation.kind === 'cached') return reservation.response;
    const consentLease = await this.store.reserveConsentProviderOperation(
      uid,
      registration.consentEpoch,
      'tts',
      this.now(),
    );
    try {
      const spokenText = await this.store.getAssistantSpokenText(uid, input.assistantMessageId);
      if (!spokenText) throw new KoiBackendError('INVALID_REQUEST', 'The Koi reply was not found.');
      const response = await this.synthesizeUncached(uid, input, spokenText, nowMs);
      await this.store.completeSynthesisRequest(
        uid,
        input.requestId,
        reservation.ownerToken,
        payloadFingerprint,
        registration.consentEpoch,
        consentLease.id,
        response,
        nowMs,
      );
      return response;
    } catch (error) {
      await this.store.releaseSynthesisRequest(
        uid,
        input.requestId,
        reservation.ownerToken,
        payloadFingerprint,
        registration.consentEpoch,
      ).catch(() => undefined);
      throw error;
    } finally {
      await this.store.releaseConsentProviderOperation(uid, consentLease.id, this.now()).catch(() => undefined);
    }
  }

  private async synthesizeUncached(
    uid: string,
    input: SynthesizeKoiReplyRequest,
    spokenText: string,
    nowMs: number,
  ): Promise<SynthesizeKoiReplyResponse> {

    let limits: KoiAllowanceLimits;
    let providerCapacity: KoiProviderCapacityBundle | null = null;
    try {
      providerCapacity = await this.getCapacity(nowMs);
      limits = deriveKoiAllowanceLimits(providerCapacity.chat, nowMs);
    } catch {
      limits = pausedLimits(nowMs);
    }
    let allowance = await this.store.reconcileAllowance(uid, limits, nowMs);
    const localRemaining = await readTtsRemainingCharacters(this.db, nowMs);
    if (limits.reason || limits.voiceLimit === 0) {
      return this.ttsFallback(input, spokenText, allowance, 'CAPACITY_STALE', localRemaining);
    }
    if (allowance.voiceUsed >= allowance.voiceLimit) {
      throw new KoiBackendError('VOICE_ALLOWANCE_EXHAUSTED', 'Your Koi voice allowance is used for this window.', allowance.expiresAtMs);
    }
    if (localRemaining < spokenText.length) {
      return this.ttsFallback(input, spokenText, allowance, 'BUDGET_EXHAUSTED', localRemaining);
    }

    try {
      return await withProviderLease(this.db, uid, async () => {
        const ttsCapacity = providerCapacity?.tts;
        if (
          !ttsCapacity
          || nowMs - ttsCapacity.fetchedAtMs > KOI_CAPACITY_STALE_AFTER_MS
          || ttsCapacity.remainingCharacters < spokenText.length
        ) {
          return this.ttsFallback(
            input,
            spokenText,
            allowance,
            ttsCapacity && ttsCapacity.remainingCharacters < spokenText.length
              ? 'BUDGET_EXHAUSTED'
              : 'CAPACITY_STALE',
            Math.min(localRemaining, ttsCapacity?.remainingCharacters ?? 0),
          );
        }

        const reserved = await withTtsCharacterReservation(this.db, spokenText.length, async () => {
          allowance = await this.store.consumeAllowance(uid, 'voice', limits, nowMs);
          const audio = await this.provider.synthesize(spokenText, nowMs);
          return { audio, allowance };
        }, this.now);
        if (!reserved) {
          return this.ttsFallback(input, spokenText, allowance, 'BUDGET_EXHAUSTED', 0);
        }
        return {
          schemaVersion: 1,
          requestId: input.requestId,
          status: 'cloud_audio',
          audioUrl: reserved.result.audio.audioUrl,
          expiresAtMs: reserved.result.audio.expiresAtMs,
          cached: false,
          dailyCharacterRemaining: Math.min(
            reserved.remainingCharacters,
            Math.max(0, (ttsCapacity?.remainingCharacters ?? 0) - spokenText.length),
          ),
          allowance: reserved.result.allowance,
        };
      }, this.now);
    } catch (error) {
      if (
        error instanceof KoiBackendError
        && ['CHAT_ALLOWANCE_EXHAUSTED', 'VOICE_ALLOWANCE_EXHAUSTED', 'VOICE_CAPACITY_PAUSED'].includes(error.reason)
      ) throw error;
      return this.ttsFallback(input, spokenText, allowance, 'PROVIDER_UNAVAILABLE', 0);
    }
  }

  async upsertMemory(uid: string, input: UpsertKoiMemoryRequest): Promise<UpsertKoiMemoryResponse> {
    await this.store.requireActiveRegistration(uid);
    const nowMs = this.now();
    await this.store.upsertMemory(uid, input, nowMs);
    return {
      schemaVersion: 1,
      requestId: input.requestId,
      memoryId: input.memoryId,
      stored: true,
      serverTimeMs: nowMs,
    };
  }

  async deleteMemory(uid: string, input: DeleteKoiMemoryRequest): Promise<DeleteKoiMemoryResponse> {
    await this.store.requireActiveRegistration(uid);
    const nowMs = this.now();
    await this.store.deleteMemory(uid, input.memoryId);
    return {
      schemaVersion: 1,
      requestId: input.requestId,
      memoryId: input.memoryId,
      deleted: true,
      serverTimeMs: nowMs,
    };
  }

  async exportData(uid: string, input: ExportKoiDataRequest): Promise<ExportKoiDataResponse> {
    return this.store.exportData(uid, input.requestId, this.now());
  }

  async deleteData(uid: string, input: DeleteKoiDataRequest): Promise<DeleteKoiDataResponse> {
    const nowMs = this.now();
    await this.store.deleteData(uid, nowMs);
    return { schemaVersion: 1, requestId: input.requestId, deleted: true, serverTimeMs: nowMs };
  }

  async reportMessage(uid: string, input: ReportKoiMessageRequest): Promise<ReportKoiMessageResponse> {
    await this.store.requireActiveRegistration(uid);
    const nowMs = this.now();
    await this.store.reportMessage(uid, input, nowMs);
    return { schemaVersion: 1, requestId: input.requestId, accepted: true, serverTimeMs: nowMs };
  }
}
