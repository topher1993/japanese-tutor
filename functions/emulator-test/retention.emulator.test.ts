import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  KOI_CURRENT_AI_POLICY_VERSION,
  KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION,
  KOI_CURRENT_PRIVACY_POLICY_VERSION,
} from '../../shared/koi/contracts.js';
import { enforceKoiRetention } from '../src/retention.js';
import { fingerprintKoiRequestPayload } from '../src/requestReservation.js';
import { KOI_REQUEST_RESERVATION_MS, KoiStore } from '../src/store.js';

const projectId = 'demo-koi-sensei';
const uid = 'retention-pagination-test';
let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId }, 'koi-retention-emulator-tests');
  db = getFirestore(app);
});

afterAll(async () => {
  await db.recursiveDelete(db.doc(`koiUsers/${uid}`));
  await deleteApp(app);
});

describe('Koi retention against the Firestore emulator', () => {
  it('removes more than one Firestore write batch of expired data', async () => {
    const messages = db.collection(`koiUsers/${uid}/koiMessages`);
    const seed = db.batch();
    for (let index = 0; index < 451; index += 1) {
      seed.set(messages.doc(`expired-${String(index).padStart(3, '0')}`), {
        schemaVersion: 1,
        expiresAt: Timestamp.fromMillis(1),
      });
    }
    await seed.commit();

    const result = await enforceKoiRetention(db, Date.now());
    expect(result.messagesDeleted).toBe(451);
    expect(result.continuationRequired).toBe(false);
    expect((await messages.get()).empty).toBe(true);
  }, 30_000);
});

describe('Koi consent authority against the Firestore emulator', () => {
  it('revokes protected access and AI data, then permits an explicit current-policy refresh', async () => {
    const consentUid = 'consent-refresh-test';
    const store = new KoiStore(db);
    const input = {
      schemaVersion: 1 as const,
      requestId: 'bb45dfce-ec62-4ce5-a588-0df8a32b90e5',
      ageBand: '18_plus' as const,
      aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
      privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
      acknowledgedUsProcessing: true as const,
      supportLanguage: 'en' as const,
    };
    await store.completeRegistration(consentUid, input, 10_000);
    await db.doc(`koiUsers/${consentUid}/koiMessages/private-message`).set({
      schemaVersion: 1 as const,
      text: 'must be removed',
      expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    });

    const revokeInput = {
      schemaVersion: 1 as const,
      requestId: '8f768bae-45dc-419f-a3cc-701f814b768f',
      confirmation: 'REVOKE_KOI_AI_CONSENT' as const,
    } as const;
    await store.revokeConsent(consentUid, revokeInput, 11_000);
    await expect(store.requireActiveRegistration(consentUid)).rejects.toMatchObject({
      reason: 'CONSENT_REQUIRED',
    });
    expect((await db.collection(`koiUsers/${consentUid}/koiMessages`).get()).empty).toBe(true);

    await expect(store.completeRegistration(consentUid, input, 12_000))
      .rejects.toMatchObject({ reason: 'INVALID_REQUEST' });
    const refreshedInput = {
      ...input,
      requestId: '2517777f-b54b-41e6-9ed0-5b968edf4968',
    };
    const refreshed = await store.completeRegistration(consentUid, refreshedInput, 12_000);
    expect(refreshed).toMatchObject({
      status: 'active',
      aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
      privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
      consentedAtMs: 12_000,
    });
    await expect(store.requireActiveRegistration(consentUid)).resolves.toMatchObject({
      consentStatus: 'granted',
    });
    await expect(store.revokeConsent(consentUid, revokeInput, 12_500))
      .rejects.toMatchObject({ reason: 'INVALID_REQUEST' });
    await store.deleteData(consentUid, 13_000);
  }, 30_000);
});

describe('Koi detailed-progress authority against the Firestore emulator', () => {
  it('requires a server-stored current grant and invalidates context on revocation', async () => {
    const progressUid = 'detailed-progress-consent-test';
    const store = new KoiStore(db);
    await store.completeRegistration(progressUid, {
      schemaVersion: 1,
      requestId: '6ce35d7a-bde5-4162-94e2-0f607a361ff2',
      ageBand: '18_plus',
      aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
      privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
      acknowledgedUsProcessing: true,
      supportLanguage: 'en',
    }, 14_000);
    const context = {
      schemaVersion: 1 as const,
      revision: 1,
      consentVersion: KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION,
      supportLanguage: 'en' as const,
      dueCount: 2,
      streakDays: 3,
      completionCounts: {},
      weakTopicIds: [],
      masteryBuckets: {},
      recentActiveDays: 2,
    };
    await expect(store.syncLearnerContext(progressUid, context, 14_100))
      .rejects.toMatchObject({ reason: 'DETAILED_PROGRESS_CONSENT_REQUIRED' });
    await store.setDetailedProgressConsent(progressUid, {
      schemaVersion: 1,
      requestId: '9dedc831-f4fb-4fe8-a11c-8eb3af7da834',
      enabled: true,
      policyVersion: KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION,
    }, 14_200);
    await expect(store.syncLearnerContext(progressUid, context, 14_300)).resolves.toBe(1);
    await store.setDetailedProgressConsent(progressUid, {
      schemaVersion: 1,
      requestId: 'e2c5be2a-1997-4384-b9be-29c86fcb128b',
      enabled: false,
    }, 14_400);
    await expect(store.getLearnerContext(progressUid)).resolves.toBeNull();
    await store.deleteData(progressUid, 14_500);
  }, 30_000);
});

