import * as Speech from 'expo-speech';
import { track } from './analyticsService';

const SYLLABLES: Array<[string, string]> = [
  ['kya', 'きゃ'], ['kyu', 'きゅ'], ['kyo', 'きょ'], ['sha', 'しゃ'], ['shu', 'しゅ'], ['sho', 'しょ'],
  ['cha', 'ちゃ'], ['chu', 'ちゅ'], ['cho', 'ちょ'], ['nya', 'にゃ'], ['nyu', 'にゅ'], ['nyo', 'にょ'],
  ['hya', 'ひゃ'], ['hyu', 'ひゅ'], ['hyo', 'ひょ'], ['mya', 'みゃ'], ['myu', 'みゅ'], ['myo', 'みょ'],
  ['rya', 'りゃ'], ['ryu', 'りゅ'], ['ryo', 'りょ'], ['gya', 'ぎゃ'], ['gyu', 'ぎゅ'], ['gyo', 'ぎょ'],
  ['bya', 'びゃ'], ['byu', 'びゅ'], ['byo', 'びょ'], ['pya', 'ぴゃ'], ['pyu', 'ぴゅ'], ['pyo', 'ぴょ'],
  ['ja', 'じゃ'], ['ju', 'じゅ'], ['jo', 'じょ'], ['shi', 'し'], ['chi', 'ち'], ['tsu', 'つ'], ['fu', 'ふ'],
  ['ka', 'か'], ['ki', 'き'], ['ku', 'く'], ['ke', 'け'], ['ko', 'こ'], ['sa', 'さ'], ['su', 'す'], ['se', 'せ'], ['so', 'そ'],
  ['ta', 'た'], ['te', 'て'], ['to', 'と'], ['na', 'な'], ['ni', 'に'], ['nu', 'ぬ'], ['ne', 'ね'], ['no', 'の'],
  ['ha', 'は'], ['hi', 'ひ'], ['he', 'へ'], ['ho', 'ほ'], ['ma', 'ま'], ['mi', 'み'], ['mu', 'む'], ['me', 'め'], ['mo', 'も'],
  ['ya', 'や'], ['yu', 'ゆ'], ['yo', 'よ'], ['ra', 'ら'], ['ri', 'り'], ['ru', 'る'], ['re', 'れ'], ['ro', 'ろ'],
  ['wa', 'わ'], ['wo', 'を'], ['ga', 'が'], ['gi', 'ぎ'], ['gu', 'ぐ'], ['ge', 'げ'], ['go', 'ご'],
  ['za', 'ざ'], ['ji', 'じ'], ['zu', 'ず'], ['ze', 'ぜ'], ['zo', 'ぞ'], ['da', 'だ'], ['de', 'で'], ['do', 'ど'],
  ['ba', 'ば'], ['bi', 'び'], ['bu', 'ぶ'], ['be', 'べ'], ['bo', 'ぼ'], ['pa', 'ぱ'], ['pi', 'ぴ'], ['pu', 'ぷ'], ['pe', 'ぺ'], ['po', 'ぽ'],
  ['a', 'あ'], ['i', 'い'], ['u', 'う'], ['e', 'え'], ['o', 'お'],
];

/** Convert the app's learner-facing romaji into unambiguous hiragana for TTS. */
export function romajiToHiragana(input: string): string {
  const source = input.toLowerCase();
  let out = '';
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === ' ') { out += ' '; i += 1; continue; }
    if (/[,.!?]/.test(char)) { out += char; i += 1; continue; }
    if (char === 'n') {
      const next = source[i + 1];
      const afterNext = source[i + 2];
      const nextStartsSyllable = next && /[aiueoy]/.test(next);
      if (!next || next === "'" || (!nextStartsSyllable && next !== 'n')) {
        out += 'ん';
        i += next === "'" ? 2 : 1;
        continue;
      }
      if (next === 'n') {
        // A final `nn` is one mora. Before a vowel, keep the second `n`
        // available for the following syllable (e.g. `shinnen` → しんねん).
        if (!afterNext || afterNext === "'" || !/[aiueoy]/.test(afterNext)) {
          out += 'ん';
          i += afterNext === "'" ? 3 : 2;
          continue;
        }
        out += 'ん';
        i += 1;
        continue;
      }
    }
    if (source[i] === source[i + 1] && /[bcdfghjklmpqrstvwxyz]/.test(source[i]) && source[i] !== 'n') {
      out += 'っ'; i += 1; continue;
    }
    const match = SYLLABLES.find(([romaji]) => source.startsWith(romaji, i));
    if (match) { out += match[1]; i += match[0].length; continue; }
    out += char;
    i += 1;
  }
  return out;
}

export function readingForSpeech(reading: string): string {
  return /[ぁ-んァ-ン]/.test(reading) ? reading : romajiToHiragana(reading);
}

export function speakJapanese(text: string, rate = 0.82): void {
  void Speech.stop().catch(() => undefined);
  const reading = readingForSpeech(text);
  Speech.speak(reading, { language: 'ja-JP', rate, pitch: 1 });
  track('japanese_audio_played', { text_length: reading.length, rate });
}

export function markShadowingAttempt(text: string): void {
  track('japanese_shadowing_attempt', { text_length: text.length });
}
