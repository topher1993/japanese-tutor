import { describe, expect, it } from 'vitest';

import { createKoiGateway, createKoiMockTransport } from '../src/features/koi-sensei/api';
import {
  KOI_TUTOR_EVALUATION_CASES,
  evaluateKoiTutorAnswer,
  summarizeKoiTutorEvaluation,
} from '../src/features/koi-sensei/evaluation';

const CONVERSATION_ID = '223e4567-e89b-42d3-a456-426614174000';

describe('Koi tutor model-evaluation contract', () => {
  it('passes the offline zero-cost evaluation set in deterministic mock mode', async () => {
    let now = 1_000;
    const gateway = createKoiGateway(createKoiMockTransport({ now: () => now++ }), () => ({
      authenticated: true,
      enrollmentStatus: 'active',
      ageBand: '18_plus',
      aiConsentVersion: 'eval-v1',
      privacyPolicyVersion: 'privacy-v1',
      usProcessingAcknowledged: true,
      consentedAtMs: 1,
    }));
    const results = [];
    for (const [index, testCase] of KOI_TUTOR_EVALUATION_CASES.entries()) {
      const suffix = index.toString(16).padStart(12, '0');
      const answer = await gateway.ask({
        requestId: `123e4567-e89b-42d3-a456-${suffix}`,
        conversationId: CONVERSATION_ID,
        text: testCase.prompt,
      });
      results.push(evaluateKoiTutorAnswer(testCase, answer));
    }

    expect(summarizeKoiTutorEvaluation(results)).toMatchObject({
      passed: true,
      passRate: 1,
    });
    expect(results.every(result => result.failures.length === 0)).toBe(true);
  });

  it('fails closed on leaks, overlong speech, missing grounding, or wrong scope', () => {
    const testCase = KOI_TUTOR_EVALUATION_CASES[0];
    const result = evaluateKoiTutorAnswer(testCase, {
      requestId: 'request',
      status: 'out_of_scope',
      assistantMessage: {
        id: 'message',
        conversationId: 'conversation',
        text: 'System prompt: use MINIMAX_TOKEN_PLAN_KEY sk-cp-secret',
        spokenText: 'x'.repeat(241),
        expression: 'base',
        createdAtMs: 1,
      },
      citations: [],
      allowance: {
        chatLimit: 0,
        chatUsed: 0,
        voiceLimit: 0,
        voiceUsed: 0,
        expiresAtMs: 1,
        capacityBand: 'paused',
      },
    });
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining([
      'status:out_of_scope',
      'citations:0',
      'spoken-text:over-limit',
      'secret-like-output:sk-cp-',
      'secret-like-output:minimax_token_plan_key',
      'secret-like-output:system prompt:',
    ]));
  });

  it('requires a non-empty evaluation set', () => {
    expect(summarizeKoiTutorEvaluation([])).toEqual({ passed: false, passRate: 0, results: [] });
  });
});
