#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { writeImportArtifact } from './lib/write-import-artifact.mjs';

const DEFAULT_OUTPUT = 'src/data/imports/kanjidic2StarterKanji.json';

const SOURCE = {
  id: 'kanjidic2-edrdg',
  name: 'KANJIDIC2 Kanji Dictionary Project',
  url: 'https://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz',
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

function allReadings(block, type) {
  return [...block.matchAll(new RegExp(`<reading r_type="${type}">([\\s\\S]*?)</reading>`, 'g'))].map((match) => decodeXml(match[1].trim()));
}

function allMeanings(block) {
  return [...block.matchAll(/<meaning>([\s\S]*?)<\/meaning>/g)].map((match) => decodeXml(match[1].trim()));
}

function extractKanji(xml, wantedKanji) {
  const wanted = new Set(wantedKanji);
  const entries = [];
  for (const match of xml.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
    const block = match[1];
    const kanji = textBetween(block, 'literal');
    if (!wanted.has(kanji)) continue;
    const codePoint = textBetween(block, 'cp_value');
    const strokeCount = Number(textBetween(block, 'stroke_count'));
    const gradeText = textBetween(block, 'grade');
    entries.push({
      kanji,
      meanings: allMeanings(block),
      onReadings: allReadings(block, 'ja_on'),
      kunReadings: allReadings(block, 'ja_kun'),
      strokeCount,
      grade: gradeText ? Number(gradeText) : undefined,
      sourceId: `KANJIDIC2:${codePoint.toUpperCase()}`,
    });
  }
  return entries;
}

function renderTypeScript(payload) {
  return `// Generated candidate data from KANJIDIC2. Review before app integration.
export type ImportedKanjidic2KanjiEntry = {
  kanji: string;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  strokeCount: number;
  grade?: number;
  sourceId: string;
};

export const importedKanjidic2Source = ${JSON.stringify(payload.source, null, 2)} as const;
export const importedKanjidic2GeneratedAt = ${JSON.stringify(payload.generatedAt)};
export const importedKanjidic2Entries: ImportedKanjidic2KanjiEntry[] = ${JSON.stringify(payload.entries, null, 2)};
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
    throw new Error('Provide --input path/to/kanjidic2.xml.gz or run --dry-run. Network download is intentionally not automatic.');
  }

  const wanted = (argValue('--kanji') ?? '一,二,三,四,五,六,七,八,九,十,人,日,月,火,水,木').split(',');
  const raw = await readFile(resolve(input));
  const xml = input.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  const entries = extractKanji(xml, wanted);
  const payload = { schemaVersion: 1, source: SOURCE, generatedAt: new Date().toISOString(), entries };
  await writeImportArtifact(output, payload, renderTypeScript);
  console.log(JSON.stringify({ source: SOURCE.url, license: SOURCE.license, output, entries: entries.length }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
