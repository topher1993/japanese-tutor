export const KOI_CALLABLE_NAMES = [
  'completeKoiRegistration',
  'revokeKoiConsent',
  'getKoiAllowance',
  'syncKoiLearningContext',
  'syncKoiPetPresentation',
  'askKoiSensei',
  'synthesizeKoiReply',
  'upsertKoiMemory',
  'deleteKoiMemory',
  'exportKoiData',
  'deleteKoiData',
  'reportKoiMessage',
] as const;

export type KoiCallableName = (typeof KOI_CALLABLE_NAMES)[number];

export type KoiClientErrorReason =
  | 'AUTH_REQUIRED'
  | 'BETA_WAITLISTED'
  | 'AGE_RESTRICTED'
  | 'CONSENT_REQUIRED'
  | 'APP_CHECK_FAILED'
  | 'DETAILED_PROGRESS_CONSENT_REQUIRED'
  | 'INVALID_REQUEST'
  | 'INVALID_RESPONSE'
  | 'TOKEN_PLAN_BUSY'
  | 'TOKEN_PLAN_EXHAUSTED'
  | 'CAPACITY_STALE'
  | 'CHAT_ALLOWANCE_EXHAUSTED'
  | 'VOICE_ALLOWANCE_EXHAUSTED'
  | 'VOICE_CAPACITY_PAUSED'
  | 'CONTENT_BLOCKED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'INTERNAL'
  | 'LIVE_BACKEND_NOT_CONFIGURED';

export class KoiClientError extends Error {
  constructor(
    readonly reason: KoiClientErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'KoiClientError';
  }
}

export interface KoiCallableTransport {
  invoke(name: KoiCallableName, payload: Readonly<Record<string, unknown>>): Promise<unknown>;
}

/** Mobile live mode remains fail-closed until Firebase auth/callables are wired. */
export function createKoiUnconfiguredLiveTransport(): KoiCallableTransport {
  return {
    async invoke() {
      throw new KoiClientError(
        'LIVE_BACKEND_NOT_CONFIGURED',
        'Live Koi service is not configured. No provider request was sent.',
      );
    },
  };
}

export interface KoiClientSession {
  authenticated: boolean;
  enrollmentStatus: 'not_registered' | 'active' | 'waitlisted';
  ageBand?: '16_17' | '18_plus';
  aiConsentVersion?: string;
  privacyPolicyVersion?: string;
  usProcessingAcknowledged?: boolean;
  consentedAtMs?: number;
  detailedProgressConsentVersion?: string;
}

export interface KoiAllowanceView {
  chatLimit: number;
  chatUsed: number;
  voiceLimit: number;
  voiceUsed: number;
  expiresAtMs: number;
  capacityBand: 'high' | 'normal' | 'low' | 'critical' | 'paused';
}

export interface KoiAnswer {
  requestId: string;
  status: 'answered' | 'out_of_scope' | 'not_grounded';
  assistantMessage: {
    id: string;
    conversationId: string;
    text: string;
    spokenText: string;
    expression: 'base' | 'happy' | 'thinking' | 'celebrate' | 'encourage';
    createdAtMs: number;
  };
  citations: ReadonlyArray<{ sourceId: string; title: string; licenseId?: string }>;
  allowance: KoiAllowanceView;
}

export interface KoiLearningSummary {
  revision: number;
  consentVersion: string;
  supportLanguage: 'en' | 'vi' | 'tl';
  jlptTarget?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  placementLevel?: 'N5' | 'N4' | 'N3';
  studyGoalId?: string;
  currentLessonId?: string;
  dueCount: number;
  streakDays: number;
  completionCounts: Readonly<Record<string, number>>;
  weakTopicIds: readonly string[];
  masteryBuckets: Readonly<Record<string, number>>;
  recentQuizAverage?: number;
  recentActiveDays: number;
}

