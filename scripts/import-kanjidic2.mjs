#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const SOURCE = {
  id: 'kanjidic2-edrdg',
  name: 'KANJIDIC2 Kanji Dictionary Project',
  url: 'http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz',
  license: 'CC BY-SA 4.0',
  output: 'src/data/generated/kanjidic2StarterKanji.ts',
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

async function main() {
  if (process.argv.includes('--dry-run') || process.argv.includes('--help')) {
    console.log(JSON.stringify({ source: SOURCE.url, license: SOURCE.license, output: SOURCE.output, mode: 'dry-run' }, null, 2));
    return;
  }

  const input = argValue('--input');
  const output = argValue('--output') ?? SOURCE.output;
  if (!input) {
    throw new Error('Provide --input path/to/kanjidic2.xml.gz or run --dry-run. Network download is intentionally not automatic.');
  }

  const wanted = (argValue('--kanji') ?? '一,二,三,四,五,六,七,八,九,十,人,日,月,火,水,木').split(',');
  const raw = await readFile(resolve(input));
  const xml = input.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  const entries = extractKanji(xml, wanted);
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), JSON.stringify({ source: SOURCE, generatedAt: new Date().toISOString(), entries }, null, 2));
  console.log(JSON.stringify({ source: SOURCE.url, license: SOURCE.license, output, entries: entries.length }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
