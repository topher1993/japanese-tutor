export type KanjiLevel = 'N5' | 'N4';

export interface KanjiCard {
  id: string;
  kanji: string;
  meanings: string[];
  readings: string[];
  jlptLevel: KanjiLevel;
  exampleWords: string[];
}

export interface KanjiLesson {
  id: string;
  title: string;
  jlptLevel: KanjiLevel;
  cards: KanjiCard[];
}

export interface KanjiSection {
  cards: KanjiCard[];
  lessons: KanjiLesson[];
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter(item => item.trim().length > 0)));
}

export function mergeKanjiCardPool(cards: KanjiCard[]): KanjiCard[] {
  const byKanji = new Map<string, KanjiCard>();
  for (const card of cards) {
    const existing = byKanji.get(card.kanji);
    if (!existing) {
      byKanji.set(card.kanji, { ...card });
      continue;
    }
    byKanji.set(card.kanji, {
      ...existing,
      meanings: uniqueStrings([...existing.meanings, ...card.meanings]),
      readings: uniqueStrings([...existing.readings, ...card.readings]),
      exampleWords: uniqueStrings([...existing.exampleWords, ...card.exampleWords]).slice(0, 6),
      // Keep the simpler level when a kanji appears in both N5 and N4 pools.
      jlptLevel: existing.jlptLevel === 'N5' || card.jlptLevel === 'N5' ? 'N5' : 'N4',
    });
  }
  return Array.from(byKanji.values());
}

