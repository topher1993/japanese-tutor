import { z } from 'zod';

export const koiSchemaVersion = z.literal(1);
/**
 * Server-authoritative learner-facing notice versions. Registration requests
 * must acknowledge these exact values; protected callables re-check the same
 * values against the stored registration on every invocation.
 */
export const KOI_CURRENT_AI_POLICY_VERSION = 'koi-ai-data-2026-07-16' as const;
export const KOI_CURRENT_PRIVACY_POLICY_VERSION = 'koi-privacy-2026-07-16' as const;
export const KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION = 'koi-detailed-progress-2026-07-17' as const;
export const koiRequestId = z.string().uuid();
export const koiConversationId = z.string().uuid();
export const koiAgeBand = z.enum(['16_17', '18_plus']);
export const koiSupportLanguage = z.enum(['en', 'vi', 'tl']);
export const koiRank = z.enum(['N5', 'N4', 'N3', 'N2', 'N1']);
export const koiDomain = z.enum(['vocabulary', 'grammar', 'phrases', 'quizzes']);

export const koiAllowanceSchema = z.object({
  schemaVersion: koiSchemaVersion,
  grantedAtMs: z.number().int().nonnegative(),
  expiresAtMs: z.number().int().positive(),
  chatLimit: z.number().int().min(0).max(12),
  chatUsed: z.number().int().nonnegative(),
  voiceLimit: z.number().int().min(0).max(4),
  voiceUsed: z.number().int().nonnegative(),
  capacityBand: z.enum(['high', 'normal', 'low', 'critical', 'paused']),
  providerRetryAtMs: z.number().int().nonnegative().optional(),
}).strict();

export const completeKoiRegistrationRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  ageBand: koiAgeBand,
  aiPolicyVersion: z.literal(KOI_CURRENT_AI_POLICY_VERSION),
  privacyPolicyVersion: z.literal(KOI_CURRENT_PRIVACY_POLICY_VERSION),
  acknowledgedUsProcessing: z.literal(true),
  supportLanguage: koiSupportLanguage,
}).strict();

export const completeKoiRegistrationResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  status: z.enum(['active', 'waitlisted']),
  activeAccountLimit: z.literal(50),
  aiPolicyVersion: z.literal(KOI_CURRENT_AI_POLICY_VERSION),
  privacyPolicyVersion: z.literal(KOI_CURRENT_PRIVACY_POLICY_VERSION),
  consentedAtMs: z.number().int().nonnegative(),
  serverTimeMs: z.number().int().nonnegative(),
}).strict();

export const revokeKoiConsentRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  confirmation: z.literal('REVOKE_KOI_AI_CONSENT'),
}).strict();

export const revokeKoiConsentResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  revoked: z.literal(true),
  serverTimeMs: z.number().int().nonnegative(),
}).strict();

export const setKoiDetailedProgressConsentRequestSchema = z.discriminatedUnion('enabled', [
  z.object({
    schemaVersion: koiSchemaVersion,
    requestId: koiRequestId,
    enabled: z.literal(true),
    policyVersion: z.literal(KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION),
  }).strict(),
  z.object({
    schemaVersion: koiSchemaVersion,
    requestId: koiRequestId,
    enabled: z.literal(false),
  }).strict(),
]);

export const setKoiDetailedProgressConsentResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  enabled: z.boolean(),
  policyVersion: z.literal(KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION).nullable(),
  serverTimeMs: z.number().int().nonnegative(),
}).strict();

export const getKoiAllowanceRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
}).strict();

export const getKoiAllowanceResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  allowance: koiAllowanceSchema,
  serverTimeMs: z.number().int().nonnegative(),
}).strict();

export const koiLearnerContextSchema = z.object({
  schemaVersion: koiSchemaVersion,
  revision: z.number().int().nonnegative(),
  // Client acknowledgement only. The server separately requires and stores an
  // authoritative detailed-progress grant and generation.
  consentVersion: z.literal(KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION),
  supportLanguage: koiSupportLanguage,
  jlptTarget: koiRank.optional(),
  placementLevel: z.enum(['N5', 'N4', 'N3']).optional(),
  studyGoalId: z.string().trim().max(120).optional(),
  currentLessonId: z.string().trim().max(160).optional(),
  dueCount: z.number().int().nonnegative().max(100_000),
  streakDays: z.number().int().nonnegative().max(100_000),
  completionCounts: z.record(z.string().max(80), z.number().int().nonnegative()).default({}),
  weakTopicIds: z.array(z.string().trim().min(1).max(160)).max(100),
  masteryBuckets: z.record(z.string().max(80), z.number().int().nonnegative()).default({}),
  recentQuizAverage: z.number().min(0).max(100).optional(),
  recentActiveDays: z.number().int().min(0).max(30),
}).strict();

