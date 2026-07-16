#!/usr/bin/env node
import { createHash } from 'node:crypto';
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
  : resolve(repoRoot, 'src/data/candidates/verbVocabularyCandidateData.ts');
const archive = await readFile(input);
const xml = gunzipSync(archive).toString('utf8');

// JMdict does not assign JLPT levels. These sets are the app's curated
// curriculum placement boundary; readings, POS, glosses, and source IDs come
// from JMdict. Existing app vocabulary is removed before the generated pack is
// emitted, so this file only adds genuinely new cards.
const N5_CURRICULUM = words(`
  会う 開く 開ける 上げる 遊ぶ 浴びる 洗う 有る 歩く 言う 行く 居る 入れる
  歌う 生まれる 売る 起きる 置く 送る 押す 覚える 泳ぐ 降りる 終わる
  買う 返す 帰る 掛かる 書く 掛ける 貸す 被る 借りる 消える 聞く 切る
  着る 来る 消す 答える 困る 咲く 差す 死ぬ 閉まる 閉める 知る 吸う
  住む 為る 座る 出す 立つ 頼む 食べる 使う 疲れる 着く 作る 付ける
  勤める 出かける 出来る 出る 飛ぶ 止まる 撮る 取る 鳴く 習う 並ぶ
  並べる 成る 脱ぐ 寝る 登る 飲む 乗る 入る 履く 始まる 走る 働く
  話す 貼る 引く 弾く 降る 曲がる 待つ 磨く 見せる 見る 持つ 休む
  遣る 呉れる 貰う 呼ぶ 読む 分かる 忘れる 渡す 渡る
`);

const N4_CURRICULUM = words(`
  上がる 集まる 集める 謝る 安心 急ぐ 致す 頂く 植える 伺う 受ける
  動かす 打つ 移る 写す 映す 選ぶ 遅れる 落とす 踊る 驚く 思い出す
  折る 折れる 変える 片付ける 勝つ 通う 噛む 乾く 乾かす 変わる
  聞こえる 決まる 決める 比べる 暮れる 壊す 壊れる 探す 下がる
  下げる 差し上げる 騒ぐ 触る 叱る 知らせる 調べる 過ぎる 進む
  捨てる 滑る 育てる 倒れる 足す 尋ねる 訪ねる 建てる 立てる 楽しむ
  続く 続ける 包む 連れる 手伝う 通る 届く 泊まる 取り替える 直る
  治る 無くなる 亡くなる 投げる 慣れる 逃げる 似る 盗む 塗る 眠る
  残る 乗り換える 運ぶ 払う 冷える 冷やす 光る 引き出す 拾う 増える
  増やす 太る 踏む 褒める 間に合う 回る 見える 見つかる 向かう
  迎える 申し上げる 申す 戻る 焼く 焼ける 痩せる 止む 止める 揺れる
  汚す 汚れる 寄る 喜ぶ 沸かす 沸く 別れる 召し上がる
  案内 運転 運動 遠慮 予約 利用 練習 連絡 準備 説明 相談 紹介 招待
  注意 翻訳 復習 予習 卒業 入学 退院 入院 出発 到着 質問 返事
  散歩 掃除 洗濯 料理 食事 買い物 旅行 留学 参加 協力 応援 修理
  失敗 成功 約束 欠席 出席 変更 交換 予約 連絡 確認 思う 生きる 要る
  合う 起こす 起こる 乗せる 守る 配る 煮る 下さる 引っ越す 建つ
  数える 頑張る 晴れる 飛ばす 違う 負ける 間違える 間違う 写る
  捕まえる 腰掛ける
`);

const VERB_POS = /^&(?:v1(?:-s)?|v2[^;]*|v4[^;]*|v5[^;]*|vk|vn|vr|vs(?:-c|-i|-s)?|vz);$/;
const REJECTED_TAGS = /&(?:arch|dated|dial|obsc|rare|poet|vulg);/;
const N3_TARGET = 500;

