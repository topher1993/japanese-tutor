import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KOI_CONTENT_AVAILABILITY,
  KOI_DOMAINS,
  advanceKoiRank,
  applyKoiMilestone,
  createDefaultKoiProgression,
  createKoiContentAvailabilityManifest,
  getKoiDomainGate,
  getKoiMilestoneId,
  getKoiRankStars,
  isKoiRankComplete,
  mergeKoiProgressionHighWater,
  normalizeKoiProgression,
  type KoiContentAvailabilityManifestV1,
  type KoiDomain,
  type KoiMilestoneKind,
  type KoiProgressionStateV1,
  type KoiRank,
} from '../src/features/koi-sensei/domain';

function readyManifest(
  additionalRanks: Partial<Record<KoiRank, readonly KoiDomain[]>> = {},
): KoiContentAvailabilityManifestV1 {
  return createKoiContentAvailabilityManifest({
    evidenceTagged: {
      N5: KOI_DOMAINS,
      N4: KOI_DOMAINS,
      N3: ['vocabulary'],
      ...additionalRanks,
    },
  });
}

function apply(
  state: KoiProgressionStateV1,
  rank: KoiRank,
  domain: KoiDomain,
  kind: KoiMilestoneKind,
  manifest: KoiContentAvailabilityManifestV1,
): KoiProgressionStateV1 {
  return applyKoiMilestone(state, {
    rank,
    domain,
    kind,
    milestoneId: getKoiMilestoneId(rank, domain, kind),
  }, manifest).state;
}

function completeRank(
  state: KoiProgressionStateV1,
  rank: KoiRank,
  manifest: KoiContentAvailabilityManifestV1,
): KoiProgressionStateV1 {
  return KOI_DOMAINS.reduce((next, domain) => {
    const practiced = apply(next, rank, domain, 'practice', manifest);
    return apply(practiced, rank, domain, 'mastery', manifest);
  }, state);
}

