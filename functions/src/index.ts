import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onCall, type CallableOptions, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import type { ZodType } from 'zod';

import {
  askKoiSenseiRequestSchema,
  completeKoiRegistrationRequestSchema,
  deleteKoiDataRequestSchema,
  deleteKoiMemoryRequestSchema,
  exportKoiDataRequestSchema,
  getKoiAllowanceRequestSchema,
  reportKoiMessageRequestSchema,
  revokeKoiConsentRequestSchema,
  setKoiDetailedProgressConsentRequestSchema,
  syncKoiLearningContextRequestSchema,
  synthesizeKoiReplyRequestSchema,
  upsertKoiMemoryRequestSchema,
} from '../../shared/koi/contracts.js';
import { requireKoiCaller } from './auth.js';
import { KOI_CALLABLE_TIMEOUT_MS, loadKoiBackendConfig } from './config.js';
import { KoiBackendError, toHttpsError } from './errors.js';
import { createKoiProvider } from './providers/index.js';
import { enforceKoiRetention } from './retention.js';
import { KoiService } from './service.js';
import { KoiStore } from './store.js';

initializeApp();

const config = loadKoiBackendConfig();
const minimaxTokenPlanKey = defineSecret('MINIMAX_TOKEN_PLAN_KEY');
const db = getFirestore();
const provider = createKoiProvider(config, () => minimaxTokenPlanKey.value());
const service = new KoiService(db, new KoiStore(db), provider);

const callableOptions: CallableOptions = {
  region: config.region,
  enforceAppCheck: true,
  consumeAppCheckToken: true,
  maxInstances: 1,
  minInstances: 0,
  concurrency: 10,
  timeoutSeconds: KOI_CALLABLE_TIMEOUT_MS / 1_000,
  memory: '256MiB',
  secrets: config.providerMode === 'live' ? [minimaxTokenPlanKey] : [],
};

const parseData = <T>(schema: ZodType<T>, data: unknown): T => {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new KoiBackendError('INVALID_REQUEST', 'The Koi Sensei request is invalid.');
  return parsed.data;
};

const runCallable = async <T>(
  request: CallableRequest<unknown>,
  work: (uid: string) => Promise<T>,
): Promise<T> => {
  try {
    return await work(requireKoiCaller(request));
  } catch (error) {
    throw toHttpsError(error);
  }
};

export const completeKoiRegistration = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.completeRegistration(uid, parseData(completeKoiRegistrationRequestSchema, request.data)),
));

export const revokeKoiConsent = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.revokeConsent(uid, parseData(revokeKoiConsentRequestSchema, request.data)),
));

export const setKoiDetailedProgressConsent = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.setDetailedProgressConsent(
    uid,
    parseData(setKoiDetailedProgressConsentRequestSchema, request.data),
  ),
));

export const getKoiAllowance = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.getAllowance(uid, parseData(getKoiAllowanceRequestSchema, request.data)),
));

export const syncKoiLearningContext = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.syncLearnerContext(uid, parseData(syncKoiLearningContextRequestSchema, request.data)),
));

export const askKoiSensei = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.ask(uid, parseData(askKoiSenseiRequestSchema, request.data)),
));

export const synthesizeKoiReply = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.synthesize(uid, parseData(synthesizeKoiReplyRequestSchema, request.data)),
));

export const upsertKoiMemory = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.upsertMemory(uid, parseData(upsertKoiMemoryRequestSchema, request.data)),
));

export const deleteKoiMemory = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.deleteMemory(uid, parseData(deleteKoiMemoryRequestSchema, request.data)),
));

export const exportKoiData = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.exportData(uid, parseData(exportKoiDataRequestSchema, request.data)),
));

export const deleteKoiData = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.deleteData(uid, parseData(deleteKoiDataRequestSchema, request.data)),
));

export const reportKoiMessage = onCall(callableOptions, (request) => runCallable(
  request,
  (uid) => service.reportMessage(uid, parseData(reportKoiMessageRequestSchema, request.data)),
));

export const cleanupKoiRetention = onSchedule({
  region: config.region,
  schedule: 'every day 03:15',
  timeZone: 'UTC',
  maxInstances: 1,
  timeoutSeconds: 120,
  memory: '256MiB',
}, async () => {
  await enforceKoiRetention(db, Date.now());
});
