import type { FlashcardReviewCard } from '../types/flashcard';

/**
 * Phase 25 / P2-1: today's date as YYYY-MM-DD. Replaces the prior hardcoded
 * `'2026-06-24'` literal that made every candidate flashcard appear due on
 * a fixed past date regardless of when the learner actually installed.
 */
function todayIso(): string { return new Date().toISOString().slice(0, 10); }

/**
 * Adapter that pulls approved-for-beta vocabulary candidates into the
 * flashcard deck format used by FlashcardsScreen.
 *
 * Phase 22 audit fix P1-07: both N5 and N4 candidate packs are loaded via
 * dynamic `import()` so Metro splits them into separate chunks. Neither
 * contributes to the main bundle that ships on cold-start. The first call
 * to `buildCandidateFlashcardCards` triggers both chunks to download;
 * subsequent calls are cache hits.
 *
 * Only entries with reviewStatus === 'approved-for-beta' are included.
 */
export async function buildCandidateFlashcardCards(): Promise<FlashcardReviewCard[]> {
  // Dynamic imports — Metro will code-split these.
  const [n5Module, n4Module] = await Promise.all([
    import('../data/candidates/n5VocabularyCandidatePack'),
    import('../data/candidates/n4CandidatePack'),
  ]);

  const n5 = n5Module.getN5VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta');
  const n4 = n4Module.getN4VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta');

  const cards: FlashcardReviewCard[] = [];
  const today = todayIso();

  for (const e of n5) {
    cards.push({
      id: `cand-${e.id}`,
      lessonId: 'candidate-n5',
      category: e.category,
      japanese: e.japanese,
      romaji: e.romaji,
      english: e.english,
      vietnamese: e.vietnamese,
      filipino: e.filipino,
      reviewCount: 0,
      nextReviewDate: today,
      translationReviewStatus: 'draft',
      // Phase 37d-2: candidate packs are vocab until a future kind-tagged
      // kanji source ships (37d-3). Default 'vocab' so the weekly-todo gate
      // can count these toward a `flashcards` todo's pool size.
      kind: 'vocab' as const,
    });
  }

  for (const e of n4) {
    cards.push({
      id: `cand-${e.id}`,
      lessonId: 'candidate-n4',
      category: 'n4-vocab',
      japanese: e.japanese,
      romaji: e.romaji,
      english: e.english,
      vietnamese: '',
      filipino: '',
      reviewCount: 0,
      nextReviewDate: today,
      translationReviewStatus: 'draft',
      kind: 'vocab' as const,
    });
  }

  return cards;
}

export async function getCandidateCardCounts(): Promise<{ n5: number; n4: number; total: number }> {
  const [n5Module, n4Module] = await Promise.all([
    import('../data/candidates/n5VocabularyCandidatePack'),
    import('../data/candidates/n4CandidatePack'),
  ]);
  const n5 = n5Module.getN5VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta').length;
  const n4 = n4Module.getN4VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta').length;
  return { n5, n4, total: n5 + n4 };
}