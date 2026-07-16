import { DEFAULT_KOI_CONTENT_AVAILABILITY, getKoiDomainGate, isKoiRankFullyEarnable } from './availability';
import { getKoiMasteryCosmetic } from './cosmetics';
import {
  KOI_DOMAINS,
  KOI_RANKS,
  type KoiContentAvailabilityManifestV1,
  type KoiDomain,
  type KoiDomainStars,
  type KoiMilestoneApplication,
  type KoiMilestoneEvidence,
  type KoiProgressionStateV1,
  type KoiRank,
  type KoiRankAdvanceResult,
  type KoiRankProgressV1,
} from './types';

function createEmptyRankProgress(): KoiRankProgressV1 {
  return {
    domainStars: {
      vocabulary: 0,
      grammar: 0,
      phrases: 0,
      quizzes: 0,
    },
    earnedMilestoneIds: [],
  };
}

function createEmptyRankProgressRecord(): Record<KoiRank, KoiRankProgressV1> {
  return {
    N5: createEmptyRankProgress(),
    N4: createEmptyRankProgress(),
    N3: createEmptyRankProgress(),
    N2: createEmptyRankProgress(),
    N1: createEmptyRankProgress(),
  };
}

export function createDefaultKoiProgression(): KoiProgressionStateV1 {
  return {
    schemaVersion: 1,
    currentRank: 'N5',
    rankProgress: createEmptyRankProgressRecord(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeDomainStars(value: unknown): KoiDomainStars {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(2, Math.max(0, Math.floor(value))) as KoiDomainStars;
}

function normalizeMilestoneIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)));
}

function normalizeRankProgress(value: unknown): KoiRankProgressV1 {
  if (!isRecord(value)) return createEmptyRankProgress();
  const rawDomainStars = isRecord(value.domainStars) ? value.domainStars : {};
  const domainStars = Object.fromEntries(KOI_DOMAINS.map(domain => [
    domain,
    normalizeDomainStars(rawDomainStars[domain]),
  ])) as Record<KoiDomain, KoiDomainStars>;
  return {
    domainStars,
    earnedMilestoneIds: normalizeMilestoneIds(value.earnedMilestoneIds),
  };
}

function isKoiRank(value: unknown): value is KoiRank {
  return typeof value === 'string' && KOI_RANKS.some(rank => rank === value);
}

function rankStars(progress: KoiRankProgressV1): number {
  return KOI_DOMAINS.reduce((sum, domain) => sum + progress.domainStars[domain], 0);
}

function clampCurrentRank(
  candidate: KoiRank,
  rankProgress: Record<KoiRank, KoiRankProgressV1>,
): KoiRank {
  const candidateIndex = KOI_RANKS.indexOf(candidate);
  for (let index = 0; index < candidateIndex; index += 1) {
    const priorRank = KOI_RANKS[index];
    if (rankStars(rankProgress[priorRank]) < 8) return priorRank;
  }
  return candidate;
}

/**
 * Accepts partial or legacy-looking persisted data, clamps all stars to 0\u20132,
 * removes malformed milestone ids, and prevents a stored rank from skipping an
 * incomplete predecessor. Availability never demotes previously earned state.
 */
export function normalizeKoiProgression(value: unknown): KoiProgressionStateV1 {
  if (!isRecord(value)) return createDefaultKoiProgression();
  const candidateRank = isKoiRank(value.currentRank) ? value.currentRank : 'N5';
  const rawRankProgress = isRecord(value.rankProgress) ? value.rankProgress : {};
  const rankProgress = createEmptyRankProgressRecord();

  for (const rank of KOI_RANKS) {
    rankProgress[rank] = normalizeRankProgress(rawRankProgress[rank]);
  }

  // Early prototypes stored only the current rank's domainStars at the root.
  // Supporting that shape makes the first persisted schema migration-safe.
  if (isRecord(value.domainStars) && !isRecord(rawRankProgress[candidateRank])) {
    rankProgress[candidateRank] = normalizeRankProgress({
      domainStars: value.domainStars,
      earnedMilestoneIds: value.earnedMilestoneIds,
    });
  }

  return {
    schemaVersion: 1,
    currentRank: clampCurrentRank(candidateRank, rankProgress),
    rankProgress,
  };
}

export function getKoiRankStars(
  state: KoiProgressionStateV1,
  rank: KoiRank = state.currentRank,
): number {
  return rankStars(state.rankProgress[rank]);
}

export function isKoiRankComplete(
  state: KoiProgressionStateV1,
  rank: KoiRank = state.currentRank,
): boolean {
  return getKoiRankStars(state, rank) === 8;
}

