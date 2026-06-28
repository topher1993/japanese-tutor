#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const SOURCE = {
  id: 'jmdict-edrdg',
  name: 'JMdict / EDICT Japanese Dictionary Project',
  url: 'http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz',
  license: 'CC BY-SA 4.0',
  output: 'src/data/generated/jmdictStarterVocabulary.ts',
};

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function decodeXml(text) {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function textBetween(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1].trim()) : '';
}

function allTextBetween(block, tag) {
  return [...block.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map((match) => decodeXml(match[1].trim()));
}

function toRomaji(kana) {
  const table = [
    ['きゃ', 'kya'], ['きゅ', 'kyu'], ['きょ', 'kyo'], ['しゃ', 'sha'], ['しゅ', 'shu'], ['しょ', 'sho'],
    ['ちゃ', 'cha'], ['ちゅ', 'chu'], ['ちょ', 'cho'], ['にゃ', 'nya'], ['にゅ', 'nyu'], ['にょ', 'nyo'],
    ['ひゃ', 'hya'], ['ひゅ', 'hyu'], ['ひょ', 'hyo'], ['みゃ', 'mya'], ['みゅ', 'myu'], ['みょ', 'myo'],
    ['りゃ', 'rya'], ['りゅ', 'ryu'], ['りょ', 'ryo'], ['ぎゃ', 'gya'], ['ぎゅ', 'gyu'], ['ぎょ', 'gyo'],
    ['じゃ', 'ja'], ['じゅ', 'ju'], ['じょ', 'jo'], ['びゃ', 'bya'], ['びゅ', 'byu'], ['びょ', 'byo'],
    ['ぴゃ', 'pya'], ['ぴゅ', 'pyu'], ['ぴょ', 'pyo'],
    ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'], ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'],
    ['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'], ['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to'],
    ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'], ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho'],
    ['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'], ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'],
    ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'], ['わ', 'wa'], ['を', 'wo'], ['ん', 'n'],
    ['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go'], ['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo'],
    ['だ', 'da'], ['ぢ', 'ji'], ['づ', 'zu'], ['で', 'de'], ['ど', 'do'], ['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo'],
    ['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po'], ['っ', ''], ['ー', ''],
  ];
  let out = kana;
  for (const [jp, ro] of table) out = out.replaceAll(jp, ro);
  return out;
}

function extractEntries(xml, wantedJapanese) {
  const entries = [];
  const wanted = new Set(wantedJapanese);
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = match[1];
    const sequence = textBetween(block, 'ent_seq');
    const kebs = allTextBetween(block, 'keb');
    const rebs = allTextBetween(block, 'reb');
    const japanese = kebs.find((item) => wanted.has(item)) ?? rebs.find((item) => wanted.has(item));
    if (!japanese) continue;
    const kana = rebs[0] ?? japanese;
    const glosses = allTextBetween(block, 'gloss');
    const poses = allTextBetween(block, 'pos').map((pos) => pos.replaceAll('&', '').replaceAll(';', ''));
    entries.push({ japanese, kana, romaji: toRomaji(kana), english: glosses[0] ?? '', partOfSpeech: poses[0] ?? 'unknown', sourceId: `JMdict:${sequence}` });
  }
  return entries;
}

async function main() {
  if (process.argv.includes('--dry-run') || process.argv.includes('--help')) {
    console.log(JSON.stringify({ source: SOURCE.url, license: SOURCE.license, output: SOURCE.output, mode: 'dry-run' }, null, 2));
    return;
  }

  const input = argValue('--input');
  const output = argValue('--output') ?? SOURCE.output;
  if (!input) {
    throw new Error('Provide --input path/to/JMdict_e.gz or run --dry-run. Network download is intentionally not automatic.');
  }

  const wanted = (argValue('--words') ?? '私,あなた,水,食べる,飲む,行く,来る,見る,聞く,話す,大きい,小さい,新しい,古い,人,先生,学生,学校,仕事,休み').split(',');
  const raw = await readFile(resolve(input));
  const xml = input.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  const entries = extractEntries(xml, wanted);
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), JSON.stringify({ source: SOURCE, generatedAt: new Date().toISOString(), entries }, null, 2));
  console.log(JSON.stringify({ source: SOURCE.url, license: SOURCE.license, output, entries: entries.length }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
