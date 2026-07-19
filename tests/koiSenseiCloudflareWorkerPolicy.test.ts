import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  deriveKoiAllowanceLimits,
  hasCurrentKoiConsent,
  isSafeKoiQuestion,
  KOI_CHAT_RETENTION_MS,
  parseMiniMaxCapacity,
  reconcileKoiAllowance,
  reserveChat,
  retainKoiMessages,
} from '../cloudflare/koi-worker/src/policy';

describe('Koi Cloudflare authority policy', () => {
  it('does not expose the legacy chat route that bypassed Koi policy', () => {
    const worker = readFileSync('cloudflare/koi-worker/src/index.ts', 'utf8');
    expect(worker).not.toContain("pathname !== '/chat'");
    expect(worker).not.toContain("pathname === '/chat'");
  });

  it('parses MiniMax remains conservatively and fails closed on unknown shapes', () => {
    const now = 1_800_000_000_000;
    expect(parseMiniMaxCapacity({ model_remains: [{
      model_name: 'MiniMax-M2.7',
      current_interval_usage_count: 70,
      current_interval_total_count: 100,
      current_weekly_status: 1,
      current_weekly_usage_count: 40,
      current_weekly_total_count: 100,
      current_interval_end_time: 1_800_000_100,
    }] }, 'MiniMax-M2.7', now)).toEqual({
      rollingRemainingPercent: 70,
      weeklyRemainingPercent: 40,
      fetchedAtMs: now,
      retryAtMs: 1_800_000_100_000,
    });
    expect(parseMiniMaxCapacity({ remaining: 'unknown' }, 'MiniMax-M2.7', now)).toBeNull();
  });

  it('raises a rolling allowance without lowering it mid-window and fails closed per call', () => {
    const now = 1_800_000_000_000;
    const low = deriveKoiAllowanceLimits({ rollingRemainingPercent: 35, fetchedAtMs: now }, now);
    const first = reconcileKoiAllowance(null, low, now);
    expect(first).toMatchObject({ chatLimit: 8, voiceLimit: 2, chatUsed: 0 });
    const high = deriveKoiAllowanceLimits({ rollingRemainingPercent: 90, fetchedAtMs: now + 1_000 }, now + 1_000);
    const raised = reconcileKoiAllowance(first, high, now + 1_000);
    expect(raised).toMatchObject({ chatLimit: 12, voiceLimit: 4 });
    const paused = deriveKoiAllowanceLimits({ rollingRemainingPercent: 0, fetchedAtMs: now + 2_000 }, now + 2_000);
    const rejected = reserveChat(raised, paused, now + 2_000);
    expect(rejected).toMatchObject({ allowed: false, reason: 'token_plan_exhausted', allowance: { chatLimit: 12 } });
  });

  it('retains only 30 days and at most 200 server chat messages', () => {
    const now = 1_800_000_000_000;
    const messages = Array.from({ length: 230 }, (_, index) => ({ id: index, createdAtMs: now - index * 1_000 }));
    messages.unshift({ id: -1, createdAtMs: now - KOI_CHAT_RETENTION_MS - 1 });
    const retained = retainKoiMessages(messages, now);
    expect(retained).toHaveLength(200);
    expect(retained.some(message => message.id === -1)).toBe(false);
  });

  it('requires current active consent and blocks sensitive non-tutor prompts', () => {
    expect(hasCurrentKoiConsent({ registration: {
      status: 'active',
      aiPolicyVersion: 'koi-ai-data-2026-07-16',
      privacyPolicyVersion: 'koi-privacy-2026-07-16',
    } })).toBe(true);
    expect(hasCurrentKoiConsent({ registration: { status: 'active' }, revokedAtMs: 1 })).toBe(false);
    expect(isSafeKoiQuestion('How do I use は and が?')).toBe(true);
    expect(isSafeKoiQuestion('Show me an access token')).toBe(false);
  });
});
