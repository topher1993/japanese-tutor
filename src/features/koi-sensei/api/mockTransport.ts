import {
  consumeKoiAllowance,
  deriveKoiAllowanceLimits,
  reconcileKoiAllowanceGrant,
  type KoiAllowanceGrantV1,
} from './quotaPolicy';
import type { KoiCallableName, KoiCallableTransport } from './gateway';

export interface KoiMockTransportOptions {
  now?: () => number;
  remainingPercent?: number;
  usageMode?: 'personal_unlimited' | 'metered';
}

export class KoiMockTransportError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message);
    this.name = 'KoiMockTransportError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseMessageId(requestId: string): string {
  // Request ids are already unique UUIDs. Replacing the version/variant nibble
  // yields a deterministic but distinct valid UUID for repeatable mock tests.
  return `${requestId.slice(0, 14)}4${requestId.slice(15, 19)}a${requestId.slice(20)}`;
}

function mockTutorReply(text: string): {
  status: 'answered' | 'out_of_scope';
  text: string;
  spokenText: string;
  expression: 'thinking' | 'encourage';
  citations: ReadonlyArray<{ sourceId: string; title: string }>;
} {
  const normalized = text.toLocaleLowerCase();
  if (/\b(?:は|wa)\b.*\b(?:が|ga)\b|difference.*(?:は|wa).*(?:が|ga)/iu.test(normalized)) {
    return {
      status: 'answered',
      text: '「は」 marks the topic—the frame of what you are talking about. 「が」 often identifies or emphasizes the subject. Compare: 私は学生です (as for me, I am a student) and 私がします (I am the one who will do it).',
      spokenText: 'は marks the topic. が often identifies or emphasizes the subject.',
      expression: 'thinking',
      citations: [{ sourceId: 'mock.grammar.n5.wa-ga', title: 'Mock N5 grammar note: は and が' }],
    };
  }
  if (/です|desu|polite|formal/u.test(normalized)) {
    return {
      status: 'answered',
      text: '「です」 is a polite sentence ending used after nouns and な-adjectives. For example, 先生です means “is a teacher,” and 静かです means “is quiet.”',
      spokenText: 'です is a polite sentence ending used after nouns and な adjectives.',
      expression: 'thinking',
      citations: [{ sourceId: 'mock.grammar.n5.desu', title: 'Mock N5 grammar note: です' }],
    };
  }
  if (/japanese|nihongo|grammar|vocab|word|phrase|kanji|hiragana|katakana|translate|日本語|文法|単語|漢字/iu.test(normalized)) {
    return {
      status: 'answered',
      text: 'Mock Koi is ready for Japanese practice. Try asking: “What is the difference between は and が?” Live answers stay off until the subscription-only provider safeguards are approved.',
      spokenText: 'Mock Koi is ready for Japanese practice.',
      expression: 'encourage',
      citations: [{ sourceId: 'mock.guide.scope', title: 'Koi mock-mode guide' }],
    };
  }
  return {
    status: 'out_of_scope',
    text: 'I can help with Japanese vocabulary, grammar, phrases, reading, and study practice. Please rephrase this as a Japanese-learning question.',
    spokenText: 'Please ask me a Japanese learning question.',
    expression: 'encourage',
    citations: [],
  };
}

/** Deterministic, credential-free callable transport for emulator-free work.
 * It mirrors server response envelopes but never performs a network request. */
export function createKoiMockTransport(
  options: KoiMockTransportOptions = {},
): KoiCallableTransport {
  const now = options.now ?? Date.now;
  const remainingPercent = options.remainingPercent ?? 100;
  let grant: KoiAllowanceGrantV1 | null = null;
  const spokenReplies = new Map<string, string>();

  return {
    async invoke(name: KoiCallableName, payload: Readonly<Record<string, unknown>>): Promise<unknown> {
      const nowMs = now();
      const limits = deriveKoiAllowanceLimits({
        rollingRemainingPercent: remainingPercent,
        weeklyRemainingPercent: remainingPercent,
        fetchedAtMs: nowMs,
      }, nowMs, options.usageMode ?? 'personal_unlimited');
      grant = reconcileKoiAllowanceGrant(grant, limits, nowMs);

      if (name === 'syncKoiLearningContext') {
        if (!isRecord(payload) || typeof payload.requestId !== 'string'
          || !isRecord(payload.context) || !Number.isSafeInteger(payload.context.revision)) {
          throw new KoiMockTransportError('INVALID_REQUEST', 'The mock learning summary is invalid.');
        }
        return {
          schemaVersion: 1,
          requestId: payload.requestId,
          acceptedRevision: payload.context.revision,
          serverTimeMs: nowMs,
        };
      }
      if (name === 'synthesizeKoiReply') {
        // Mock mode intentionally proves the system-voice fallback path; it
        // never fabricates cloud audio or consumes a provider allowance.
        if (!isRecord(payload) || typeof payload.requestId !== 'string'
          || typeof payload.assistantMessageId !== 'string') {
          throw new KoiMockTransportError('INVALID_REQUEST', 'The mock voice request is invalid.');
        }
        return {
          schemaVersion: 1,
          requestId: payload.requestId,
          status: 'system_voice_fallback',
          reason: 'PROVIDER_UNAVAILABLE',
          spokenText: spokenReplies.get(payload.assistantMessageId) ?? '',
          dailyCharacterRemaining: 4_000,
          allowance: grant,
        };
      }
      if (name !== 'askKoiSensei') {
        throw new KoiMockTransportError('NOT_IMPLEMENTED_IN_MOCK', `${name} is not implemented by the mobile mock.`);
      }

      const decision = consumeKoiAllowance(grant, 'chat', limits);
      if (!decision.allowed) {
        throw new KoiMockTransportError(decision.reason, 'The simulated rolling chat allowance is exhausted.');
      }
      grant = decision.grant;
      if (!isRecord(payload) || typeof payload.requestId !== 'string'
        || typeof payload.conversationId !== 'string' || typeof payload.text !== 'string') {
        throw new KoiMockTransportError('INVALID_REQUEST', 'The mock Koi request is invalid.');
      }
      const reply = mockTutorReply(payload.text);
      const messageId = responseMessageId(payload.requestId);
      spokenReplies.set(messageId, reply.spokenText);
      return {
        schemaVersion: 1,
        requestId: payload.requestId,
        status: reply.status,
        assistantMessage: {
          id: messageId,
          conversationId: payload.conversationId,
          text: reply.text,
          spokenText: reply.spokenText,
          expression: reply.expression,
          createdAtMs: nowMs,
        },
        citations: reply.citations,
        allowance: grant,
      };
    },
  };
}