describe('Koi request ownership against the Firestore emulator', () => {
  it('serializes concurrent reservations and rejects an expired owner after takeover', async () => {
    const requestUid = 'request-ownership-test';
    const store = new KoiStore(db);
    const registration = {
      schemaVersion: 1 as const,
      requestId: '4501f91f-a142-4c4f-9b49-5123feac63ce',
      ageBand: '18_plus' as const,
      aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
      privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
      acknowledgedUsProcessing: true as const,
      supportLanguage: 'en' as const,
    };
    await store.completeRegistration(requestUid, registration, 20_000);
    const requestRegistration = await store.requireActiveRegistration(requestUid);
    const requestId = '7dbfe943-1585-4aaa-a3f6-325a6245df97';
    const conversationId = 'b76792eb-4ef9-4e1b-bbdf-b8a37d51ec67';
    const fingerprint = fingerprintKoiRequestPayload('ask', {
      conversationId,
      text: 'What is は?',
    });

    const concurrent = await Promise.allSettled([
      store.reserveRequest(requestUid, requestId, fingerprint, requestRegistration.consentEpoch, 21_000),
      store.reserveRequest(requestUid, requestId, fingerprint, requestRegistration.consentEpoch, 21_000),
    ]);
    const winner = concurrent.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<KoiStore['reserveRequest']>>> => (
      result.status === 'fulfilled'
    ));
    expect(winner?.value.kind).toBe('reserved');
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
    if (!winner || winner.value.kind !== 'reserved') throw new Error('missing reservation winner');

    const retry = await store.reserveRequest(
      requestUid,
      requestId,
      fingerprint,
      requestRegistration.consentEpoch,
      21_000 + KOI_REQUEST_RESERVATION_MS + 1,
    );
    expect(retry.kind).toBe('reserved');
    if (retry.kind !== 'reserved') throw new Error('missing retry owner');
    await store.releaseRequest(
      requestUid,
      requestId,
      winner.value.ownerToken,
      fingerprint,
      requestRegistration.consentEpoch,
    );
    const providerLease = await store.reserveConsentProviderOperation(
      requestUid,
      requestRegistration.consentEpoch,
      'chat',
      22_000,
    );

    const response = {
      schemaVersion: 1 as const,
      status: 'answered' as const,
      requestId,
      assistantMessage: {
        id: 'f35a6249-16aa-48b8-b31b-2b595ab88993',
        conversationId,
        text: 'は marks the topic.',
        spokenText: 'は marks the topic.',
        expression: 'thinking' as const,
        createdAtMs: 22_000,
      },
      citations: [],
      allowance: {
        schemaVersion: 1 as const,
        grantedAtMs: 20_000,
        expiresAtMs: 30_000,
        chatLimit: 12,
        chatUsed: 1,
        voiceLimit: 4,
        voiceUsed: 0,
        capacityBand: 'high' as const,
      },
    };
    await expect(store.completeRequest(
      requestUid,
      requestId,
      winner.value.ownerToken,
      fingerprint,
      requestRegistration.consentEpoch,
      providerLease.id,
      response,
      22_000,
    )).rejects.toMatchObject({ reason: 'TOKEN_PLAN_BUSY' });
    await store.completeRequest(
      requestUid,
      requestId,
      retry.ownerToken,
      fingerprint,
      requestRegistration.consentEpoch,
      providerLease.id,
      response,
      22_000,
    );
    await store.releaseConsentProviderOperation(requestUid, providerLease.id, 23_000);
    await expect(store.reserveRequest(
      requestUid,
      requestId,
      `${fingerprint}forged`,
      requestRegistration.consentEpoch,
      23_000,
    ))
      .rejects.toMatchObject({ reason: 'INVALID_REQUEST' });
    await store.deleteData(requestUid, 24_000);
  }, 30_000);
});

describe('Koi beta-seat deletion against the Firestore emulator', () => {
  it('decrements admission once when two deletion retries race', async () => {
    const deletionUid = 'concurrent-deletion-test';
    const store = new KoiStore(db);
    const registration = {
      schemaVersion: 1 as const,
      requestId: '6bd2a018-e933-422f-905f-a4cfb9d98035',
      ageBand: '18_plus' as const,
      aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
      privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
      acknowledgedUsProcessing: true as const,
      supportLanguage: 'en' as const,
    };
    await store.completeRegistration(deletionUid, registration, 30_000);
    const countBeforeDeletion = (await db.doc('koiSystem/admission').get()).data()?.activeCount;

    await Promise.all([
      store.deleteData(deletionUid, 31_000),
      store.deleteData(deletionUid, 31_000),
    ]);

    const countAfterDeletion = (await db.doc('koiSystem/admission').get()).data()?.activeCount;
    expect(countAfterDeletion).toBe(countBeforeDeletion - 1);
    expect((await db.doc(`koiUsers/${deletionUid}`).get()).exists).toBe(false);
  }, 30_000);
});
