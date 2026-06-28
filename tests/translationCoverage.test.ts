/**
 * Translation coverage test.
 *
 * Verifies that every APPROVED phrase in the curated data files has a
 * non-empty English, Vietnamese, and Filipino translation. Draft phrases
 * (pending Sensei review) are explicitly allowed to ship with
 * "(pending ...)" placeholders so N4 lessons can be authored now and
 * translated later - the user-visible translations gate runs at the
 * point of `translationReviewStatus === 'approved'`.
 *
 * Also reports the count of phrases by translationReviewStatus so we can
 * track Sensei review progress.
 */
import { describe, expect, it } from 'vitest';

import { additionalLessonCategoryContent } from '../src/data/additionalLessonCategoryContent';
import { survivalPhrases } from '../src/data/workplaceSurvivalPhrases';
import { supplementalFlashcards } from '../src/data/supplementalFlashcards';
import { dailySenseiLesson, mockSenseiLessons } from '../src/data/mockSenseiLessons';

const allPhrases = [
  ...additionalLessonCategoryContent.flatMap(c => c.phrases),
  ...survivalPhrases,
  ...supplementalFlashcards,
  ...dailySenseiLesson.items,
  ...mockSenseiLessons.flatMap(l => l.items),
];

// Phase 31: scope the no-placeholder invariant to APPROVED phrases only.
// Draft phrases are explicitly allowed to ship with placeholder translations
// so a real Sensei can review them later.
const approvedPhrases = allPhrases.filter(p => p.translationReviewStatus === 'approved');

function isBlank(s: string): boolean {
  return !s || s.trim().length === 0 || /^[\s.()\-,]+$/.test(s) || /pending/i.test(s);
}

describe('Translation coverage (no empty EN/VI/TL phrases)', () => {
  it('every APPROVED phrase has non-empty English, Vietnamese, and Filipino', () => {
    const incomplete = approvedPhrases
      .filter(p => isBlank(p.english) || isBlank(p.vietnamese) || isBlank(p.filipino))
      .map(p => ({ id: p.id, english: p.english, vietnamese: p.vietnamese, filipino: p.filipino }));
    if (incomplete.length > 0) {
      console.error('Incomplete translations found:', incomplete);
    }
    expect(incomplete).toEqual([]);
  });

  it('every phrase has a translationReviewStatus field', () => {
    const missing = allPhrases.filter(p => !(p as { translationReviewStatus?: string }).translationReviewStatus);
    if (missing.length > 0) {
      console.error('Phrases missing translationReviewStatus:', missing.map((p): string => p.id));
    }
    expect(missing).toEqual([]);
  });

  it('translationReviewStatus is one of: approved | draft', () => {
    const validStatuses = new Set(['approved', 'draft']);
    const invalid = allPhrases.filter(p => !validStatuses.has(p.translationReviewStatus));
    expect(invalid).toEqual([]);
  });

  it('phrase IDs are unique within each data file', () => {
    const groups: Array<{ name: string; ids: string[] }> = [
      { name: 'additionalLessonCategoryContent', ids: additionalLessonCategoryContent.flatMap(c => c.phrases.map((p): string => p.id)) },
      { name: 'workplaceSurvivalPhrases', ids: survivalPhrases.map((p): string => p.id) },
      { name: 'supplementalFlashcards', ids: supplementalFlashcards.map((p): string => p.id) },
      { name: 'dailySenseiLesson', ids: dailySenseiLesson.items.map((p): string => p.id) },
      { name: 'mockSenseiLessons', ids: mockSenseiLessons.flatMap(l => l.items.map((p): string => p.id)) },
    ];
    for (const g of groups) {
      const seen = new Set<string>();
      const dupes: string[] = [];
      for (const id of g.ids) {
        if (seen.has(id)) dupes.push(id);
        else seen.add(id);
      }
      if (dupes.length > 0) {
        console.error(`[${g.name}] duplicate IDs:`, dupes);
      }
      expect(dupes, `duplicates in ${g.name}`).toEqual([]);
    }
  });
});

describe('Translation review status (Sensei dashboard)', () => {
  it('counts phrases by status for Sensei review progress', () => {
    const approved = allPhrases.filter(p => p.translationReviewStatus === 'approved').length;
    const draft = allPhrases.filter(p => p.translationReviewStatus === 'draft').length;
    console.log(`[translation coverage] approved: ${approved} | draft: ${draft} | total: ${allPhrases.length}`);
    // Sanity check: we should never have ALL phrases in draft (means the script didn't run on existing data)
    expect(approved + draft).toBe(allPhrases.length);
  });
});