const DISPLAY_OVERRIDES = new Map([
  ['有る', 'ある'],
  ['居る', 'いる'],
  ['為る', 'する'],
  ['出来る', 'できる'],
  ['成る', 'なる'],
  ['遣る', 'やる'],
  ['呉れる', 'くれる'],
  ['貰う', 'もらう'],
]);

const SURU_GLOSS_OVERRIDES = new Map(Object.entries({
  安心: 'to feel relieved',
  案内: 'to guide',
  運転: 'to drive; to operate',
  運動: 'to exercise',
  遠慮: 'to refrain; to hold back',
  予約: 'to reserve',
  利用: 'to use',
  練習: 'to practice',
  連絡: 'to contact',
  準備: 'to prepare',
  説明: 'to explain',
  相談: 'to consult',
  紹介: 'to introduce',
  招待: 'to invite',
  注意: 'to be careful; to warn',
  翻訳: 'to translate',
  復習: 'to review',
  予習: 'to prepare lessons',
  卒業: 'to graduate',
  入学: 'to enter school',
  退院: 'to leave the hospital',
  入院: 'to enter the hospital',
  出発: 'to depart',
  到着: 'to arrive',
  質問: 'to ask a question',
  返事: 'to reply',
  散歩: 'to take a walk',
  掃除: 'to clean',
  洗濯: 'to do laundry',
  料理: 'to cook',
  食事: 'to eat a meal',
  買い物: 'to shop',
  旅行: 'to travel',
  留学: 'to study abroad',
  参加: 'to participate',
  協力: 'to cooperate',
  応援: 'to support; to cheer',
  修理: 'to repair',
  失敗: 'to fail',
  成功: 'to succeed',
  約束: 'to promise',
  欠席: 'to be absent',
  出席: 'to attend',
  変更: 'to change',
  交換: 'to exchange',
  確認: 'to confirm',
}));

const READING_OVERRIDES = new Map(Object.entries({
  入る: 'はいる',
  弾く: 'ひく',
  被る: 'かぶる',
  回る: 'まわる',
  汚れる: 'よごれる',
}));

const CURRICULUM_GLOSS_OVERRIDES = new Map(Object.entries({
  浴びる: 'to bathe; to take a shower',
  上げる: 'to raise; to give',
  差す: 'to hold up; to open (an umbrella)',
  弾く: 'to play (a stringed instrument)',
  被る: 'to put on (a hat)',
  呉れる: 'to give (to me or us)',
  貰う: 'to receive',
  差し上げる: 'to give (humble)',
  勤める: 'to work for; to be employed at',
  立てる: 'to stand something up; to erect',
  連れる: 'to take or bring someone along',
  過ぎる: 'to pass; to go past; to exceed',
  汚す: 'to make dirty; to soil',
  回る: 'to go around',
  伺う: 'to visit; to ask (humble)',
  汚れる: 'to get dirty',
  戻る: 'to return; to go back',
  頂く: 'to receive; to eat or drink (humble)',
  致す: 'to do (humble)',
  召し上がる: 'to eat or drink (honorific)',
}));

const CURRICULUM_POS_OVERRIDES = new Map(Object.entries({
  差す: '&v5s; &vt;',
  勤める: '&v1; &vi;',
}));

function words(value) {
  return new Set(value.trim().split(/\s+/).filter(Boolean));
}

function decode(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function all(block, tag) {
  return [...block.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))]
    .map(match => decode(match[1].trim()));
}

function first(block, tag) {
  return all(block, tag)[0] ?? '';
}

function normalizeSurface(value) {
  return value.endsWith('する') && value.length > 2 ? value.slice(0, -2) : value;
}

function priorityScore(priorities) {
  let score = 0;
  for (const priority of priorities) {
    if (priority === 'ichi1' || priority === 'news1' || priority === 'spec1' || priority === 'gai1') score += 100;
    else if (priority === 'ichi2' || priority === 'news2' || priority === 'spec2' || priority === 'gai2') score += 70;
    else if (/^nf\d+$/.test(priority)) score += Math.max(10, 70 - Number(priority.slice(2)));
    else score += 5;
  }
  return score;
}

