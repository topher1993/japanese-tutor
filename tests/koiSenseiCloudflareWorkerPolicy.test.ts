import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  deriveKoiAllowanceLimits,
  hasCurrentKoiConsent,
  isSafeKoiQuestion,
  normalizeKoiReplyText,
  KOI_CHAT_RETENTION_MS,
  parseMiniMaxCapacity,
  reconcileKoiAllowance,
  reconcileKoiQuestionEvidence,
  resolveGovernedKoiQuestion,
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

  it('accepts the current generic percentage response used by Token Plan accounts', () => {
    const now = 1_800_000_000_000;
    expect(parseMiniMaxCapacity({
      model_remains: [{
        model_name: 'general',
        current_interval_status: 1,
        current_interval_total_count: 0,
        current_interval_usage_count: 0,
        current_interval_remaining_percent: 95,
        current_weekly_status: 1,
        current_weekly_total_count: 0,
        current_weekly_usage_count: 0,
        current_weekly_remaining_percent: 99,
        end_time: 1_800_000_100_000,
      }],
      base_resp: { status_code: 0, status_msg: 'success' },
    }, 'MiniMax-M2.7', now)).toEqual({
      rollingRemainingPercent: 95,
      weeklyRemainingPercent: 99,
      fetchedAtMs: now,
      retryAtMs: 1_800_000_100_000,
    });
  });

  it('fails closed on ambiguous text-family entries and unsupported interval status', () => {
    const now = 1_800_000_000_000;
    expect(parseMiniMaxCapacity({ model_remains: [
      { model_name: 'MiniMax-M2', current_interval_remaining_percent: 90 },
      { model_name: 'MiniMax-M2.5', current_interval_remaining_percent: 80 },
    ] }, 'MiniMax-M2.7', now)).toBeNull();
    expect(parseMiniMaxCapacity({ model_remains: [{
      model_name: 'general',
      current_interval_status: 3,
      current_interval_remaining_percent: 100,
    }] }, 'MiniMax-M2.7', now)).toBeNull();
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

  it('removes the app chat cap in personal mode while keeping provider exhaustion fail-closed', () => {
    const now = 1_800_000_000_000;
    const personal = deriveKoiAllowanceLimits(
      { rollingRemainingPercent: 90, fetchedAtMs: now },
      now,
      'personal_unlimited',
    );
    const exhaustedGrant = {
      ...reconcileKoiAllowance(null, personal, now),
      chatUsed: 12,
    };
    expect(reserveChat(exhaustedGrant, personal, now + 1)).toMatchObject({
      allowed: true,
      allowance: { usageMode: 'personal_unlimited', chatUsed: 13 },
    });

    const providerExhausted = deriveKoiAllowanceLimits(
      { rollingRemainingPercent: 0, fetchedAtMs: now + 2 },
      now + 2,
      'personal_unlimited',
    );
    expect(reserveChat(exhaustedGrant, providerExhausted, now + 2)).toMatchObject({
      allowed: false,
      reason: 'token_plan_exhausted',
    });
  });

  it('configures the deployed Worker for personal unlimited usage without a daily app limit', () => {
    const config = readFileSync('cloudflare/koi-worker/wrangler.jsonc', 'utf8');
    expect(config).toContain('"KOI_USAGE_MODE": "personal_unlimited"');
    expect(config).not.toContain('KOI_DAILY_REQUEST_LIMIT');
  });

  it('keeps detailed-progress consent server-authoritative on Cloudflare', () => {
    const worker = readFileSync('cloudflare/koi-worker/src/index.ts', 'utf8');
    expect(worker).toContain("'setKoiDetailedProgressConsent'");
    expect(worker).toContain("payload.policyVersion === 'koi-detailed-progress-2026-07-17'");
    expect(worker).toContain('payload.policyVersion === undefined');
  });

  it('deletes the personal account identifier and retention alarm with Koi cloud data', () => {
    const worker = readFileSync('cloudflare/koi-worker/src/index.ts', 'utf8');
    expect(worker).toContain("this.ctx.storage.delete('owner_uid')");
    expect(worker).toContain('await this.ctx.storage.deleteAlarm()');
  });

  it('claims the personal owner only during validated registration and uses expiring provider leases', () => {
    const worker = readFileSync('cloudflare/koi-worker/src/index.ts', 'utf8');
    expect(worker).toContain("name === 'completeKoiRegistration'");
    expect(worker).toContain('claimOwner = false');
    expect(worker).toContain('CREATE TABLE IF NOT EXISTS provider_leases');
    expect(worker).toContain('DELETE FROM provider_leases WHERE expires_at_ms <= ?');
    expect(worker).toContain('await global.release(leaseId)');
  });

  it('bounds public request bodies and validates verified-email Firebase claims', () => {
    const worker = readFileSync('cloudflare/koi-worker/src/index.ts', 'utf8');
    expect(worker).toContain('KOI_MAX_REQUEST_BYTES');
    expect(worker).toContain('payload.email_verified !== true');
    expect(worker).toContain("'cache-control': 'no-store'");
  });

  it('removes the cloud learning summary when detailed sharing is disabled or AI consent is revoked', () => {
    const worker = readFileSync('cloudflare/koi-worker/src/index.ts', 'utf8');
    expect(worker.match(/delete state\.learnerContext;/g)).toHaveLength(2);
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

  it('normalizes model Markdown into readable plain mobile text', () => {
    expect(normalizeKoiReplyText([
      '# Thank you',
      '',
      '| Level | Japanese |',
      '| --- | --- |',
      '| **Polite** | `ありがとうございます` |',
      '',
      '- Use this in normal situations.<br>It is safe.',
    ].join('\n'))).toBe([
      'Thank you',
      '',
      'Level — Japanese',
      'Polite — ありがとうございます',
      '',
      '• Use this in normal situations.',
      'It is safe.',
    ].join('\n'));
  });

  it('accepts only governed N5/N4 quiz evidence and keeps higher ranks gated', () => {
    expect(resolveGovernedKoiQuestion('cand-vocab-n5-0001', 'vocabulary', 'N5')).toMatchObject({
      answer: 'cand-vocab-n5-0001',
      rank: 'N5',
    });
    expect(resolveGovernedKoiQuestion('cand-n4-vocab-0008', 'vocabulary', 'N4')).toMatchObject({ rank: 'N4' });
    expect(resolveGovernedKoiQuestion('cand-vocab-n5-0001', 'grammar', 'N5')).toBeNull();
    expect(resolveGovernedKoiQuestion('cand-vocab-n3-0001', 'vocabulary', 'N3')).toBeNull();
  });

  it('awards practice and mastery stars only for unique correct evidence', () => {
    expect(reconcileKoiQuestionEvidence([], 'q1', false)).toMatchObject({ evidenceCount: 0, domainStars: 0 });
    expect(reconcileKoiQuestionEvidence(['q1'], 'q1', true)).toMatchObject({ evidenceCount: 1, domainStars: 0 });
    expect(reconcileKoiQuestionEvidence(['q1', 'q2', 'q3'], 'q4', true)).toMatchObject({ evidenceCount: 4, domainStars: 1 });
    expect(reconcileKoiQuestionEvidence(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'], 'q8', true))
      .toMatchObject({ evidenceCount: 8, domainStars: 2 });
  });
});