const CARDS: Omit<KanjiCard, 'id'>[] = [
  { kanji: '日', meanings: ['day', 'sun', 'Japan'], readings: ['ニチ', 'ジツ', 'ひ'], jlptLevel: 'N5', exampleWords: ['日本', '毎日', '日曜日'] },
  { kanji: '本', meanings: ['book', 'origin'], readings: ['ホン', 'もと'], jlptLevel: 'N5', exampleWords: ['本', '日本', '本当'] },
  { kanji: '人', meanings: ['person'], readings: ['ジン', 'ニン', 'ひと'], jlptLevel: 'N5', exampleWords: ['日本人', '一人', '人'] },
  { kanji: '月', meanings: ['moon', 'month'], readings: ['ゲツ', 'ガツ', 'つき'], jlptLevel: 'N5', exampleWords: ['月曜日', '一月', '月'] },
  { kanji: '火', meanings: ['fire'], readings: ['カ', 'ひ'], jlptLevel: 'N5', exampleWords: ['火曜日', '火', '火山'] },
  { kanji: '水', meanings: ['water'], readings: ['スイ', 'みず'], jlptLevel: 'N5', exampleWords: ['水曜日', '水', '水道'] },
  { kanji: '木', meanings: ['tree', 'wood'], readings: ['ボク', 'モク', 'き'], jlptLevel: 'N5', exampleWords: ['木曜日', '木', '大木'] },
  { kanji: '金', meanings: ['gold', 'money', 'metal'], readings: ['キン', 'コン', 'かね'], jlptLevel: 'N5', exampleWords: ['金曜日', '金', '金色'] },
  { kanji: '土', meanings: ['earth', 'soil'], readings: ['ド', 'ト', 'つち'], jlptLevel: 'N5', exampleWords: ['土曜日', '土', '土地'] },
  { kanji: '山', meanings: ['mountain'], readings: ['サン', 'やま'], jlptLevel: 'N5', exampleWords: ['山', '火山'] },
  { kanji: '川', meanings: ['river'], readings: ['セン', 'かわ'], jlptLevel: 'N5', exampleWords: ['川', '小川'] },
  { kanji: '田', meanings: ['rice field'], readings: ['デン', 'た'], jlptLevel: 'N5', exampleWords: ['田んぼ', '水田'] },
  { kanji: '学', meanings: ['study', 'learn'], readings: ['ガク', 'まな.ぶ'], jlptLevel: 'N5', exampleWords: ['学生', '学校', '大学'] },
  { kanji: '校', meanings: ['school'], readings: ['コウ'], jlptLevel: 'N5', exampleWords: ['学校', '高校', '校長'] },
  { kanji: '生', meanings: ['life', 'birth', 'student'], readings: ['セイ', 'ショウ', 'い.きる', 'う.まれる'], jlptLevel: 'N5', exampleWords: ['学生', '先生', '生活'] },
  { kanji: '先', meanings: ['previous', 'ahead'], readings: ['セン', 'さき'], jlptLevel: 'N5', exampleWords: ['先生', '先月', '先週'] },
  { kanji: '会', meanings: ['meeting', 'meet'], readings: ['カイ', 'エ', 'あ.う'], jlptLevel: 'N5', exampleWords: ['会社', '会議', '会う'] },
  { kanji: '社', meanings: ['company', 'shrine'], readings: ['シャ', 'やしろ'], jlptLevel: 'N5', exampleWords: ['会社', '社会', '神社'] },
  { kanji: '同', meanings: ['same', 'together'], readings: ['ドウ', 'おな.じ'], jlptLevel: 'N4', exampleWords: ['同時', '同じ', '同級生'] },
  { kanji: '事', meanings: ['thing', 'matter'], readings: ['ジ', 'こと'], jlptLevel: 'N4', exampleWords: ['仕事', '用事', '大事'] },
  { kanji: '用', meanings: ['use', 'task'], readings: ['ヨウ'], jlptLevel: 'N4', exampleWords: ['用事', '利用', '使用'] },
  { kanji: '世', meanings: ['world'], readings: ['セイ', 'セ', 'よ'], jlptLevel: 'N4', exampleWords: ['世界', '世話', '世代'] },
  { kanji: '代', meanings: ['generation', 'substitute'], readings: ['ダイ'], jlptLevel: 'N4', exampleWords: ['時代', '代表', '代理'] },
  { kanji: '主', meanings: ['master', 'main'], readings: ['シュ', 'ぬし', 'おも'], jlptLevel: 'N4', exampleWords: ['主人', '主張', '主な'] },
  { kanji: '住', meanings: ['live', 'reside'], readings: ['ジュウ', 'す.む'], jlptLevel: 'N4', exampleWords: ['住所', '住宅', '住民'] },
  { kanji: '所', meanings: ['place'], readings: ['ショ', 'ところ'], jlptLevel: 'N4', exampleWords: ['場所', '事務所', '駐車場'] },
  { kanji: '待', meanings: ['wait'], readings: ['タイ', 'ま.つ'], jlptLevel: 'N4', exampleWords: ['待つ', '待合室'] },
  { kanji: '持', meanings: ['hold', 'have'], readings: ['ジ', 'も.つ'], jlptLevel: 'N4', exampleWords: ['持つ', '持参', '気持ち'] },
  { kanji: '続', meanings: ['continue'], readings: ['ゾク', 'つづ.く'], jlptLevel: 'N4', exampleWords: ['続ける', '連続', '続出'] },
  { kanji: '連', meanings: ['take', 'connect'], readings: ['レン', 'つ.れる'], jlptLevel: 'N4', exampleWords: ['連絡', '連合', '連休'] },
];

const LESSON_TITLE_BY_LEVEL: Record<KanjiLevel, string> = {
  N5: 'N5 Kanji — Daily Life Foundations',
  N4: 'N4 Kanji — Workplace & Communication',
};

export function buildKanjiSection(level?: KanjiLevel): KanjiSection {
  const filtered = level ? CARDS.filter((c) => c.jlptLevel === level) : CARDS;
  const cards: KanjiCard[] = filtered.map((c, i) => ({ ...c, id: `kanji-${i + 1}` }));
  const lessons: KanjiLesson[] = (['N5', 'N4'] as KanjiLevel[])
    .filter((lvl) => !level || lvl === level)
    .map((lvl) => ({
      id: `lesson-${lvl.toLowerCase()}`,
      title: LESSON_TITLE_BY_LEVEL[lvl],
      jlptLevel: lvl,
      cards: cards.filter((c) => c.jlptLevel === lvl),
    }));
  return { cards, lessons };
}