function readingFor(block, japanese) {
  const readingBlocks = [...block.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)].map(match => match[1]);
  const compatible = readingBlocks.filter(reading => {
    const restrictions = all(reading, 're_restr');
    return restrictions.length === 0 || restrictions.includes(japanese);
  }).sort((a, b) => priorityScore(all(b, 're_pri')) - priorityScore(all(a, 're_pri')))[0] ?? readingBlocks[0];
  return compatible ? first(compatible, 'reb') : japanese;
}

function selectedSense(block, japanese, reading) {
  return [...block.matchAll(/<sense>([\s\S]*?)<\/sense>/g)]
    .map(match => match[1])
    .find(sense => {
      if (!all(sense, 'pos').some(tag => VERB_POS.test(tag))) return false;
      const kanjiRestrictions = all(sense, 'stagk');
      const readingRestrictions = all(sense, 'stagr');
      return (kanjiRestrictions.length === 0 || kanjiRestrictions.includes(japanese))
        && (readingRestrictions.length === 0 || readingRestrictions.includes(reading));
    });
}

function curriculumMatch(forms, curriculum) {
  return forms.find(form => curriculum.has(form));
}

const existingTexts = await Promise.all([
  readFile(resolve(repoRoot, 'src/data/candidates/n5VocabularyCandidateData.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'src/data/candidates/n4VocabularyCandidateData.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'src/data/candidates/adjectiveVocabularyCandidateData.ts'), 'utf8'),
  readFile(resolve(repoRoot, 'src/data/generated/jmdictStarterVocabulary.ts'), 'utf8'),
]);
const existing = new Set(
  existingTexts.flatMap(text => [...text.matchAll(/japanese:\s*'([^']+)'/g)]
    .flatMap(match => [match[1], normalizeSurface(match[1])])),
);

const curated = [];
const n3Pool = [];
for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
  const block = match[1];
  if (REJECTED_TAGS.test(block)) continue;

  const kanjiForms = all(block, 'keb');
  const readingForms = all(block, 'reb');
  const forms = [...kanjiForms, ...readingForms];
  const n5Match = curriculumMatch(forms, N5_CURRICULUM);
  const n4Match = n5Match ? undefined : curriculumMatch(forms, N4_CURRICULUM);
  const isCuratedLowerLevel = Boolean(n5Match || n4Match);
  const baseJapanese = n5Match ?? n4Match ?? kanjiForms[0] ?? readingForms[0];
  if (!baseJapanese) continue;

  const baseKana = READING_OVERRIDES.get(baseJapanese) ?? readingFor(block, baseJapanese);
  const sense = selectedSense(block, baseJapanese, baseKana);
  if (!sense) continue;

  const posTags = all(sense, 'pos');
  const isSuruVerb = posTags.some(tag => /^&vs(?:-|;)/.test(tag));
  if (isSuruVerb && !isCuratedLowerLevel) continue;
  if (isSuruVerb && n4Match && !SURU_GLOSS_OVERRIDES.has(baseJapanese)) continue;
  const displayBase = DISPLAY_OVERRIDES.get(baseJapanese) ?? baseJapanese;
  const japanese = isSuruVerb && !displayBase.endsWith('する') ? `${displayBase}する` : displayBase;
  const kana = isSuruVerb && !baseKana.endsWith('する') ? `${baseKana}する` : baseKana;
  const rawEnglish = all(sense, 'gloss').find(value => !value.startsWith('See ')) ?? first(sense, 'gloss');
  if (!kana || !rawEnglish) continue;
  const english = CURRICULUM_GLOSS_OVERRIDES.get(baseJapanese)
    ?? SURU_GLOSS_OVERRIDES.get(baseJapanese)
    ?? (/^to\b/i.test(rawEnglish) ? rawEnglish : `to ${rawEnglish}`);
  const normalized = normalizeSurface(japanese);
  if (existing.has(japanese) || existing.has(normalized)) continue;

  const priorities = [...all(block, 'ke_pri'), ...all(block, 're_pri')];
  const entry = {
    japanese,
    kana,
    romaji: kanaToRomaji(kana),
    english,
    partOfSpeech: CURRICULUM_POS_OVERRIDES.get(baseJapanese)
      ?? posTags.filter(tag => VERB_POS.test(tag) || tag === '&vt;' || tag === '&vi;').join(' '),
    score: priorityScore(priorities),
    sequence: first(block, 'ent_seq'),
  };

  if (isCuratedLowerLevel) {
    curated.push({ ...entry, level: n5Match ? 'N5' : 'N4' });
  } else if (entry.score > 0) {
    n3Pool.push({ ...entry, level: 'N3' });
  }
}

