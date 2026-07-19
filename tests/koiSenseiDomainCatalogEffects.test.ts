import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KOI_EFFECT_ACCESSIBILITY_SETTINGS,
  KOI_COSMETICS,
  KOI_COSMETIC_SLOT_BY_DOMAIN,
  KOI_DOMAINS,
  KOI_EFFECT_THEMES,
  KOI_MASTERY_COSMETICS,
  KOI_RANKS,
  KOI_STARTER_COSMETICS,
  applyKoiMilestone,
  createDefaultKoiProgression,
  createKoiContentAvailabilityManifest,
  getKoiEffectIntensity,
  getKoiEffectProfile,
  getKoiMasteryCosmetic,
  getKoiMilestoneId,
  getKoiUnlockedCosmetics,
  normalizeKoiEffectAccessibilitySettings,
  normalizeKoiProgression,
  type KoiCosmeticSlot,
  type KoiDomain,
  type KoiRank,
} from '../src/features/koi-sensei/domain';

const expectedMasteryLabels: Record<KoiRank, Record<KoiDomain, string>> = {
  N5: {
    vocabulary: 'Sakura Pin',
    grammar: 'Reading Glasses',
    phrases: 'Scroll Case',
    quizzes: 'Vocab Card Fan',
  },
  N4: {
    vocabulary: 'Maple Leaf Crest',
    grammar: 'Blue Reading Lens',
    phrases: 'Festival Banner',
    quizzes: 'Folding Fan',
  },
  N3: {
    vocabulary: 'Festival Knot',
    grammar: 'Festival Half-Mask',
    phrases: 'Paper Parasol',
    quizzes: 'Paper Crane',
  },
  N2: {
    vocabulary: 'Moon Crest',
    grammar: 'Star Spectacles',
    phrases: 'Moon Cape',
    quizzes: 'Lantern',
  },
  N1: {
    vocabulary: 'Golden Sensei Crest',
    grammar: 'Golden Monocle',
    phrases: 'Golden Lesson Banner',
    quizzes: 'Golden Pointer',
  },
};

describe('Koi Sensei mastery cosmetic catalog', () => {
  it('contains exactly four starters and twenty unique mastery rewards', () => {
    expect(KOI_STARTER_COSMETICS).toHaveLength(4);
    expect(KOI_MASTERY_COSMETICS).toHaveLength(20);
    expect(KOI_COSMETICS).toHaveLength(24);
    expect(new Set(KOI_COSMETICS.map(item => item.id)).size).toBe(24);
    expect(KOI_STARTER_COSMETICS.map(item => item.label)).toEqual([
      'Study Headband',
      'Sunset Shades',
      'Traveler Pack',
      'Calligraphy Brush',
    ]);
  });

  it('maps each rank/domain mastery to its exact item and semantic slot', () => {
    for (const rank of KOI_RANKS) {
      for (const domain of KOI_DOMAINS) {
        const cosmetic = getKoiMasteryCosmetic(rank, domain);
        expect(cosmetic.label).toBe(expectedMasteryLabels[rank][domain]);
        expect(cosmetic.slot).toBe(KOI_COSMETIC_SLOT_BY_DOMAIN[domain]);
        expect(cosmetic.unlock).toEqual({ kind: 'mastery', rank, domain });
      }
    }

    const countsBySlot = KOI_COSMETICS.reduce<Record<KoiCosmeticSlot, number>>(
      (counts, cosmetic) => ({ ...counts, [cosmetic.slot]: counts[cosmetic.slot] + 1 }),
      { crest: 0, face: 0, back: 0, hand: 0 },
    );
    expect(countsBySlot).toEqual({ crest: 6, face: 6, back: 6, hand: 6 });
  });

  it('unlocks only starters at first and a domain item only at mastery', () => {
    const manifest = createKoiContentAvailabilityManifest({
      evidenceTagged: { N5: KOI_DOMAINS },
    });
    const initial = createDefaultKoiProgression();
    expect(getKoiUnlockedCosmetics(initial).map(item => item.id))
      .toEqual(KOI_STARTER_COSMETICS.map(item => item.id));

    const practice = applyKoiMilestone(initial, {
      rank: 'N5',
      domain: 'grammar',
      kind: 'practice',
      milestoneId: getKoiMilestoneId('N5', 'grammar', 'practice'),
    }, manifest).state;
    expect(getKoiUnlockedCosmetics(practice)).toHaveLength(4);

    const mastery = applyKoiMilestone(practice, {
      rank: 'N5',
      domain: 'grammar',
      kind: 'mastery',
      milestoneId: getKoiMilestoneId('N5', 'grammar', 'mastery'),
    }, manifest).state;
    expect(getKoiUnlockedCosmetics(mastery).map(item => item.label)).toContain('Reading Glasses');
    expect(getKoiUnlockedCosmetics(mastery)).toHaveLength(5);
  });

  it('does not expose banked higher-rank cosmetics before reaching that rank', () => {
    const state = normalizeKoiProgression({
      currentRank: 'N5',
      rankProgress: {
        N4: { domainStars: { vocabulary: 2 } },
      },
    });
    expect(state.rankProgress.N4.domainStars.vocabulary).toBe(2);
    expect(getKoiUnlockedCosmetics(state).map(item => item.label)).not.toContain('Maple Leaf Crest');
  });

  it('makes all twenty mastery rewards available only in a fully mastered N1 state', () => {
    const rankProgress = Object.fromEntries(KOI_RANKS.map(rank => [rank, {
      domainStars: { vocabulary: 2, grammar: 2, phrases: 2, quizzes: 2 },
      earnedMilestoneIds: [],
    }]));
    const state = normalizeKoiProgression({ currentRank: 'N1', rankProgress });
    expect(getKoiUnlockedCosmetics(state)).toHaveLength(24);
  });
});

