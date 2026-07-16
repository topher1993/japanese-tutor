import { describe, expect, it } from 'vitest';

import { mockSenseiLessons } from '../src/data/mockSenseiLessons';
import { getLessonExampleSentencePack } from '../src/data/candidates/exampleSentenceCandidatePack';
import { getN3VocabularyCandidatePack } from '../src/data/candidates/n3VocabularyCandidatePack';
import { buildCandidateFlashcardCards, getCandidateCardCounts } from '../src/services/candidateFlashcardAdapter';

describe('N3 source-backed lesson content', () => {
  it('uses existing JMdict-backed N3 candidates with preserved provenance', () => {
    const candidateIds = new Set(
      getN3VocabularyCandidatePack().map(candidate => candidate.id),
    );
    const sourceItems = mockSenseiLessons
      .filter(lesson => lesson.level === 'N3')
      .flatMap(lesson => lesson.items.filter(item => item.contentReviewStatus === 'source-backed-candidate'));

    expect(sourceItems).toHaveLength(5);
    for (const item of sourceItems) {
      expect(item.translationReviewStatus).toBe('approved');
      expect(item.sourceRefs).toHaveLength(1);
      expect(item.sourceRefs?.[0].source).toBe('jmdict-edrdg');
      expect(item.sourceRefs?.[0].license).toBe('CC BY-SA 4.0');
      expect(candidateIds.has(item.sourceRefs?.[0].sourceId ?? '')).toBe(true);
      expect(item.vietnamese.length).toBeGreaterThan(0);
      expect(item.filipino.length).toBeGreaterThan(0);
    }
  });

  it('provides a dedicated 1,000-entry N3 adjective and verb pack with a translated starter subset', async () => {
    const pack = getN3VocabularyCandidatePack();
    expect(pack).toHaveLength(1000);
    expect(new Set(pack.map(entry => entry.id)).size).toBe(1000);
    expect(pack.every(entry => entry.level === 'N3')).toBe(true);
    expect(pack.every(entry => entry.source.id === 'jmdict-edrdg')).toBe(true);
    expect(pack.filter(entry => entry.vietnamese && entry.filipino)).toHaveLength(20);
    expect(pack.filter(entry => entry.id.startsWith('jmdict-verb-n3-'))).toHaveLength(500);

    const n5Cards = await buildCandidateFlashcardCards();
    const absoluteBeginnerCards = await buildCandidateFlashcardCards('absolute-beginner');
    const n4Cards = await buildCandidateFlashcardCards('N4');
    const n3Cards = await buildCandidateFlashcardCards('N3');
    expect(n5Cards.some(card => card.lessonId === 'candidate-n4' || card.lessonId === 'candidate-n3')).toBe(false);
    expect(absoluteBeginnerCards.some(card => card.lessonId.startsWith('candidate-'))).toBe(false);
    expect(n4Cards.some(card => card.lessonId === 'candidate-n4')).toBe(true);
    expect(n4Cards.some(card => card.lessonId === 'candidate-n3')).toBe(false);
    expect(n3Cards.filter(card => card.lessonId === 'candidate-n3')).toHaveLength(1000);
    expect(n4Cards.filter(card => card.lessonId === 'candidate-n4').every(card => card.jlptLevel === 'N4')).toBe(true);
    expect(n3Cards.filter(card => card.lessonId === 'candidate-n3').every(card => card.jlptLevel === 'N3')).toBe(true);

    const counts = await getCandidateCardCounts('N3');
    expect(counts.n3).toBe(1000);
    expect(counts.total).toBe(n3Cards.length);

    await expect(getCandidateCardCounts('absolute-beginner')).resolves.toEqual({ n5: 0, n4: 0, n3: 0, total: 0 });
  });

  it('keeps the authored grammar items distinct from source-backed vocabulary references', () => {
    const n3Items = mockSenseiLessons
      .filter(lesson => lesson.level === 'N3')
      .flatMap(lesson => lesson.items);

    expect(n3Items.some(item => item.contentReviewStatus === undefined)).toBe(true);
    expect(n3Items.some(item => item.sourceRefs?.some(ref => ref.usage === 'vocabulary'))).toBe(true);
  });

  it('preserves N3 labels when lesson items become example sentences', () => {
    const n3Lessons = mockSenseiLessons.filter(lesson => lesson.level === 'N3');
    const n3LessonIds = new Set(n3Lessons.map(lesson => lesson.id));
    const expectedCount = n3Lessons.reduce((sum, lesson) => sum + lesson.items.length, 0);
    const examples = getLessonExampleSentencePack()
      .filter(entry => n3LessonIds.has(entry.source.id));

    expect(examples).toHaveLength(expectedCount);
    expect(examples.every(entry => entry.jlptLevel === 'N3')).toBe(true);
  });
});
