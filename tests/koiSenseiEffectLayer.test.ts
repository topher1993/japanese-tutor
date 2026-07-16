import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { getKoiEffectProfile, type KoiRank } from '../src/features/koi-sensei/domain';
import { getKoiEffectDecorations } from '../src/features/koi-sensei/ui/koiEffectDecorations';

describe('Koi visible rank effect layer', () => {
  it('gives all five ranks distinct visible motifs within the render budget', () => {
    const ranks: KoiRank[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
    const motifs = ranks.map(rank => {
      const profile = getKoiEffectProfile(rank, 6, {
        effectPreference: 'full',
        reducedMotion: false,
        lowPowerMode: false,
        avatarMode: '2d',
      });
      const decorations = getKoiEffectDecorations(profile);
      expect(decorations.length).toBeGreaterThan(0);
      if (profile.renderMode === 'animated') {
        expect(decorations.length).toBeLessThanOrEqual(profile.particleBudget);
      } else {
        expect(decorations).toHaveLength(1);
      }
      return decorations[0].shape;
    });
    expect(motifs).toEqual(['ring', 'mote', 'petal', 'moon', 'scale']);
  });

  it('keeps reduced effects static and off effects empty', () => {
    const reduced = getKoiEffectProfile('N3', 4, {
      effectPreference: 'reduced', reducedMotion: false, lowPowerMode: false, avatarMode: '2d',
    });
    expect(reduced.renderMode).toBe('static');
    expect(getKoiEffectDecorations(reduced)).not.toEqual([]);

    const off = getKoiEffectProfile('N1', 8, {
      effectPreference: 'off', reducedMotion: false, lowPowerMode: false, avatarMode: '2d',
    });
    expect(getKoiEffectDecorations(off)).toEqual([]);
  });

  it('wires the operating-system Reduce Motion signal into the Koi profile', () => {
    const source = readFileSync('src/features/koi-sensei/ui/KoiSenseiScreen.tsx', 'utf8');
    expect(source).toContain('AccessibilityInfo.isReduceMotionEnabled()');
    expect(source).toContain("AccessibilityInfo.addEventListener('reduceMotionChanged'");
    expect(source).toContain('<KoiRankEffectLayer profile={effect} />');
  });
});