describe('Koi Sensei rank effects and accessibility', () => {
  it('uses the locked visual theme for every JLPT rank', () => {
    expect(Object.fromEntries(KOI_RANKS.map(rank => [rank, KOI_EFFECT_THEMES[rank].id])))
      .toEqual({
        N5: 'water-ripples',
        N4: 'leaf-motes',
        N3: 'sakura-petals',
        N2: 'moon-ink',
        N1: 'koi-scale-aura',
      });
  });

  it('maps all star boundaries to the planned intensity tiers', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(getKoiEffectIntensity)).toEqual([
      'static',
      'subtle',
      'subtle',
      'growing',
      'growing',
      'full',
      'full',
      'enhanced',
      'celebration',
    ]);
    expect(getKoiEffectIntensity(-5)).toBe('static');
    expect(getKoiEffectIntensity(99)).toBe('celebration');
  });

  it('keeps full effects inside the agreed draw, particle, and triangle budgets', () => {
    for (const rank of KOI_RANKS) {
      const profile = getKoiEffectProfile(rank, 8);
      expect(profile.renderMode).toBe('animated');
      expect(profile.particleBudget).toBeLessThanOrEqual(6);
      expect(profile.maxDrawCalls).toBeLessThanOrEqual(2);
      expect(profile.maxTriangles).toBeLessThanOrEqual(1_000);
      expect(profile.celebrateRankCompletion).toBe(true);
      expect(profile.decorative).toBe(true);
    }
  });

  it('uses a static accessible treatment for reduced motion, low power, or 2D', () => {
    const reduced = getKoiEffectProfile('N3', 8, {
      effectPreference: 'full',
      reducedMotion: true,
      lowPowerMode: false,
      avatarMode: '3d',
    });
    const lowPower = getKoiEffectProfile('N2', 5, {
      effectPreference: 'full',
      reducedMotion: false,
      lowPowerMode: true,
      avatarMode: '3d',
    });
    const twoDimensional = getKoiEffectProfile('N5', 3, {
      effectPreference: 'full',
      reducedMotion: false,
      lowPowerMode: false,
      avatarMode: '2d',
    });
    for (const profile of [reduced, lowPower, twoDimensional]) {
      expect(profile.renderMode).toBe('static');
      expect(profile.particleBudget).toBe(0);
      expect(profile.celebrateRankCompletion).toBe(false);
    }
  });

  it('supports effects off and normalizes malformed persisted preferences', () => {
    const off = getKoiEffectProfile('N1', 8, {
      effectPreference: 'off',
      reducedMotion: false,
      lowPowerMode: false,
      avatarMode: '3d',
    });
    expect(off.renderMode).toBe('off');
    expect(off.maxDrawCalls).toBe(0);
    expect(off.maxTriangles).toBe(0);

    expect(normalizeKoiEffectAccessibilitySettings({
      effectPreference: 'sparkles',
      reducedMotion: 'yes',
      lowPowerMode: true,
      avatarMode: 'vr',
    })).toEqual({
      ...DEFAULT_KOI_EFFECT_ACCESSIBILITY_SETTINGS,
      lowPowerMode: true,
    });
  });
});