export const syncKoiLearningContextRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  context: koiLearnerContextSchema,
}).strict();

export const syncKoiLearningContextResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  acceptedRevision: z.number().int().nonnegative(),
  serverTimeMs: z.number().int().nonnegative(),
}).strict();

export const askKoiSenseiRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  conversationId: koiConversationId,
  text: z.string().trim().min(1).max(2_000),
}).strict();

export const koiCitationSchema = z.object({
  sourceId: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(200),
  licenseId: z.string().trim().min(1).max(120).optional(),
}).strict();

export const koiAssistantMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: koiConversationId,
  text: z.string().min(1).max(8_000),
  spokenText: z.string().max(240),
  expression: z.enum(['base', 'happy', 'thinking', 'celebrate', 'encourage']),
  createdAtMs: z.number().int().nonnegative(),
}).strict();

export const askKoiSenseiResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  status: z.enum(['answered', 'out_of_scope', 'not_grounded']),
  requestId: koiRequestId,
  assistantMessage: koiAssistantMessageSchema,
  citations: z.array(koiCitationSchema).max(8),
  allowance: koiAllowanceSchema,
}).strict();

export const synthesizeKoiReplyRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  assistantMessageId: z.string().uuid(),
}).strict();

export const synthesizeKoiReplyResponseSchema = z.discriminatedUnion('status', [
  z.object({
    schemaVersion: koiSchemaVersion,
    requestId: koiRequestId,
    status: z.literal('cloud_audio'),
    audioUrl: z.string().url(),
    expiresAtMs: z.number().int().positive(),
    cached: z.boolean(),
    dailyCharacterRemaining: z.number().int().min(0).max(4_000),
    allowance: koiAllowanceSchema,
  }).strict(),
  z.object({
    schemaVersion: koiSchemaVersion,
    requestId: koiRequestId,
    status: z.literal('system_voice_fallback'),
    reason: z.enum(['BUDGET_EXHAUSTED', 'CAPACITY_STALE', 'PROVIDER_UNAVAILABLE']),
    spokenText: z.string().max(240),
    dailyCharacterRemaining: z.number().int().min(0).max(4_000),
    allowance: koiAllowanceSchema,
  }).strict(),
]);

export const upsertKoiMemoryRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  memoryId: z.string().uuid(),
  category: z.enum(['goal', 'preference', 'recurring_mistake', 'useful_phrase']),
  text: z.string().trim().min(1).max(160),
}).strict();

export const upsertKoiMemoryResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  memoryId: z.string().uuid(),
  stored: z.literal(true),
  serverTimeMs: z.number().int().nonnegative(),
}).strict();

export const deleteKoiMemoryRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  memoryId: z.string().uuid(),
}).strict();

export const deleteKoiMemoryResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  memoryId: z.string().uuid(),
  deleted: z.literal(true),
  serverTimeMs: z.number().int().nonnegative(),
}).strict();

export const exportKoiDataRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
}).strict();

export const koiExportMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: koiConversationId,
  role: z.enum(['user', 'assistant']),
  text: z.string().max(8_000),
  createdAtMs: z.number().int().nonnegative(),
}).strict();

export const koiExportMemorySchema = z.object({
  id: z.string().uuid(),
  category: z.enum(['goal', 'preference', 'recurring_mistake', 'useful_phrase']),
  text: z.string().max(160),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
}).strict();

export const koiExportReportSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  reason: z.enum(['incorrect', 'unsafe', 'offensive', 'privacy', 'other']),
  note: z.string().max(240).optional(),
  createdAtMs: z.number().int().nonnegative(),
}).strict();

export const exportKoiDataResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  exportedAtMs: z.number().int().nonnegative(),
  registration: z.object({
    ageBand: koiAgeBand,
    supportLanguage: koiSupportLanguage,
    status: z.enum(['active', 'waitlisted']),
    createdAtMs: z.number().int().nonnegative(),
  }).strict().nullable(),
  learnerContext: koiLearnerContextSchema.nullable(),
  messages: z.array(koiExportMessageSchema).max(200),
  memories: z.array(koiExportMemorySchema).max(20),
  reports: z.array(koiExportReportSchema).max(200),
}).strict();

