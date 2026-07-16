export const KOI_ELIGIBILITY_SCHEMA_VERSION = 1 as const;

/** Bump either value whenever its corresponding learner-facing notice changes. */
export const KOI_CURRENT_AI_POLICY_VERSION = 'koi-ai-data-2026-07-16';
export const KOI_CURRENT_PRIVACY_POLICY_VERSION = 'koi-privacy-2026-07-16';

export const KOI_AGE_BANDS = ['under16', '16_17', '18_plus'] as const;
export type KoiAgeBand = (typeof KOI_AGE_BANDS)[number];
export type KoiEligibleAgeBand = Exclude<KoiAgeBand, 'under16'>;

/**
 * A deliberately coarse eligibility record. Birth dates, legal names, and
 * identity documents must never be requested or stored by this feature.
 */
export interface KoiEligibilityRecordV1 {
  schemaVersion: typeof KOI_ELIGIBILITY_SCHEMA_VERSION;
  ageBand: KoiAgeBand;
  aiPolicyVersion: string;
  privacyPolicyVersion: string;
  aiDataConsent: boolean;
  usProcessingAcknowledged: boolean;
  /** Null means no AI-data consent was granted (for example, under age 16). */
  consentedAt: number | null;
}

export type KoiEligibilityStatus =
  | { eligible: true; reason: 'eligible'; ageBand: KoiEligibleAgeBand }
  | {
      eligible: false;
      reason: 'missing' | 'under16' | 'policy_stale' | 'consent_required';
      ageBand?: KoiAgeBand;
    };

export interface CreateKoiEligibilityInput {
  ageBand: KoiAgeBand;
  aiDataConsent: boolean;
  usProcessingAcknowledged: boolean;
}

export function createKoiEligibilityRecord(
  input: CreateKoiEligibilityInput,
  now = Date.now(),
): KoiEligibilityRecordV1 {
  const mayConsent = input.ageBand !== 'under16';
  const completeConsent = mayConsent && input.aiDataConsent && input.usProcessingAcknowledged;
  return {
    schemaVersion: KOI_ELIGIBILITY_SCHEMA_VERSION,
    ageBand: input.ageBand,
    aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
    privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
    aiDataConsent: completeConsent,
    usProcessingAcknowledged: completeConsent,
    consentedAt: completeConsent ? now : null,
  };
}

export function evaluateKoiEligibility(
  record: KoiEligibilityRecordV1 | null | undefined,
): KoiEligibilityStatus {
  if (!record) return { eligible: false, reason: 'missing' };
  if (record.ageBand === 'under16') {
    return { eligible: false, reason: 'under16', ageBand: record.ageBand };
  }
  if (record.aiPolicyVersion !== KOI_CURRENT_AI_POLICY_VERSION
    || record.privacyPolicyVersion !== KOI_CURRENT_PRIVACY_POLICY_VERSION) {
    return { eligible: false, reason: 'policy_stale', ageBand: record.ageBand };
  }
  if (!record.aiDataConsent
    || !record.usProcessingAcknowledged
    || record.consentedAt === null) {
    return { eligible: false, reason: 'consent_required', ageBand: record.ageBand };
  }
  return { eligible: true, reason: 'eligible', ageBand: record.ageBand };
}
