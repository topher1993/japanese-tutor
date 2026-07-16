#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { kanaToRomaji } from './lib/kana-to-romaji.mjs';
import { writeImportArtifact } from './lib/write-import-artifact.mjs';

const DEFAULT_OUTPUT = 'src/data/imports/jmdictStarterVocabulary.json';

const SOURCE = {
  id: 'jmdict-edrdg',
  name: 'JMdict / EDICT Japanese Dictionary Project',
  url: 'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz',
  license: 'CC BY-SA 4.0',
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
    entries.push({ japanese, kana, romaji: kanaToRomaji(kana), english: glosses[0] ?? '', partOfSpeech: poses[0] ?? 'unknown', sourceId: `JMdict:${sequence}` });
  }
  return entries;
}

function renderTypeScript(payload) {
  return `// Generated candidate data from JMdict. Review and enrich before app integration.
export type ImportedJmdictVocabularyEntry = {
  japanese: string;
  kana: string;
  romaji: string;
  english: string;
  partOfSpeech: string;
  sourceId: string;
};

export const importedJmdictVocabularySource = ${JSON.stringify(payload.source, null, 2)} as const;
export const importedJmdictVocabularyGeneratedAt = ${JSON.stringify(payload.generatedAt)};
export const importedJmdictVocabularyEntries: ImportedJmdictVocabularyEntry[] = ${JSON.stringify(payload.entries, null, 2)};
`;
}

async function main() {
  if (process.argv.includes('--dry-run') || process.argv.includes('--help')) {
    console.log(JSON.stringify({ source: SOURCE.url, license: SOURCE.license, output: DEFAULT_OUTPUT, formats: ['json', 'ts', 'mts'], mode: 'dry-run' }, null, 2));
    return;
  }

  const input = argValue('--input');
  const output = argValue('--output') ?? DEFAULT_OUTPUT;
  if (!input) {
    throw new Error('Provide --input path/to/JMdict_e.gz or run --dry-run. Network download is intentionally not automatic.');
  }

  const wanted = (argValue('--words') ?? '私,あなた,水,食べる,飲む,行く,来る,見る,聞く,話す,大きい,小さい,新しい,古い,人,先生,学生,学校,仕事,休み').split(',');
  const raw = await readFile(resolve(input));
  const xml = input.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  const entries = extractEntries(xml, wanted);
  const payload = { schemaVersion: 1, source: SOURCE, generatedAt: new Date().toISOString(), entries };
  await writeImportArtifact(output, payload, renderTypeScript);
  console.log(JSON.stringify({ source: SOURCE.url, license: SOURCE.license, output, entries: entries.length }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