export type KoiSynthesisResult =
  | {
      requestId: string;
      status: 'cloud_audio';
      audioUrl: string;
      expiresAtMs: number;
      cached: boolean;
      dailyCharacterRemaining: number;
      allowance: KoiAllowanceView;
    }
  | {
      requestId: string;
      status: 'system_voice_fallback';
      reason: 'BUDGET_EXHAUSTED' | 'CAPACITY_STALE' | 'PROVIDER_UNAVAILABLE';
      spokenText: string;
      dailyCharacterRemaining: number;
      allowance: KoiAllowanceView;
    };

/**
 * Chooses text for the included platform voice without ever fetching or
 * persisting a cloud-audio URL. The assistant's validated spoken text remains
 * the safe fallback when a provider or ephemeral player is unavailable.
 */
export function getKoiSystemVoiceText(
  synthesis: KoiSynthesisResult,
  assistantSpokenText: string,
): string {
  return synthesis.status === 'system_voice_fallback' && synthesis.spokenText
    ? synthesis.spokenText
    : assistantSpokenText;
}

export interface KoiGateway {
  completeRegistration(input: {
    requestId: string;
    ageBand: '16_17' | '18_plus';
    aiPolicyVersion: string;
    privacyPolicyVersion: string;
    supportLanguage: 'en' | 'vi' | 'tl';
  }): Promise<{
    status: 'active' | 'waitlisted';
    activeAccountLimit: 50;
    aiPolicyVersion: string;
    privacyPolicyVersion: string;
    consentedAtMs: number;
  }>;
  getAllowance(requestId: string): Promise<KoiAllowanceView>;
  revokeConsent(requestId: string): Promise<void>;
  upsertMemory(input: {
    requestId: string;
    memoryId: string;
    category: 'goal' | 'preference' | 'recurring_mistake' | 'useful_phrase';
    text: string;
  }): Promise<void>;
  deleteMemory(input: { requestId: string; memoryId: string }): Promise<void>;
  ask(input: { requestId: string; conversationId: string; text: string }): Promise<KoiAnswer>;
  submitQuizAnswer(input: { requestId: string; questionId: string; answer: string; domain: 'vocabulary' | 'grammar' | 'phrases' | 'quizzes'; rank: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' }): Promise<{ correct: boolean; evidenceCount: number; practiceStars: number; masteryStars: number }>;
  syncLearningSummary(input: { requestId: string; context: KoiLearningSummary }): Promise<void>;
  syncPetPresentation(input: {
    requestId: string;
    presentation: {
      revision: number;
      avatarMode: '3d' | '2d';
      effectPreference: 'full' | 'reduced' | 'off';
      equippedCosmeticIds: Partial<Record<'crest' | 'face' | 'back' | 'hand', string>>;
      selectedDojoThemeId: string;
    };
  }): Promise<void>;
  synthesize(input: { requestId: string; assistantMessageId: string }): Promise<KoiSynthesisResult>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireUuid(label: string, value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new KoiClientError('INVALID_REQUEST', `${label} must be a UUID.`);
  }
  return value;
}

function requireActiveSession(session: KoiClientSession): void {
  if (!session.authenticated) {
    throw new KoiClientError('AUTH_REQUIRED', 'Sign in before using Koi Sensei online.');
  }
  if (!session.ageBand) {
    throw new KoiClientError('AGE_RESTRICTED', 'Koi Sensei is available only after 16+ age confirmation.');
  }
  if (!session.aiConsentVersion
    || !session.privacyPolicyVersion
    || session.usProcessingAcknowledged !== true
    || !Number.isSafeInteger(session.consentedAtMs)
    || (session.consentedAtMs ?? -1) < 0) {
    throw new KoiClientError('CONSENT_REQUIRED', 'Accept the current AI and privacy notice before chatting.');
  }
  if (session.enrollmentStatus !== 'active') {
    throw new KoiClientError('BETA_WAITLISTED', 'This account is not in the active 50-person beta.');
  }
}

function requireAuthenticatedSession(session: KoiClientSession): void {
  if (!session.authenticated) {
    throw new KoiClientError('AUTH_REQUIRED', 'Sign in before using Koi Sensei online.');
  }
}

function finiteInteger(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every(key => allowedKeys.has(key));
}

function parseAllowance(value: unknown): KoiAllowanceView {
  if (!isRecord(value)) throw new KoiClientError('INVALID_RESPONSE', 'The Koi allowance response is invalid.');
  const grantedAtMs = finiteInteger(value.grantedAtMs, 0, Number.MAX_SAFE_INTEGER);
  const chatLimit = finiteInteger(value.chatLimit, 0, 12);
  const chatUsed = finiteInteger(value.chatUsed, 0, 1_000_000);
  const voiceLimit = finiteInteger(value.voiceLimit, 0, 4);
  const voiceUsed = finiteInteger(value.voiceUsed, 0, 1_000_000);
  const expiresAtMs = finiteInteger(value.expiresAtMs, 1, Number.MAX_SAFE_INTEGER);
  const providerRetryAtMs = value.providerRetryAtMs === undefined
    ? undefined
    : finiteInteger(value.providerRetryAtMs, 0, Number.MAX_SAFE_INTEGER);
  const capacityBand = value.capacityBand;
  if (value.schemaVersion !== 1 || grantedAtMs === null
    || chatLimit === null || chatUsed === null || voiceLimit === null || voiceUsed === null
    || expiresAtMs === null
    || providerRetryAtMs === null
    || !hasOnlyKeys(value, [
      'schemaVersion',
      'grantedAtMs',
      'expiresAtMs',
      'chatLimit',
      'chatUsed',
      'voiceLimit',
      'voiceUsed',
      'capacityBand',
      'providerRetryAtMs',
    ])
    || !['high', 'normal', 'low', 'critical', 'paused'].includes(String(capacityBand))) {
    throw new KoiClientError('INVALID_RESPONSE', 'The Koi allowance response is invalid.');
  }
  return {
    chatLimit,
    chatUsed,
    voiceLimit,
    voiceUsed,
    expiresAtMs,
    capacityBand: capacityBand as KoiAllowanceView['capacityBand'],
  };
}

function parseAnswer(value: unknown, requestId: string, conversationId: string): KoiAnswer {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.requestId !== requestId
    || !['answered', 'out_of_scope', 'not_grounded'].includes(String(value.status))
    || !isRecord(value.assistantMessage) || !Array.isArray(value.citations)) {
    throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid answer.');
  }
  const message = value.assistantMessage;
  if (!UUID_PATTERN.test(String(message.id)) || message.conversationId !== conversationId
    || typeof message.text !== 'string' || message.text.length < 1 || message.text.length > 8_000
    || typeof message.spokenText !== 'string' || message.spokenText.length > 240
    || !['base', 'happy', 'thinking', 'celebrate', 'encourage'].includes(String(message.expression))
    || finiteInteger(message.createdAtMs, 0, Number.MAX_SAFE_INTEGER) === null) {
    throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid message.');
  }
  const citations = value.citations.map(entry => {
    if (!isRecord(entry) || typeof entry.sourceId !== 'string' || !entry.sourceId
      || typeof entry.title !== 'string' || !entry.title
      || (entry.licenseId !== undefined && typeof entry.licenseId !== 'string')) {
      throw new KoiClientError('INVALID_RESPONSE', 'Koi returned invalid source information.');
    }
    return {
      sourceId: entry.sourceId,
      title: entry.title,
      ...(entry.licenseId === undefined ? {} : { licenseId: entry.licenseId }),
    };
  });
  if (citations.length > 8) throw new KoiClientError('INVALID_RESPONSE', 'Koi returned too many sources.');
  return {
    requestId,
    status: value.status as KoiAnswer['status'],
    assistantMessage: {
      id: message.id as string,
      conversationId,
      text: message.text,
      spokenText: message.spokenText,
      expression: message.expression as KoiAnswer['assistantMessage']['expression'],
      createdAtMs: message.createdAtMs as number,
    },
    citations,
    allowance: parseAllowance(value.allowance),
  };
}

function parseSynthesis(value: unknown, requestId: string): KoiSynthesisResult {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.requestId !== requestId) {
    throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid voice response.');
  }
  const dailyCharacterRemaining = finiteInteger(value.dailyCharacterRemaining, 0, 4_000);
  if (dailyCharacterRemaining === null) {
    throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid voice budget.');
  }
  const allowance = parseAllowance(value.allowance);