function uniqueBySurface(entries) {
  const seen = new Set();
  return entries.filter(entry => {
    if (seen.has(entry.japanese)) return false;
    seen.add(entry.japanese);
    return true;
  });
}

const curatedUnique = uniqueBySurface(curated)
  .sort((a, b) => a.level.localeCompare(b.level) || b.score - a.score || a.japanese.localeCompare(b.japanese));
const lowerLevelSurfaces = new Set(curatedUnique.map(entry => entry.japanese));
const n3Selected = uniqueBySurface(n3Pool
  .filter(entry => !lowerLevelSurfaces.has(entry.japanese))
  .sort((a, b) => b.score - a.score || a.japanese.length - b.japanese.length || a.japanese.localeCompare(b.japanese)))
  .slice(0, N3_TARGET);
const selected = [...curatedUnique, ...n3Selected];

const counts = Object.fromEntries(['N5', 'N4', 'N3'].map(level => [
  level,
  selected.filter(entry => entry.level === level).length,
]));
if (counts.N5 < 30) throw new Error(`Only found ${counts.N5} new N5 verbs; expected at least 30`);
if (counts.N4 < 60) throw new Error(`Only found ${counts.N4} new N4 verbs; expected at least 60`);
if (counts.N3 !== N3_TARGET) throw new Error(`Only found ${counts.N3} N3 verbs; expected ${N3_TARGET}`);

const sourceGeneratedAt = xml.match(/JMdict created:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? 'unknown';
const archiveSha256 = createHash('sha256').update(archive).digest('hex').toUpperCase();
const lines = selected.map(entry => `  ${JSON.stringify({
  id: `jmdict-verb-${entry.level.toLowerCase()}-${entry.sequence}`,
  japanese: entry.japanese,
  kana: entry.kana,
  romaji: entry.romaji,
  english: entry.english,
  partOfSpeech: entry.partOfSpeech,
  level: entry.level,
  levelSource: 'japanese-tutor-curation',
  placementEvidence: entry.level === 'N3' ? 'jmdict-priority-n3-candidate' : `curated-${entry.level.toLowerCase()}-verb-list`,
  source: {
    id: 'jmdict-edrdg',
    sourceId: `JMdict:${entry.sequence}`,
    license: 'CC BY-SA 4.0',
  },
  reviewStatus: 'approved-for-beta',
})},`);

const outputText = `// Generated from the official JMdict/EDICT verb entries. Do not hand-edit.
import type { VerbVocabularyCandidateEntry } from './verbVocabularyCandidatePack';

export const verbVocabularySourceSnapshot = ${JSON.stringify({
  source: 'jmdict-edrdg',
  sourceArchiveUrl: 'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz',
  sourceGeneratedAt,
  archiveSha256,
  curriculumPolicy: 'N5/N4 curated app placement; N3 high-priority modern JMdict candidates after lower-level exclusions',
}, null, 2)} as const;

export const verbVocabularyCandidateData: VerbVocabularyCandidateEntry[] = [
${lines.join('\n')}
];
`;

await writeFile(output, outputText, 'utf8');
console.log(JSON.stringify({
  source: 'JMdict/EDICT',
  sourceGeneratedAt,
  archiveSha256,
  counts,
  total: selected.length,
  output,
}, null, 2));
