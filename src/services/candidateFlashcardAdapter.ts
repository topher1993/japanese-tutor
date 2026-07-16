import type { FlashcardReviewCard } from '../types/flashcard';
import type { PlacementLevel } from './placementTestService';
import { placementLevelToCourseLevel } from './placementPathService';
import { createVocabularyEntryFromCandidate, flashcardContentFromVocabulary } from './vocabularyEntryService';
import { localDateKey } from '../utils/localDate';

/**
 * Phase 25 / P2-1: today's date as YYYY-MM-DD. Replaces the prior hardcoded
 * `'2026-06-24'` literal that made every candidate flashcard appear due on
 * a fixed past date regardless of when the learner actually installed.
 */
/**
 * Adapter that pulls approved-for-beta vocabulary candidates into the
 * flashcard deck format used by FlashcardsScreen.
 *
 * Phase 22 audit fix P1-07: candidate packs are loaded via
 * dynamic `import()` so Metro splits them into separate chunks. Neither
 * contributes to the main bundle that ships on cold-start. The first call
 * to `buildCandidateFlashcardCards` triggers both chunks to download;
 * subsequent calls are cache hits.
 *
 * Only entries with reviewStatus === 'approved-for-beta' are included.
 */
export async function buildCandidateFlashcardCards(placementLevel?: PlacementLevel): Promise<FlashcardReviewCard[]> {
  const courseLevel = placementLevelToCourseLevel(placementLevel);
  const includeN5 = courseLevel !== 'Absolute Beginner';
  const includeN4 = courseLevel === 'N4' || courseLevel === 'N3';
  const includeN3 = courseLevel === 'N3';
  // Dynamic imports — Metro will code-split these.
  const [n5Module, n4Module, n3Module] = await Promise.all([
    includeN5 ? import('../data/candidates/n5VocabularyCandidatePack') : Promise.resolve(null),
    includeN4 ? import('../data/candidates/n4CandidatePack') : Promise.resolve(null),
    includeN3 ? import('../data/candidates/n3VocabularyCandidatePack') : Promise.resolve(null),
  ]);

  const n5 = n5Module?.getN5VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta') ?? [];
  const n4 = n4Module?.getN4VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta') ?? [];
  const n3 = n3Module?.getN3VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta') ?? [];

  const cards: FlashcardReviewCard[] = [];
  const today = localDateKey();

  for (const e of n5) {
    const vocabulary = createVocabularyEntryFromCandidate({
      id: e.id,
      japanese: e.japanese,
      kana: e.kana,
      romaji: e.romaji,
      english: e.english,
      vietnamese: e.vietnamese,
      filipino: e.filipino,
      jlptLevel: e.level,
      category: e.category,
      sourcePartOfSpeech: e.partOfSpeech,
      sourceKind: 'candidate-n5',
      source: e.source.id,
      sourceId: e.source.sourceId,
      license: e.source.license,
      reviewStatus: e.reviewStatus,
    });
    cards.push({
      id: `cand-${e.id}`,
      lessonId: 'candidate-n5',
      category: e.category,
      ...flashcardContentFromVocabulary(vocabulary),
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
    const vocabulary = createVocabularyEntryFromCandidate({
      id: e.id,
      japanese: e.japanese,
      kana: e.kana,
      romaji: e.romaji,
      english: e.english,
      jlptLevel: e.level,
      category: 'n4-vocab',
      sourcePartOfSpeech: e.partOfSpeech,
      sourceKind: 'candidate-n4',
      source: e.source.id,
      sourceId: e.source.sourceId,
      license: e.source.license,
      reviewStatus: e.reviewStatus,
    });
    cards.push({
      id: `cand-${e.id}`,
      lessonId: 'candidate-n4',
      category: 'n4-vocab',
      ...flashcardContentFromVocabulary(vocabulary),
      reviewCount: 0,
      nextReviewDate: today,
      translationReviewStatus: 'draft',
      kind: 'vocab' as const,
    });
  }

  for (const e of n3) {
    const vocabulary = createVocabularyEntryFromCandidate({
      id: e.id,
      japanese: e.japanese,
      kana: e.kana,
      romaji: e.romaji,
      english: e.english,
      vietnamese: e.vietnamese,
      filipino: e.filipino,
      jlptLevel: e.level,
      category: 'n3-vocab',
      sourcePartOfSpeech: e.partOfSpeech,
      sourceKind: 'candidate-n3',
      source: e.source.id,
      sourceId: e.source.sourceId,
      license: e.source.license,
      reviewStatus: e.reviewStatus,
    });
    cards.push({
      id: `cand-${e.id}`,
      lessonId: 'candidate-n3',
      category: 'n3-vocab',
      ...flashcardContentFromVocabulary(vocabulary),
      reviewCount: 0,
      nextReviewDate: today,
      translationReviewStatus: 'draft',
      kind: 'vocab' as const,
    });
  }

  return cards;
}

export async function getCandidateCardCounts(placementLevel?: PlacementLevel): Promise<{ n5: number; n4: number; n3: number; total: number }> {
  const courseLevel = placementLevelToCourseLevel(placementLevel);
  const includeN5 = courseLevel !== 'Absolute Beginner';
  const includeN4 = courseLevel === 'N4' || courseLevel === 'N3';
  const includeN3 = courseLevel === 'N3';
  const [n5Module, n4Module, n3Module] = await Promise.all([
    includeN5 ? import('../data/candidates/n5VocabularyCandidatePack') : Promise.resolve(null),
    includeN4 ? import('../data/candidates/n4CandidatePack') : Promise.resolve(null),
    includeN3 ? import('../data/candidates/n3VocabularyCandidatePack') : Promise.resolve(null),
  ]);
  const n5 = n5Module?.getN5VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta').length ?? 0;
  const n4 = n4Module?.getN4VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta').length ?? 0;
  const n3 = n3Module?.getN3VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta').length ?? 0;
  return { n5, n4, n3, total: n5 + n4 + n3 };
}
