import type { KanjiCard, KanjiLesson } from './kanjiSectionService';

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
  const n5 = n5Module.getN5KanjiCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta');
  const n4 = n4Module.getN4KanjiCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta');

  const cards: KanjiCard[] = [];

  for (const k of n5) {
    cards.push({
      id: `cand-kanji-${k.id}`,
      kanji: k.kanji,
      meanings: ['(review needed)'],
      readings: ['(pending)'],
      jlptLevel: 'N5',
      exampleWords: [],
    });
  }

  for (const k of n4.slice(0, 200)) {
    cards.push({
      id: `cand-kanji-${k.id}`,
      kanji: k.kanji,
      meanings: k.meanings,
      readings: k.onyomi.length > 0 || k.kunyomi.length > 0 ? [...k.onyomi, ...k.kunyomi] : ['(pending on/kun)'],
      jlptLevel: 'N4',
      exampleWords: [],
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
  const n5 = n5Module.getN5KanjiCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta').length;
  const n4 = n4Module.getN4KanjiCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta').length;
  return { n5, n4, total: n5 + n4 };
}