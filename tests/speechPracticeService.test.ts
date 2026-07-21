import { beforeEach, describe, expect, it, vi } from 'vitest';

const speech = vi.hoisted(() => ({
  stop: vi.fn(() => Promise.resolve()),
  speak: vi.fn(),
}));
vi.mock('expo-speech', () => speech);
import {
  koiSpeechContainsEnglish,
  romajiToHiragana,
  segmentKoiSpeechText,
  speakKoiReplyText,
} from '../src/services/speechPracticeService';

beforeEach(() => {
  speech.stop.mockClear();
  speech.speak.mockClear();
});

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
  it('segments Koi replies into native Japanese and English speech runs', () => {
    expect(segmentKoiSpeechText('\u732b\u306f a common word for cat. \u306d\u3053 is the reading.')).toEqual([
      { text: '\u732b\u306f', language: 'ja-JP' },
      { text: 'a common word for cat.', language: 'en-US' },
      { text: '\u306d\u3053', language: 'ja-JP' },
      { text: 'is the reading.', language: 'en-US' },
    ]);
    expect(koiSpeechContainsEnglish('\u732b\u3067\u3059\u3002')).toBe(false);
    expect(koiSpeechContainsEnglish('\u732b means cat.')).toBe(true);
  });

  it('queues each Koi speech run with the matching native locale', async () => {
    await speakKoiReplyText('\u732b means cat.');
    expect(speech.stop).toHaveBeenCalledOnce();
    expect(speech.speak).toHaveBeenNthCalledWith(1, '\u732b', expect.objectContaining({
      language: 'ja-JP',
      rate: 0.82,
    }));
    expect(speech.speak).toHaveBeenNthCalledWith(2, 'means cat.', expect.objectContaining({
      language: 'en-US',
      rate: 0.94,
    }));
  });
});
