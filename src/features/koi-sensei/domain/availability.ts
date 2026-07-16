import {
  KOI_DOMAINS,
  KOI_RANKS,
  type KoiContentAvailabilityManifestV1,
  type KoiDomain,
  type KoiDomainContentAvailabilityV1,
  type KoiDomainGate,
  type KoiMilestoneKind,
  type KoiRank,
  type KoiRankContentAvailabilityV1,
  type KoiRankReleaseState,
} from './types';

export interface KoiContentAvailabilityConfig {
  evidenceTagged?: Partial<Record<KoiRank, readonly KoiDomain[]>>;
  releaseStates?: Partial<Record<KoiRank, KoiRankReleaseState>>;
}

const DEFAULT_RELEASE_STATES: Record<KoiRank, KoiRankReleaseState> = {
  N5: 'active',
  N4: 'active',
  N3: 'gated',
  N2: 'preview',
  N1: 'preview',
};

const DEFAULT_EVIDENCE_TAGGING: Partial<Record<KoiRank, readonly KoiDomain[]>> = {
  // N3 vocabulary can be surfaced as prepared content, but the rank remains
  // gated until every governed domain is ready.
  N3: ['vocabulary'],
};

export function getKoiMilestoneId(
  rank: KoiRank,
  domain: KoiDomain,
  kind: KoiMilestoneKind,
): string {
  return `koi.${rank}.${domain}.${kind}.v1`;
}

function buildDomainAvailability(
  rank: KoiRank,
  domain: KoiDomain,
  evidenceTagged: boolean,
): KoiDomainContentAvailabilityV1 {
  return {
    evidenceTagged,
    practiceMilestoneId: getKoiMilestoneId(rank, domain, 'practice'),
    masteryMilestoneId: getKoiMilestoneId(rank, domain, 'mastery'),
  };
}

function unavailableMessage(releaseState: KoiRankReleaseState): string | undefined {
  if (releaseState === 'preview') return 'This level\u2019s learning path is still being prepared.';
  if (releaseState === 'gated') return 'Complete governed content review before this rank can award stars.';
  return undefined;
}

/**
 * Builds the content-owned progression gate. Active ranks still fail closed
 * until each individual domain is explicitly marked as evidence-tagged.
 */
export function createKoiContentAvailabilityManifest(
  config: KoiContentAvailabilityConfig = {},
): KoiContentAvailabilityManifestV1 {
  const tagged = config.evidenceTagged ?? DEFAULT_EVIDENCE_TAGGING;
  const releaseStates = { ...DEFAULT_RELEASE_STATES, ...config.releaseStates };

  const ranks = Object.fromEntries(KOI_RANKS.map(rank => {
    const releaseState = releaseStates[rank];
    const taggedDomains = new Set(tagged[rank] ?? []);
    const domains = Object.fromEntries(KOI_DOMAINS.map(domain => [
      domain,
      buildDomainAvailability(rank, domain, taggedDomains.has(domain)),
    ])) as Record<KoiDomain, KoiDomainContentAvailabilityV1>;
    const rankAvailability: KoiRankContentAvailabilityV1 = {
      releaseState,
      domains,
      unavailableMessage: unavailableMessage(releaseState),
    };
    return [rank, rankAvailability];
  })) as Record<KoiRank, KoiRankContentAvailabilityV1>;

  return { schemaVersion: 1, ranks };
}

/** Current safe default: N5/N4 are release candidates but cannot earn until
 * evidence tagging is wired; N3 is gated and N2/N1 remain previews. */
export const DEFAULT_KOI_CONTENT_AVAILABILITY = createKoiContentAvailabilityManifest();

export function getKoiDomainGate(
  manifest: KoiContentAvailabilityManifestV1,
  rank: KoiRank,
  domain: KoiDomain,
): KoiDomainGate {
  const rankAvailability = manifest.ranks[rank];
  if (rankAvailability.releaseState === 'preview') {
    return { earnable: false, reason: 'preview-only' };
  }
  if (rankAvailability.releaseState === 'gated') {
    return { earnable: false, reason: 'rank-gated' };
  }
  if (!rankAvailability.domains[domain].evidenceTagged) {
    return { earnable: false, reason: 'evidence-not-tagged' };
  }
  return { earnable: true, reason: 'available' };
}

export function isKoiRankFullyEarnable(
  manifest: KoiContentAvailabilityManifestV1,
  rank: KoiRank,
): boolean {
  return manifest.ranks[rank].releaseState === 'active'
    && KOI_DOMAINS.every(domain => getKoiDomainGate(manifest, rank, domain).earnable);
}
