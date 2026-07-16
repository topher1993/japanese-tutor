import { describe, expect, it, vi } from 'vitest';
vi.mock('expo-speech', () => ({ stop: () => Promise.resolve(), speak: () => undefined }));
import { romajiToHiragana } from '../src/services/speechPracticeService';

describe('reading audio conversion', () => {
  it('converts common learner readings into unambiguous hiragana', () => {
    expect(romajiToHiragana('gakkou')).toBe('がっこう');
    expect(romajiToHiragana('kyuukei')).toBe('きゅうけい');
    expect(romajiToHiragana('shimekiri wa itsu desu ka')).toBe('しめきり わ いつ です か');
  });

  it('preserves punctuation and spaces for natural sentence playback', () => {
    expect(romajiToHiragana('mou ichido onegaishimasu.')).toBe('もう いちど おねがいします.');
  });

  it('keeps the moraic n together instead of leaving a spoken Latin n', () => {
    expect(romajiToHiragana('n')).toBe('ん');
    expect(romajiToHiragana('hon')).toBe('ほん');
    expect(romajiToHiragana('shinnen')).toBe('しんねん');
    expect(romajiToHiragana("kan'i")).toBe('かんい');
  });
});