export const deleteKoiDataRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  confirmation: z.literal('DELETE_KOI_DATA'),
}).strict();

export const deleteKoiDataResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  deleted: z.literal(true),
  serverTimeMs: z.number().int().nonnegative(),
}).strict();

export const reportKoiMessageRequestSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  messageId: z.string().uuid(),
  reason: z.enum(['incorrect', 'unsafe', 'offensive', 'privacy', 'other']),
  note: z.string().trim().max(240).optional(),
}).strict();

export const reportKoiMessageResponseSchema = z.object({
  schemaVersion: koiSchemaVersion,
  requestId: koiRequestId,
  accepted: z.literal(true),
  serverTimeMs: z.number().int().nonnegative(),
}).strict();

export const koiErrorReasonSchema = z.enum([
  'AUTH_REQUIRED',
  'AGE_RESTRICTED',
  'CONSENT_REQUIRED',
  'DETAILED_PROGRESS_CONSENT_REQUIRED',
  'BETA_WAITLISTED',
  'APP_CHECK_FAILED',
  'INVALID_REQUEST',
  'TOKEN_PLAN_BUSY',
  'TOKEN_PLAN_EXHAUSTED',
  'CAPACITY_STALE',
  'CHAT_ALLOWANCE_EXHAUSTED',
  'VOICE_ALLOWANCE_EXHAUSTED',
  'VOICE_CAPACITY_PAUSED',
  'CONTENT_BLOCKED',
  'PROVIDER_UNAVAILABLE',
  'TIMEOUT',
  'INTERNAL',
]);

export type CompleteKoiRegistrationRequest = z.infer<typeof completeKoiRegistrationRequestSchema>;
export type CompleteKoiRegistrationResponse = z.infer<typeof completeKoiRegistrationResponseSchema>;
export type RevokeKoiConsentRequest = z.infer<typeof revokeKoiConsentRequestSchema>;
export type RevokeKoiConsentResponse = z.infer<typeof revokeKoiConsentResponseSchema>;
export type SetKoiDetailedProgressConsentRequest = z.infer<typeof setKoiDetailedProgressConsentRequestSchema>;
export type SetKoiDetailedProgressConsentResponse = z.infer<typeof setKoiDetailedProgressConsentResponseSchema>;
export type GetKoiAllowanceRequest = z.infer<typeof getKoiAllowanceRequestSchema>;
export type GetKoiAllowanceResponse = z.infer<typeof getKoiAllowanceResponseSchema>;
export type KoiLearnerContext = z.infer<typeof koiLearnerContextSchema>;
export type SyncKoiLearningContextRequest = z.infer<typeof syncKoiLearningContextRequestSchema>;
export type SyncKoiLearningContextResponse = z.infer<typeof syncKoiLearningContextResponseSchema>;
export type AskKoiSenseiRequest = z.infer<typeof askKoiSenseiRequestSchema>;
export type AskKoiSenseiResponse = z.infer<typeof askKoiSenseiResponseSchema>;
export type KoiCitation = z.infer<typeof koiCitationSchema>;
export type SynthesizeKoiReplyRequest = z.infer<typeof synthesizeKoiReplyRequestSchema>;
export type SynthesizeKoiReplyResponse = z.infer<typeof synthesizeKoiReplyResponseSchema>;
export type UpsertKoiMemoryRequest = z.infer<typeof upsertKoiMemoryRequestSchema>;
export type UpsertKoiMemoryResponse = z.infer<typeof upsertKoiMemoryResponseSchema>;
export type DeleteKoiMemoryRequest = z.infer<typeof deleteKoiMemoryRequestSchema>;
export type DeleteKoiMemoryResponse = z.infer<typeof deleteKoiMemoryResponseSchema>;
export type ExportKoiDataRequest = z.infer<typeof exportKoiDataRequestSchema>;
export type ExportKoiDataResponse = z.infer<typeof exportKoiDataResponseSchema>;
export type DeleteKoiDataRequest = z.infer<typeof deleteKoiDataRequestSchema>;
export type DeleteKoiDataResponse = z.infer<typeof deleteKoiDataResponseSchema>;
export type ReportKoiMessageRequest = z.infer<typeof reportKoiMessageRequestSchema>;
export type ReportKoiMessageResponse = z.infer<typeof reportKoiMessageResponseSchema>;
export type KoiErrorReason = z.infer<typeof koiErrorReasonSchema>;
