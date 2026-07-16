const MORA = new Map([
  ['きゃ', 'kya'], ['きゅ', 'kyu'], ['きょ', 'kyo'],
  ['しゃ', 'sha'], ['しゅ', 'shu'], ['しょ', 'sho'], ['しぇ', 'she'],
  ['ちゃ', 'cha'], ['ちゅ', 'chu'], ['ちょ', 'cho'], ['ちぇ', 'che'],
  ['にゃ', 'nya'], ['にゅ', 'nyu'], ['にょ', 'nyo'],
  ['ひゃ', 'hya'], ['ひゅ', 'hyu'], ['ひょ', 'hyo'],
  ['みゃ', 'mya'], ['みゅ', 'myu'], ['みょ', 'myo'],
  ['りゃ', 'rya'], ['りゅ', 'ryu'], ['りょ', 'ryo'],
  ['ぎゃ', 'gya'], ['ぎゅ', 'gyu'], ['ぎょ', 'gyo'],
  ['じゃ', 'ja'], ['じゅ', 'ju'], ['じょ', 'jo'], ['じぇ', 'je'],
  ['ぢゃ', 'ja'], ['ぢゅ', 'ju'], ['ぢょ', 'jo'],
  ['びゃ', 'bya'], ['びゅ', 'byu'], ['びょ', 'byo'],
  ['ぴゃ', 'pya'], ['ぴゅ', 'pyu'], ['ぴょ', 'pyo'],
  ['ふぁ', 'fa'], ['ふぃ', 'fi'], ['ふぇ', 'fe'], ['ふぉ', 'fo'],
  ['てぃ', 'ti'], ['でぃ', 'di'], ['とぅ', 'tu'], ['どぅ', 'du'],
  ['うぃ', 'wi'], ['うぇ', 'we'], ['うぉ', 'wo'],
  ['つぁ', 'tsa'], ['つぃ', 'tsi'], ['つぇ', 'tse'], ['つぉ', 'tso'],
  ['ゔぁ', 'va'], ['ゔぃ', 'vi'], ['ゔぇ', 've'], ['ゔぉ', 'vo'],
  ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'],
  ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'],
  ['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'],
  ['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to'],
  ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'],
  ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho'],
  ['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'],
  ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'],
  ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'],
  ['わ', 'wa'], ['ゐ', 'wi'], ['ゑ', 'we'], ['を', 'wo'], ['ん', 'n'],
  ['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go'],
  ['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo'],
  ['だ', 'da'], ['ぢ', 'ji'], ['づ', 'zu'], ['で', 'de'], ['ど', 'do'],
  ['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo'],
  ['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po'],
  ['ゔ', 'vu'],
  ['ぁ', 'a'], ['ぃ', 'i'], ['ぅ', 'u'], ['ぇ', 'e'], ['ぉ', 'o'],
]);

function katakanaToHiragana(value) {
  return value.normalize('NFKC').replace(/[ァ-ヶ]/g, (character) =>
    String.fromCodePoint(character.codePointAt(0) - 0x60));
}

function geminatedPrefix(mora) {
  const match = mora.match(/^[bcdfghjkmprstvwxyz]/);
  return match?.[0] ?? '';
}

function lastVowel(value) {
  const match = value.match(/[aeiou](?!.*[aeiou])/);
  return match?.[0] ?? '';
}

/**
 * Convert kana to learner-facing, doubled-vowel Hepburn romaji.
 *
 * This deliberately keeps punctuation and unknown characters visible so an
 * importer cannot silently discard source text it does not understand.
 */
export function kanaToRomaji(value) {
  const kana = katakanaToHiragana(value);
  let output = '';
  let geminateNext = false;

  for (let index = 0; index < kana.length;) {
    const character = kana[index];
    if (character === 'っ') {
      geminateNext = true;
      index += 1;
      continue;
    }
    if (character === 'ー') {
      output += lastVowel(output);
      index += 1;
      continue;
    }

    const pair = kana.slice(index, index + 2);
    const mora = MORA.get(pair) ?? MORA.get(character);
    if (!mora) {
      output += character;
      geminateNext = false;
      index += 1;
      continue;
    }

    if (geminateNext) {
      output += geminatedPrefix(mora);
      geminateNext = false;
    }
    output += mora;
    index += MORA.has(pair) ? 2 : 1;
  }

  return output;
}