export function getNextKoiRank(rank: KoiRank): KoiRank | undefined {
  return KOI_RANKS[KOI_RANKS.indexOf(rank) + 1];
}

/** Merges local/cloud snapshots without allowing a star or rank to move back. */
export function mergeKoiProgressionHighWater(
  currentValue: unknown,
  incomingValue: unknown,
): KoiProgressionStateV1 {
  const current = normalizeKoiProgression(currentValue);
  const incoming = normalizeKoiProgression(incomingValue);
  const rankProgress = createEmptyRankProgressRecord();

  for (const rank of KOI_RANKS) {
    const domainStars = Object.fromEntries(KOI_DOMAINS.map(domain => [
      domain,
      Math.max(
        current.rankProgress[rank].domainStars[domain],
        incoming.rankProgress[rank].domainStars[domain],
      ) as KoiDomainStars,
    ])) as Record<KoiDomain, KoiDomainStars>;
    rankProgress[rank] = {
      domainStars,
      earnedMilestoneIds: Array.from(new Set([
        ...current.rankProgress[rank].earnedMilestoneIds,
        ...incoming.rankProgress[rank].earnedMilestoneIds,
      ])),
    };
  }

  const currentRank = KOI_RANKS.indexOf(current.currentRank) >= KOI_RANKS.indexOf(incoming.currentRank)
    ? current.currentRank
    : incoming.currentRank;
  return normalizeKoiProgression({ schemaVersion: 1, currentRank, rankProgress });
}

function unchangedMilestoneResult(
  state: KoiProgressionStateV1,
  reason: Exclude<KoiMilestoneApplication['reason'], 'awarded'>,
): KoiMilestoneApplication {
  return { state, awarded: false, starsAwarded: 0, reason };
}

export function applyKoiMilestone(
  stateValue: unknown,
  evidence: KoiMilestoneEvidence,
  manifest: KoiContentAvailabilityManifestV1 = DEFAULT_KOI_CONTENT_AVAILABILITY,
): KoiMilestoneApplication {
  const state = normalizeKoiProgression(stateValue);
  if (evidence.rank !== state.currentRank) {
    return unchangedMilestoneResult(state, 'rank-locked');
  }

  const availability = manifest.ranks[evidence.rank].domains[evidence.domain];
  const expectedMilestoneId = evidence.kind === 'practice'
    ? availability.practiceMilestoneId
    : availability.masteryMilestoneId;
  if (evidence.milestoneId !== expectedMilestoneId) {
    return unchangedMilestoneResult(state, 'invalid-milestone');
  }
  if (!getKoiDomainGate(manifest, evidence.rank, evidence.domain).earnable) {
    return unchangedMilestoneResult(state, 'content-unavailable');
  }

  const currentStars = state.rankProgress[evidence.rank].domainStars[evidence.domain];
  const targetStars: KoiDomainStars = evidence.kind === 'practice' ? 1 : 2;
  if (currentStars >= targetStars) {
    return unchangedMilestoneResult(state, 'already-earned');
  }

  const nextRankProgress: KoiRankProgressV1 = {
    ...state.rankProgress[evidence.rank],
    domainStars: {
      ...state.rankProgress[evidence.rank].domainStars,
      [evidence.domain]: targetStars,
    },
    earnedMilestoneIds: Array.from(new Set([
      ...state.rankProgress[evidence.rank].earnedMilestoneIds,
      evidence.milestoneId,
    ])),
  };
  const nextState: KoiProgressionStateV1 = {
    ...state,
    rankProgress: { ...state.rankProgress, [evidence.rank]: nextRankProgress },
  };
  const starsAwarded = (targetStars - currentStars) as KoiDomainStars;
  const unlockedCosmeticId = targetStars === 2
    ? getKoiMasteryCosmetic(evidence.rank, evidence.domain).id
    : undefined;
  return {
    state: nextState,
    awarded: true,
    starsAwarded,
    unlockedCosmeticId,
    reason: 'awarded',
  };
}

export function advanceKoiRank(
  stateValue: unknown,
  manifest: KoiContentAvailabilityManifestV1 = DEFAULT_KOI_CONTENT_AVAILABILITY,
): KoiRankAdvanceResult {
  const state = normalizeKoiProgression(stateValue);
  const nextRank = getNextKoiRank(state.currentRank);
  if (!nextRank) return { state, advanced: false, reason: 'highest-rank' };
  if (!isKoiRankComplete(state)) {
    return { state, advanced: false, reason: 'incomplete-current-rank' };
  }
  if (!isKoiRankFullyEarnable(manifest, nextRank)) {
    return { state, advanced: false, reason: 'next-rank-unavailable' };
  }
  return {
    state: { ...state, currentRank: nextRank },
    advanced: true,
    reason: 'advanced',
  };
}
