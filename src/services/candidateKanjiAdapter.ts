import { kanjiExampleWords, type KanjiExampleWord } from '../data/generated/kanjiExampleWords';
import type { KanjiCard, KanjiLesson } from './kanjiSectionService';

function isSingleKanjiCharacter(value: string): boolean {
  return value.length === 1 && /[\u3400-\u9fff]/.test(value);
}

function getExampleWords(kanji: string): KanjiExampleWord[] {
  return kanjiExampleWords[kanji] ?? [];
}

/**
 * Phase 22 audit fix P1-07: N5 and N4 candidate kanji packs are loaded via
 * dynamic `import()` so Metro splits them into separate chunks. The Kanji
 * Section screen is opened on-demand from the Lessons "More tools" disclosure,
 * so neither pack is in the cold-start bundle.
 */
export async function buildCandidateKanjiSection(): Promise<{ cards: KanjiCard[]; lessons: KanjiLesson[] }> {
  const [n5Module, n4Module] = await Promise.all([
    import('../data/candidates/n5KanjiCandidatePack'),
    import('../data/candidates/n4CandidatePack'),
  ]);
  const n5 = n5Module.getN5KanjiCandidatePack()
    .filter(e => e.reviewStatus === 'approved-for-beta')
    .filter(e => isSingleKanjiCharacter(e.kanji));
  const n4 = n4Module.getN4KanjiCandidatePack()
    .filter(e => e.reviewStatus === 'approved-for-beta')
    .filter(e => isSingleKanjiCharacter(e.kanji));

  const cards: KanjiCard[] = [];

  for (const k of n5) {
    const readings = [...k.onReadings, ...k.kunReadings];
    cards.push({
      id: `cand-kanji-${k.id}`,
      kanji: k.kanji,
      meanings: k.meanings,
      readings,
      jlptLevel: 'N5',
      exampleWords: getExampleWords(k.kanji),
    });
  }

  for (const k of n4) {
    cards.push({
      id: `cand-kanji-${k.id}`,
      kanji: k.kanji,
      meanings: k.meanings,
      readings: k.onyomi.length > 0 || k.kunyomi.length > 0 ? [...k.onyomi, ...k.kunyomi] : ['(pending on/kun)'],
      jlptLevel: 'N4',
      exampleWords: getExampleWords(k.kanji),
    });
  }

  const lessons: KanjiLesson[] = [
    {
      id: 'cand-kanji-lessons-n5',
      title: 'N5 Kanji (candidate pool)',
      jlptLevel: 'N5',
      cards: cards.filter(c => c.jlptLevel === 'N5'),
    },
    {
      id: 'cand-kanji-lessons-n4',
      title: 'N4 Kanji (candidate pool)',
      jlptLevel: 'N4',
      cards: cards.filter(c => c.jlptLevel === 'N4'),
    },
  ];

  return { cards, lessons };
}

export async function getCandidateKanjiCounts(): Promise<{ n5: number; n4: number; total: number }> {
  const [n5Module, n4Module] = await Promise.all([
    import('../data/candidates/n5KanjiCandidatePack'),
    import('../data/candidates/n4CandidatePack'),
  ]);
  const n5 = n5Module.getN5KanjiCandidatePack()
    .filter(e => e.reviewStatus === 'approved-for-beta')
    .filter(e => isSingleKanjiCharacter(e.kanji)).length;
  const n4 = n4Module.getN4KanjiCandidatePack()
    .filter(e => e.reviewStatus === 'approved-for-beta')
    .filter(e => isSingleKanjiCharacter(e.kanji)).length;
  return { n5, n4, total: n5 + n4 };
}