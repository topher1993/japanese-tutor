import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  askKoiSenseiRequestSchema,
  deleteKoiDataRequestSchema,
  synthesizeKoiReplyResponseSchema,
} from '../../shared/koi/contracts.js';

describe('Koi callable contracts', () => {
  it('rejects unknown request fields and oversized prompts', () => {
    const valid = {
      schemaVersion: 1,
      requestId: randomUUID(),
      conversationId: randomUUID(),
      text: 'What does は mark?',
    };
    expect(askKoiSenseiRequestSchema.safeParse(valid).success).toBe(true);
    expect(askKoiSenseiRequestSchema.safeParse({ ...valid, secret: 'nope' }).success).toBe(false);
    expect(askKoiSenseiRequestSchema.safeParse({ ...valid, text: 'x'.repeat(2_001) }).success).toBe(false);
  });

  it('requires an explicit deletion confirmation literal', () => {
    const base = { schemaVersion: 1, requestId: randomUUID() };
    expect(deleteKoiDataRequestSchema.safeParse({ ...base, confirmation: 'DELETE_KOI_DATA' }).success).toBe(true);
    expect(deleteKoiDataRequestSchema.safeParse({ ...base, confirmation: 'yes' }).success).toBe(false);
  });

  it('models system voice fallback without pretending cloud audio exists', () => {
    const parsed = synthesizeKoiReplyResponseSchema.safeParse({
      schemaVersion: 1,
      requestId: randomUUID(),
      status: 'system_voice_fallback',
      reason: 'BUDGET_EXHAUSTED',
      spokenText: 'Let us practice.',
      dailyCharacterRemaining: 0,
      allowance: {
        schemaVersion: 1,
        grantedAtMs: 1,
        expiresAtMs: 2,
        chatLimit: 12,
        chatUsed: 0,
        voiceLimit: 4,
        voiceUsed: 0,
        capacityBand: 'high',
        usageMode: 'personal_unlimited',
      },
    });
    expect(parsed.success).toBe(true);
  });
});
