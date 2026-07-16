import { track } from '../../../services/analyticsService';
import type { KoiCapacityBand } from '../api/quotaPolicy';
import type { KoiAvatarMode, KoiEffectRenderMode, KoiRank } from '../domain';

export type KoiAnalyticsEvent = keyof KoiAnalyticsProperties;

export interface KoiAnalyticsProperties {
  koi_hub_opened: {
    rank: KoiRank;
    stars: number;
    avatar_mode: KoiAvatarMode;
    effect_mode: KoiEffectRenderMode;
  };
  koi_feature_opened: {
    feature: 'chat' | 'care' | 'closet' | 'dojo' | 'league' | 'settings';
  };
  koi_chat_result: {
    provider_mode: 'mock' | 'live';
    result: 'answered' | 'out_of_scope' | 'not_grounded' | 'failed';
    capacity_band: KoiCapacityBand;
    latency_bucket: 'under_1s' | '1_3s' | '3_8s' | 'over_8s';
    source_count: number;
  };
  koi_allowance_blocked: {
    kind: 'chat' | 'voice';
    reason:
      | 'capacity_stale'
      | 'subscription_exhausted'
      | 'allowance_exhausted'
      | 'provider_busy'
      | 'voice_fallback';
  };
  koi_consent_changed: {
    consent: 'ai_data' | 'detailed_progress' | 'league';
    enabled: boolean;
  };
  koi_local_data_action: {
    action: 'export' | 'delete';
    outcome: 'completed' | 'cancelled' | 'failed';
  };
  koi_safety_reported: {
    category: 'incorrect' | 'unsafe' | 'off_topic' | 'other';
  };
}

type KoiAnalyticsEnvelope<E extends KoiAnalyticsEvent> = {
  event: E;
  properties: KoiAnalyticsProperties[E];
};

const FEATURES = ['chat', 'care', 'closet', 'dojo', 'league', 'settings'] as const;
const CHAT_RESULTS = ['answered', 'out_of_scope', 'not_grounded', 'failed'] as const;
const CAPACITY_BANDS = ['high', 'normal', 'low', 'critical', 'paused'] as const;
const LATENCY_BUCKETS = ['under_1s', '1_3s', '3_8s', 'over_8s'] as const;
const BLOCK_REASONS = [
  'capacity_stale',
  'subscription_exhausted',
  'allowance_exhausted',
  'provider_busy',
  'voice_fallback',
] as const;
const CONSENTS = ['ai_data', 'detailed_progress', 'league'] as const;
const DATA_ACTIONS = ['export', 'delete'] as const;
const DATA_OUTCOMES = ['completed', 'cancelled', 'failed'] as const;
const REPORT_CATEGORIES = ['incorrect', 'unsafe', 'off_topic', 'other'] as const;
const RANKS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
const AVATAR_MODES = ['3d', '2d'] as const;
const EFFECT_MODES = ['animated', 'static', 'off'] as const;

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : minimum;
}

/** Runtime whitelist used even when a caller bypasses TypeScript. It never
 * forwards prompts, answers, message/memory text, identifiers, email, audio,
 * detailed progress, or arbitrary property names. */
export function buildKoiAnalyticsEnvelope<E extends KoiAnalyticsEvent>(
  event: E,
  unsafeProperties: KoiAnalyticsProperties[E],
): KoiAnalyticsEnvelope<E> {
  const value = unsafeProperties as unknown as Record<string, unknown>;
  let properties: KoiAnalyticsProperties[KoiAnalyticsEvent];

  switch (event) {
    case 'koi_hub_opened':
      properties = {
        rank: enumValue(value.rank, RANKS, 'N5'),
        stars: boundedInteger(value.stars, 0, 8),
        avatar_mode: enumValue(value.avatar_mode, AVATAR_MODES, '2d'),
        effect_mode: enumValue(value.effect_mode, EFFECT_MODES, 'off'),
      };
      break;
    case 'koi_feature_opened':
      properties = { feature: enumValue(value.feature, FEATURES, 'settings') };
      break;
    case 'koi_chat_result':
      properties = {
        provider_mode: enumValue(value.provider_mode, ['mock', 'live'] as const, 'mock'),
        result: enumValue(value.result, CHAT_RESULTS, 'failed'),
        capacity_band: enumValue(value.capacity_band, CAPACITY_BANDS, 'paused'),
        latency_bucket: enumValue(value.latency_bucket, LATENCY_BUCKETS, 'over_8s'),
        source_count: boundedInteger(value.source_count, 0, 8),
      };
      break;
    case 'koi_allowance_blocked':
      properties = {
        kind: enumValue(value.kind, ['chat', 'voice'] as const, 'chat'),
        reason: enumValue(value.reason, BLOCK_REASONS, 'capacity_stale'),
      };
      break;
    case 'koi_consent_changed':
      properties = {
        consent: enumValue(value.consent, CONSENTS, 'ai_data'),
        enabled: value.enabled === true,
      };
      break;
    case 'koi_local_data_action':
      properties = {
        action: enumValue(value.action, DATA_ACTIONS, 'export'),
        outcome: enumValue(value.outcome, DATA_OUTCOMES, 'failed'),
      };
      break;
    case 'koi_safety_reported':
      properties = { category: enumValue(value.category, REPORT_CATEGORIES, 'other') };
      break;
    default: {
      const exhaustive: never = event;
      throw new Error(`Unsupported Koi analytics event: ${String(exhaustive)}`);
    }
  }

  return { event, properties: properties as KoiAnalyticsProperties[E] };
}

export function trackKoiEvent<E extends KoiAnalyticsEvent>(
  event: E,
  properties: KoiAnalyticsProperties[E],
): void {
  const safe = buildKoiAnalyticsEnvelope(event, properties);
  track(safe.event, safe.properties);
}

export function koiLatencyBucket(milliseconds: number): KoiAnalyticsProperties['koi_chat_result']['latency_bucket'] {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'over_8s';
  if (milliseconds < 1_000) return 'under_1s';
  if (milliseconds < 3_000) return '1_3s';
  if (milliseconds < 8_000) return '3_8s';
  return 'over_8s';
}

