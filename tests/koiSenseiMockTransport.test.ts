import { describe, expect, it } from 'vitest';

import {
  createKoiGateway,
  createKoiMockTransport,
} from '../src/features/koi-sensei/api';

const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';
const CONVERSATION_ID = '223e4567-e89b-42d3-a456-426614174000';

const session = () => ({
  authenticated: true,
  enrollmentStatus: 'active' as const,
  ageBand: '18_plus' as const,
  aiConsentVersion: 'mock-v1',
  privacyPolicyVersion: 'privacy-v1',
  usProcessingAcknowledged: true,
  consentedAtMs: 1,
  detailedProgressConsentVersion: 'progress-v1',
});

describe('Koi deterministic mobile mock', () => {
  it('answers a supported Japanese question without any network or secret', async () => {
    const gateway = createKoiGateway(
      createKoiMockTransport({ now: () => 100 }),
      session,
    );
    const answer = await gateway.ask({
      requestId: REQUEST_ID,
      conversationId: CONVERSATION_ID,
      text: 'What is the difference between は and が?',
    });
    expect(answer.status).toBe('answered');
    expect(answer.assistantMessage.text).toContain('topic');
    expect(answer.citations[0].sourceId).toBe('mock.grammar.n5.wa-ga');
    expect(answer.allowance.chatUsed).toBe(1);
  });

  it('keeps general questions out of the tutor scope', async () => {
    const gateway = createKoiGateway(createKoiMockTransport({ now: () => 100 }), session);
    const answer = await gateway.ask({
      requestId: REQUEST_ID,
      conversationId: CONVERSATION_ID,
      text: 'Write my quarterly business report.',
    });
    expect(answer.status).toBe('out_of_scope');
    expect(answer.citations).toEqual([]);
  });

  it('simulates the exact high-band 12-chat rolling allowance', async () => {
    const transport = createKoiMockTransport({ now: () => 100 });
    for (let index = 0; index < 12; index += 1) {
      const suffix = index.toString(16).padStart(12, '0');
      await transport.invoke('askKoiSensei', {
        schemaVersion: 1,
        requestId: `123e4567-e89b-42d3-a456-${suffix}`,
        conversationId: CONVERSATION_ID,
        text: 'Japanese grammar',
      });
    }
    await expect(transport.invoke('askKoiSensei', {
      schemaVersion: 1,
      requestId: '123e4567-e89b-42d3-a456-ffffffffffff',
      conversationId: CONVERSATION_ID,
      text: 'Japanese grammar',
    })).rejects.toMatchObject({ reason: 'CHAT_ALLOWANCE_EXHAUSTED' });
  });

  it('always selects system voice instead of fabricating provider audio', async () => {
    const gateway = createKoiGateway(createKoiMockTransport({ now: () => 100 }), session);
    const answer = await gateway.ask({
      requestId: REQUEST_ID,
      conversationId: CONVERSATION_ID,
      text: 'Japanese grammar',
    });
    await expect(gateway.synthesize({
      requestId: CONVERSATION_ID,
      assistantMessageId: answer.assistantMessage.id,
    })).resolves.toMatchObject({
      status: 'system_voice_fallback',
      reason: 'PROVIDER_UNAVAILABLE',
      spokenText: answer.assistantMessage.spokenText,
      dailyCharacterRemaining: 4_000,
    });
  });
});