describe('Koi Sensei progression contracts', () => {
  it('starts at N5 with zero permanent stars in all five ranks', () => {
    const state = createDefaultKoiProgression();
    expect(state.schemaVersion).toBe(1);
    expect(state.currentRank).toBe('N5');
    expect(Object.keys(state.rankProgress)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1']);
    expect(Object.values(state.rankProgress).every(progress => (
      Object.values(progress.domainStars).every(stars => stars === 0)
    ))).toBe(true);
    expect(getKoiRankStars(state)).toBe(0);
  });

  it('normalizes malformed and legacy persisted values without inventing progress', () => {
    expect(normalizeKoiProgression(null)).toEqual(createDefaultKoiProgression());

    const migrated = normalizeKoiProgression({
      currentRank: 'N5',
      domainStars: { vocabulary: 99, grammar: -4, phrases: 1.9, quizzes: '2' },
      earnedMilestoneIds: ['first', 'first', 7, '', ' second '],
    });
    expect(migrated.rankProgress.N5.domainStars).toEqual({
      vocabulary: 2,
      grammar: 0,
      phrases: 1,
      quizzes: 0,
    });
    expect(migrated.rankProgress.N5.earnedMilestoneIds).toEqual(['first', 'second']);
    expect(migrated.schemaVersion).toBe(1);
  });

  it('fails closed until content evidence is tagged and preserves locked previews', () => {
    expect(getKoiDomainGate(DEFAULT_KOI_CONTENT_AVAILABILITY, 'N5', 'vocabulary'))
      .toEqual({ earnable: false, reason: 'evidence-not-tagged' });
    expect(getKoiDomainGate(DEFAULT_KOI_CONTENT_AVAILABILITY, 'N3', 'vocabulary'))
      .toEqual({ earnable: false, reason: 'rank-gated' });
    expect(getKoiDomainGate(DEFAULT_KOI_CONTENT_AVAILABILITY, 'N2', 'grammar'))
      .toEqual({ earnable: false, reason: 'preview-only' });

    const result = applyKoiMilestone(createDefaultKoiProgression(), {
      rank: 'N5',
      domain: 'vocabulary',
      kind: 'practice',
      milestoneId: getKoiMilestoneId('N5', 'vocabulary', 'practice'),
    });
    expect(result.awarded).toBe(false);
    expect(result.reason).toBe('content-unavailable');
    expect(getKoiRankStars(result.state)).toBe(0);
  });

  it('awards practice and mastery high-water stars once', () => {
    const manifest = readyManifest();
    const initial = createDefaultKoiProgression();
    const practice = applyKoiMilestone(initial, {
      rank: 'N5',
      domain: 'vocabulary',
      kind: 'practice',
      milestoneId: getKoiMilestoneId('N5', 'vocabulary', 'practice'),
    }, manifest);
    expect(practice.awarded).toBe(true);
    expect(practice.starsAwarded).toBe(1);
    expect(practice.unlockedCosmeticId).toBeUndefined();

    const mastery = applyKoiMilestone(practice.state, {
      rank: 'N5',
      domain: 'vocabulary',
      kind: 'mastery',
      milestoneId: getKoiMilestoneId('N5', 'vocabulary', 'mastery'),
    }, manifest);
    expect(mastery.state.rankProgress.N5.domainStars.vocabulary).toBe(2);
    expect(mastery.starsAwarded).toBe(1);
    expect(mastery.unlockedCosmeticId).toBe('mastery-n5-vocabulary-sakura-pin');

    const duplicate = applyKoiMilestone(mastery.state, {
      rank: 'N5',
      domain: 'vocabulary',
      kind: 'practice',
      milestoneId: getKoiMilestoneId('N5', 'vocabulary', 'practice'),
    }, manifest);
    expect(duplicate.awarded).toBe(false);
    expect(duplicate.reason).toBe('already-earned');
    expect(duplicate.state.rankProgress.N5.domainStars.vocabulary).toBe(2);
  });

  it('rejects forged milestone ids without changing state', () => {
    const state = createDefaultKoiProgression();
    const result = applyKoiMilestone(state, {
      rank: 'N5',
      domain: 'grammar',
      kind: 'mastery',
      milestoneId: 'client-supplied-award',
    }, readyManifest());
    expect(result.reason).toBe('invalid-milestone');
    expect(result.state).toEqual(state);
  });

  it('merges local and cloud snapshots without revoking stars or milestone evidence', () => {
    const manifest = readyManifest();
    const practiced = apply(
      createDefaultKoiProgression(),
      'N5',
      'phrases',
      'practice',
      manifest,
    );
    const mastered = apply(practiced, 'N5', 'phrases', 'mastery', manifest);
    const lowerIncoming = createDefaultKoiProgression();

    const firstMerge = mergeKoiProgressionHighWater(mastered, lowerIncoming);
    const reverseMerge = mergeKoiProgressionHighWater(lowerIncoming, mastered);
    expect(firstMerge.rankProgress.N5.domainStars.phrases).toBe(2);
    expect(reverseMerge.rankProgress.N5.domainStars.phrases).toBe(2);
    expect(firstMerge.rankProgress.N5.earnedMilestoneIds).toHaveLength(2);
  });

  it('never skips an incomplete rank when loading or applying evidence', () => {
    const manifest = readyManifest();
    const lockedEvidence = applyKoiMilestone(createDefaultKoiProgression(), {
      rank: 'N4',
      domain: 'quizzes',
      kind: 'mastery',
      milestoneId: getKoiMilestoneId('N4', 'quizzes', 'mastery'),
    }, manifest);
    expect(lockedEvidence.reason).toBe('rank-locked');
    expect(lockedEvidence.state.rankProgress.N4.domainStars.quizzes).toBe(0);

    const n5Complete = completeRank(createDefaultKoiProgression(), 'N5', manifest);
    const impossibleJump = normalizeKoiProgression({
      ...n5Complete,
      currentRank: 'N1',
    });
    expect(impossibleJump.currentRank).toBe('N4');

    const advanced = advanceKoiRank(n5Complete, manifest);
    expect(advanced.advanced).toBe(true);
    expect(advanced.state.currentRank).toBe('N4');
    expect(advanceKoiRank(advanced.state, manifest).reason).toBe('incomplete-current-rank');
  });

  it('requires eight stars and a fully governed next rank before advancing', () => {
    const manifest = readyManifest();
    const n5Complete = completeRank(createDefaultKoiProgression(), 'N5', manifest);
    expect(getKoiRankStars(n5Complete, 'N5')).toBe(8);
    expect(isKoiRankComplete(n5Complete, 'N5')).toBe(true);

    const n4 = advanceKoiRank(n5Complete, manifest).state;
    const n4Complete = completeRank(n4, 'N4', manifest);
    const gatedN3 = advanceKoiRank(n4Complete, manifest);
    expect(gatedN3.advanced).toBe(false);
    expect(gatedN3.reason).toBe('next-rank-unavailable');
    expect(gatedN3.state.currentRank).toBe('N4');

    const n3Ready = readyManifest({ N3: KOI_DOMAINS });
    n3Ready.ranks.N3.releaseState = 'active';
    const advanced = advanceKoiRank(n4Complete, n3Ready);
    expect(advanced.advanced).toBe(true);
    expect(advanced.state.currentRank).toBe('N3');
  });
});
