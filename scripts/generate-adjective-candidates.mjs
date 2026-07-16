#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { kanaToRomaji } from './lib/kana-to-romaji.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inputArgument = process.argv[2] ?? process.env.JMDICT_PATH;
if (!inputArgument) {
  throw new Error('Provide a JMdict_e.gz path as the first argument or set JMDICT_PATH.');
}
const input = resolve(inputArgument);
const output = process.argv[3]
  ? resolve(process.argv[3])
  : resolve(repoRoot, 'src/data/candidates/adjectiveVocabularyCandidateData.ts');
const xml = gunzipSync(await readFile(input)).toString('utf8');

function decode(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"').replaceAll('&apos;', "'");
}

function all(block, tag) {
  return [...block.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))]
    .map(match => decode(match[1].trim()));
}

function priorityScore(priorities) {
  let score = 0;
  for (const priority of priorities) {
    if (priority === 'ichi1' || priority === 'news1' || priority === 'spec1' || priority === 'gai1') score += 100;
    else if (priority === 'ichi2' || priority === 'news2' || priority === 'spec2' || priority === 'gai2') score += 70;
    else if (/^nf\\d+$/.test(priority)) score += Math.max(10, 70 - Number(priority.slice(2)));
    else score += 5;
  }
  return score;
}

const existingText = await Promise.all([
  readFile(resolve(repoRoot, 'src/data/candidates/n5VocabularyCandidateData.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'src/data/candidates/n4VocabularyCandidateData.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'src/data/generated/jmdictStarterVocabulary.ts'), 'utf8'),
]);
const existing = new Set(existingText.flatMap(text => [...text.matchAll(/japanese:\s*'([^']+)'/g)].map(match => match[1])));
const entries = [];
for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
  const block = match[1];
  if (!/<pos>&adj-(?:i|na|no|pn|t|f);</.test(block)) continue;
  if (/&(?:arch|obsc|rare|dated|dial|col|poet);/.test(block)) continue;
  const sense = [...block.matchAll(/<sense>([\s\S]*?)<\/sense>/g)]
    .map(match => match[1]).find(value => /<pos>&adj-(?:i|na|no|pn|t|f);</.test(value));
  if (!sense) continue;
  const japanese = all(block, 'keb')[0] ?? all(block, 'reb')[0];
  const kana = all(block, 'reb')[0] ?? japanese;
  const english = all(sense, 'gloss').find(value => !value.startsWith('See ')) ?? all(sense, 'gloss')[0];
  if (!japanese || !kana || !english || existing.has(japanese) || entries.some(entry => entry.japanese === japanese)) continue;
  const pos = all(sense, 'pos').find(value => value.includes('&adj-')) ?? '&adj-i;';
  const priorities = [...all(block, 'ke_pri'), ...all(block, 're_pri')];
  entries.push({
    japanese,
    kana,
    romaji: kanaToRomaji(kana),
    english,
    partOfSpeech: pos,
    score: priorityScore(priorities),
    sequence: all(block, 'ent_seq')[0] ?? '',
  });
}

entries.sort((a, b) => b.score - a.score || a.japanese.length - b.japanese.length || a.japanese.localeCompare(b.japanese));
const selected = entries.slice(0, 500).map((entry, index) => ({
  id: `jmdict-adj-${String(index + 1).padStart(4, '0')}`,
  japanese: entry.japanese,
  kana: entry.kana,
  romaji: entry.romaji,
  english: entry.english,
  partOfSpeech: entry.partOfSpeech,
  level: 'N3',
  sourceId: `JMdict:${entry.sequence}`,
}));
if (selected.length < 500) throw new Error(`Only found ${selected.length} adjective entries`);

const lines = selected.map(entry => `  ${JSON.stringify({
  id: entry.id, japanese: entry.japanese, kana: entry.kana, romaji: entry.romaji,
  english: entry.english, partOfSpeech: entry.partOfSpeech, level: entry.level,
  source: { id: 'jmdict-edrdg', license: 'CC BY-SA 4.0' }, reviewStatus: 'approved-for-beta',
})},`);
const outputText = `// Generated from the official JMdict/EDICT adjective entries. Keep the source metadata intact.\nimport type { AdjectiveVocabularyCandidateEntry } from './adjectiveCandidatePack';\n\nexport const adjectiveVocabularyCandidateData: AdjectiveVocabularyCandidateEntry[] = [\n${lines.join('\n')}\n];\n`;
await writeFile(output, outputText, 'utf8');
console.log(JSON.stringify({ source: 'JMdict/EDICT', selected: selected.length, output }, null, 2));