  if (value.status === 'cloud_audio') {
    if (!hasOnlyKeys(value, [
      'schemaVersion',
      'requestId',
      'status',
      'audioUrl',
      'expiresAtMs',
      'cached',
      'dailyCharacterRemaining',
      'allowance',
    ])
      || typeof value.audioUrl !== 'string' || !/^https:\/\/[^\s/]+(?:\/|$)/u.test(value.audioUrl)
      || finiteInteger(value.expiresAtMs, 1, Number.MAX_SAFE_INTEGER) === null
      || typeof value.cached !== 'boolean') {
      throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid cloud voice response.');
    }
    return {
      requestId,
      status: 'cloud_audio',
      audioUrl: value.audioUrl,
      expiresAtMs: value.expiresAtMs as number,
      cached: value.cached,
      dailyCharacterRemaining,
      allowance,
    };
  }

  if (value.status === 'system_voice_fallback') {
    if (!hasOnlyKeys(value, [
      'schemaVersion',
      'requestId',
      'status',
      'reason',
      'spokenText',
      'dailyCharacterRemaining',
      'allowance',
    ])
      || !['BUDGET_EXHAUSTED', 'CAPACITY_STALE', 'PROVIDER_UNAVAILABLE'].includes(String(value.reason))
      || typeof value.spokenText !== 'string' || value.spokenText.length > 240) {
      throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid system-voice fallback.');
    }
    return {
      requestId,
      status: 'system_voice_fallback',
      reason: value.reason as Extract<KoiSynthesisResult, { status: 'system_voice_fallback' }>['reason'],
      spokenText: value.spokenText,
      dailyCharacterRemaining,
      allowance,
    };
  }

  throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an unknown voice response.');
}

function validateLearningSummary(summary: KoiLearningSummary): void {
  if (!Number.isSafeInteger(summary.revision) || summary.revision < 0
    || !summary.consentVersion.trim()
    || !['en', 'vi', 'tl'].includes(summary.supportLanguage)
    || !Number.isSafeInteger(summary.dueCount) || summary.dueCount < 0
    || !Number.isSafeInteger(summary.streakDays) || summary.streakDays < 0
    || !Number.isSafeInteger(summary.recentActiveDays)
    || summary.recentActiveDays < 0 || summary.recentActiveDays > 30
    || summary.weakTopicIds.length > 100) {
    throw new KoiClientError('INVALID_REQUEST', 'The approved learning summary is invalid.');
  }
}

/**
 * Typed mobile boundary for authenticated Firebase callables. The transport is
 * injected so this module never imports or receives a MiniMax credential.
 * Speech-to-text must supply text to `ask`; raw microphone bytes are not part
 * of any public method.
 */
export function createKoiGateway(
  transport: KoiCallableTransport,
  getSession: () => KoiClientSession,
): KoiGateway {
  return {
    async completeRegistration(input) {
      requireAuthenticatedSession(getSession());
      const requestId = requireUuid('requestId', input.requestId);
      if (!['16_17', '18_plus'].includes(input.ageBand)
        || !input.aiPolicyVersion.trim() || !input.privacyPolicyVersion.trim()
        || !['en', 'vi', 'tl'].includes(input.supportLanguage)) {
        throw new KoiClientError('INVALID_REQUEST', 'Koi registration details are invalid.');
      }
      const response = await transport.invoke('completeKoiRegistration', {
        schemaVersion: 1,
        requestId,
        ageBand: input.ageBand,
        aiPolicyVersion: input.aiPolicyVersion,
        privacyPolicyVersion: input.privacyPolicyVersion,
        acknowledgedUsProcessing: true,
        supportLanguage: input.supportLanguage,
      });
      if (!isRecord(response)
        || response.schemaVersion !== 1
        || !['active', 'waitlisted'].includes(String(response.status))
        || response.activeAccountLimit !== 50
        || response.aiPolicyVersion !== input.aiPolicyVersion
        || response.privacyPolicyVersion !== input.privacyPolicyVersion
        || finiteInteger(response.consentedAtMs, 0, Number.MAX_SAFE_INTEGER) === null
        || finiteInteger(response.serverTimeMs, 0, Number.MAX_SAFE_INTEGER) === null) {
        throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid registration result.');
      }
      return {
        status: response.status as 'active' | 'waitlisted',
        activeAccountLimit: 50 as const,
        aiPolicyVersion: response.aiPolicyVersion,
        privacyPolicyVersion: response.privacyPolicyVersion,
        consentedAtMs: response.consentedAtMs as number,
      };
    },

    async getAllowance(requestIdValue) {
      requireAuthenticatedSession(getSession());
      const requestId = requireUuid('requestId', requestIdValue);
      const response = await transport.invoke('getKoiAllowance', { schemaVersion: 1, requestId });
      if (!isRecord(response) || response.schemaVersion !== 1 || response.requestId !== requestId
        || finiteInteger(response.serverTimeMs, 0, Number.MAX_SAFE_INTEGER) === null) {
        throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid allowance result.');
      }
      return parseAllowance(response.allowance);
    },

    async revokeConsent(requestIdValue) {
      requireAuthenticatedSession(getSession());
      const requestId = requireUuid('requestId', requestIdValue);
      const response = await transport.invoke('revokeKoiConsent', {
        schemaVersion: 1,
        requestId,
        confirmation: 'REVOKE_KOI_AI_CONSENT',
      });
      if (!isRecord(response) || response.schemaVersion !== 1 || response.requestId !== requestId
        || response.revoked !== true
        || finiteInteger(response.serverTimeMs, 0, Number.MAX_SAFE_INTEGER) === null) {
        throw new KoiClientError('INVALID_RESPONSE', 'Koi did not confirm consent revocation.');
      }
    },

    async upsertMemory(input) {
      requireActiveSession(getSession());
      const requestId = requireUuid('requestId', input.requestId);
      const memoryId = requireUuid('memoryId', input.memoryId);
      const text = input.text.trim();
      if (!['goal', 'preference', 'recurring_mistake', 'useful_phrase'].includes(input.category)
        || !text || text.length > 160) {
        throw new KoiClientError('INVALID_REQUEST', 'A Koi memory must have a valid category and 1 to 160 characters.');
      }
      const response = await transport.invoke('upsertKoiMemory', {
        schemaVersion: 1,
        requestId,
        memoryId,
        category: input.category,
        text,
      });
      if (!isRecord(response) || response.schemaVersion !== 1 || response.requestId !== requestId
        || response.memoryId !== memoryId || response.stored !== true
        || finiteInteger(response.serverTimeMs, 0, Number.MAX_SAFE_INTEGER) === null) {
        throw new KoiClientError('INVALID_RESPONSE', 'Koi did not confirm the approved memory.');
      }
    },

    async deleteMemory(input) {
      requireActiveSession(getSession());
      const requestId = requireUuid('requestId', input.requestId);
      const memoryId = requireUuid('memoryId', input.memoryId);
      const response = await transport.invoke('deleteKoiMemory', { schemaVersion: 1, requestId, memoryId });
      if (!isRecord(response) || response.schemaVersion !== 1 || response.requestId !== requestId
        || response.memoryId !== memoryId || response.deleted !== true
        || finiteInteger(response.serverTimeMs, 0, Number.MAX_SAFE_INTEGER) === null) {
        throw new KoiClientError('INVALID_RESPONSE', 'Koi did not confirm memory deletion.');
      }
    },

    async ask(input) {
      requireActiveSession(getSession());
      const requestId = requireUuid('requestId', input.requestId);
      const conversationId = requireUuid('conversationId', input.conversationId);
      const text = input.text.trim();
      if (!text || text.length > 2_000) {
        throw new KoiClientError('INVALID_REQUEST', 'A Koi question must contain 1 to 2,000 characters.');
      }
      const response = await transport.invoke('askKoiSensei', {
        schemaVersion: 1,
        requestId,
        conversationId,
        text,
      });
      return parseAnswer(response, requestId, conversationId);
    },

    async submitQuizAnswer(input) {
      requireActiveSession(getSession());
      const requestId = requireUuid('requestId', input.requestId);
      if (!input.questionId.trim() || input.questionId.length > 160 || !input.answer.trim()
        || !['vocabulary', 'grammar', 'phrases', 'quizzes'].includes(input.domain)
        || !['N5', 'N4', 'N3', 'N2', 'N1'].includes(input.rank)) {
        throw new KoiClientError('INVALID_REQUEST', 'The quiz submission is invalid.');
      }
      const response = await transport.invoke('submitQuizAnswer' as KoiCallableName, {
        schemaVersion: 1,
        requestId,
        questionId: input.questionId,
        answer: input.answer,
        domain: input.domain,
        rank: input.rank,
      });
      if (!isRecord(response) || response.schemaVersion !== 1 || response.requestId !== requestId
        || typeof response.correct !== 'boolean'
        || finiteInteger(response.evidenceCount, 0, Number.MAX_SAFE_INTEGER) === null
        || finiteInteger(response.practiceStars, 0, 8) === null
        || finiteInteger(response.masteryStars, 0, 8) === null) {
        throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid quiz evidence result.');
      }
      return { correct: response.correct, evidenceCount: response.evidenceCount as number, practiceStars: response.practiceStars as number, masteryStars: response.masteryStars as number };
    },

    async syncLearningSummary(input) {
      const session = getSession();
      requireActiveSession(session);
      if (!session.detailedProgressConsentVersion
        || input.context.consentVersion !== session.detailedProgressConsentVersion) {
        throw new KoiClientError(
          'DETAILED_PROGRESS_CONSENT_REQUIRED',
          'Detailed progress sharing is off or its consent version is stale.',
        );
      }
      validateLearningSummary(input.context);
      const requestId = requireUuid('requestId', input.requestId);
      const response = await transport.invoke('syncKoiLearningContext', {
        schemaVersion: 1,
        requestId,
        context: input.context,
      });
      if (!isRecord(response) || response.schemaVersion !== 1 || response.requestId !== requestId
        || response.acceptedRevision !== input.context.revision
        || finiteInteger(response.serverTimeMs, 0, Number.MAX_SAFE_INTEGER) === null) {
        throw new KoiClientError('INVALID_RESPONSE', 'Koi did not confirm the learning summary.');
      }
    },

    async syncPetPresentation(input) {
      requireActiveSession(getSession());
      const requestId = requireUuid('requestId', input.requestId);
      if (!Number.isSafeInteger(input.presentation.revision) || input.presentation.revision < 0
        || !['3d', '2d'].includes(input.presentation.avatarMode)
        || !['full', 'reduced', 'off'].includes(input.presentation.effectPreference)
        || typeof input.presentation.selectedDojoThemeId !== 'string'
        || input.presentation.selectedDojoThemeId.length > 160) {
        throw new KoiClientError('INVALID_REQUEST', 'The Koi pet presentation is invalid.');
      }
      const response = await transport.invoke('syncKoiPetPresentation', {
        schemaVersion: 1,
        requestId,
        presentation: input.presentation,
      });
      if (!isRecord(response) || response.schemaVersion !== 1 || response.requestId !== requestId
        || finiteInteger(response.acceptedRevision, 0, Number.MAX_SAFE_INTEGER) === null
        || finiteInteger(response.serverTimeMs, 0, Number.MAX_SAFE_INTEGER) === null
        || (response.acceptedRevision as number) < input.presentation.revision) {
        throw new KoiClientError('INVALID_RESPONSE', 'Koi did not confirm the pet presentation sync.');
      }
    },

    async synthesize(input) {
      requireActiveSession(getSession());
      const requestId = requireUuid('requestId', input.requestId);
      const response = await transport.invoke('synthesizeKoiReply', {
        schemaVersion: 1,
        requestId,
        assistantMessageId: requireUuid('assistantMessageId', input.assistantMessageId),
      });
      return parseSynthesis(response, requestId);
    },
  };
}
