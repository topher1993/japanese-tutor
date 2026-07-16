import { describe, expect, it } from 'vitest';

import {
  buildKoiAnalyticsEnvelope,
  koiLatencyBucket,
} from '../src/features/koi-sensei/analytics';

describe('Koi content-free analytics', () => {
  it('whitelists only aggregate chat result fields at runtime', () => {
    const event = buildKoiAnalyticsEnvelope('koi_chat_result', {
      provider_mode: 'mock',
      result: 'answered',
      capacity_band: 'high',
      latency_bucket: 'under_1s',
      source_count: 2,
      prompt: 'private question',
      answer: 'private answer',
      email: 'learner@example.test',
      memory_text: 'private memory',
    } as never);
    expect(event).toEqual({
      event: 'koi_chat_result',
      properties: {
        provider_mode: 'mock',
        result: 'answered',
        capacity_band: 'high',
        latency_bucket: 'under_1s',
        source_count: 2,
      },
    });
    expect(JSON.stringify(event)).not.toMatch(/private|learner@example|"prompt"|"answer"|memory_text/i);
  });

  it('clamps counts/stars and fails invalid enums to conservative buckets', () => {
    expect(buildKoiAnalyticsEnvelope('koi_hub_opened', {
      rank: 'N0',
      stars: 400,
      avatar_mode: 'hologram',
      effect_mode: 'explosive',
    } as never).properties).toEqual({
      rank: 'N5',
      stars: 8,
      avatar_mode: '2d',
      effect_mode: 'off',
    });
    expect(buildKoiAnalyticsEnvelope('koi_chat_result', {
      provider_mode: 'paid',
      result: 'secret',
      capacity_band: 'unknown',
      latency_bucket: 'exactly_2413ms',
      source_count: 99,
    } as never).properties).toEqual({
      provider_mode: 'mock',
      result: 'failed',
      capacity_band: 'paused',
      latency_bucket: 'over_8s',
      source_count: 8,
    });
  });

  it('buckets latency without emitting an exact timing fingerprint', () => {
    expect(koiLatencyBucket(999)).toBe('under_1s');
    expect(koiLatencyBucket(1_000)).toBe('1_3s');
    expect(koiLatencyBucket(7_999)).toBe('3_8s');
    expect(koiLatencyBucket(8_000)).toBe('over_8s');
  });

  it('keeps consent, report, and data events categorical and content-free', () => {
    expect(buildKoiAnalyticsEnvelope('koi_consent_changed', {
      consent: 'detailed_progress', enabled: true, notes: 'do not send',
    } as never).properties).toEqual({ consent: 'detailed_progress', enabled: true });
    expect(buildKoiAnalyticsEnvelope('koi_safety_reported', {
      category: 'unsafe', reportText: 'do not send',
    } as never).properties).toEqual({ category: 'unsafe' });
    expect(buildKoiAnalyticsEnvelope('koi_local_data_action', {
      action: 'delete', outcome: 'completed', export: '{private}',
    } as never).properties).toEqual({ action: 'delete', outcome: 'completed' });
  });
});
