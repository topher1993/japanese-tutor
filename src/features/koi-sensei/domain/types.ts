export const KOI_RANKS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

export type KoiRank = (typeof KOI_RANKS)[number];

export const KOI_DOMAINS = ['vocabulary', 'grammar', 'phrases', 'quizzes'] as const;

export type KoiDomain = (typeof KOI_DOMAINS)[number];

export type KoiDomainStars = 0 | 1 | 2;

export type KoiMilestoneKind = 'practice' | 'mastery';

export interface KoiRankProgressV1 {
  domainStars: Record<KoiDomain, KoiDomainStars>;
  earnedMilestoneIds: string[];
}

export interface KoiProgressionStateV1 {
  schemaVersion: 1;
  currentRank: KoiRank;
  rankProgress: Record<KoiRank, KoiRankProgressV1>;
}

export type KoiRankReleaseState = 'active' | 'gated' | 'preview';

export type KoiContentGateReason =
  | 'available'
  | 'evidence-not-tagged'
  | 'rank-gated'
  | 'preview-only';

export interface KoiDomainContentAvailabilityV1 {
  evidenceTagged: boolean;
  practiceMilestoneId: string;
  masteryMilestoneId: string;
}

export interface KoiRankContentAvailabilityV1 {
  releaseState: KoiRankReleaseState;
  domains: Record<KoiDomain, KoiDomainContentAvailabilityV1>;
  unavailableMessage?: string;
}

export interface KoiContentAvailabilityManifestV1 {
  schemaVersion: 1;
  ranks: Record<KoiRank, KoiRankContentAvailabilityV1>;
}

export interface KoiDomainGate {
  earnable: boolean;
  reason: KoiContentGateReason;
}

export interface KoiMilestoneEvidence {
  rank: KoiRank;
  domain: KoiDomain;
  kind: KoiMilestoneKind;
  milestoneId: string;
}

export type KoiMilestoneApplicationReason =
  | 'awarded'
  | 'already-earned'
  | 'rank-locked'
  | 'content-unavailable'
  | 'invalid-milestone';

export interface KoiMilestoneApplication {
  state: KoiProgressionStateV1;
  awarded: boolean;
  starsAwarded: KoiDomainStars;
  unlockedCosmeticId?: string;
  reason: KoiMilestoneApplicationReason;
}

export type KoiRankAdvanceReason =
  | 'advanced'
  | 'incomplete-current-rank'
  | 'next-rank-unavailable'
  | 'highest-rank';

export interface KoiRankAdvanceResult {
  state: KoiProgressionStateV1;
  advanced: boolean;
  reason: KoiRankAdvanceReason;
}

export const KOI_COSMETIC_SLOTS = ['crest', 'face', 'back', 'hand'] as const;

export type KoiCosmeticSlot = (typeof KOI_COSMETIC_SLOTS)[number];

export interface KoiStarterCosmeticUnlock {
  kind: 'starter';
}

export interface KoiMasteryCosmeticUnlock {
  kind: 'mastery';
  rank: KoiRank;
  domain: KoiDomain;
}

export type KoiCosmeticUnlock = KoiStarterCosmeticUnlock | KoiMasteryCosmeticUnlock;

export interface KoiCosmetic {
  id: string;
  label: string;
  slot: KoiCosmeticSlot;
  unlock: KoiCosmeticUnlock;
}

export type KoiEffectThemeId =
  | 'water-ripples'
  | 'leaf-motes'
  | 'sakura-petals'
  | 'moon-ink'
  | 'koi-scale-aura';

export interface KoiEffectTheme {
  id: KoiEffectThemeId;
  label: string;
  primaryColor: string;
  staticDescription: string;
  animatedDescription: string;
}

export type KoiEffectIntensity =
  | 'static'
  | 'subtle'
  | 'growing'
  | 'full'
  | 'enhanced'
  | 'celebration';

export type KoiEffectPreference = 'full' | 'reduced' | 'off';

export type KoiAvatarMode = '3d' | '2d';

export interface KoiEffectAccessibilitySettings {
  effectPreference: KoiEffectPreference;
  reducedMotion: boolean;
  lowPowerMode: boolean;
  avatarMode: KoiAvatarMode;
}

export type KoiEffectRenderMode = 'animated' | 'static' | 'off';

export interface KoiEffectProfile {
  rank: KoiRank;
  stars: number;
  theme: KoiEffectTheme;
  intensity: KoiEffectIntensity;
  renderMode: KoiEffectRenderMode;
  particleBudget: number;
  maxDrawCalls: number;
  maxTriangles: number;
  celebrateRankCompletion: boolean;
  decorative: true;
}
