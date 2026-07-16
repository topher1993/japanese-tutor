import { describe, expect, it } from 'vitest';
import { buildMasteryMap, buildMasterySnapshot, evaluateMasteryPrerequisite, evaluatePersistedMasteryGate, masteryTopicLabel, recognitionScoreFromSrs } from '../src/services/masteryService';
import type { FlashcardReviewCard } from '../src/types/flashcard';
import type { MasteryEvidence } from '../src/types/mastery';
import type { ReviewCard } from '../src/services/spacedRepetitionService';

function flashcard(id: string, group: FlashcardReviewCard['learningGroup'] = 'verb'): FlashcardReviewCard {
  return {
    id, lessonId: 'lesson-1', category: 'Workplace', japanese: id, reading: id,
    romaji: id, english: id, vietnamese: id, filipino: id, reviewCount: 0,
    nextReviewDate: '2026-07-11', translationReviewStatus: 'approved',
    learningGroup: group, partOfSpeech: group === 'adjective' ? 'i-adjective' : group,
  };
}

function row(refId: string, overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: `srs-${refId}`, refId, intervalDays: 6, repetitions: 2, easeFactor: 2.5,
    dueOn: '2026-07-20', lastReviewedOn: '2026-07-10', stage: 'memorized', ...overrides,
  };
}

function evidence(refId: string, modality: MasteryEvidence['modality'], score: number, day = '2026-07-10'): MasteryEvidence {
  return { id: `${refId}-${modality}-${day}`, refId, modality, score, source: 'flashcards', occurredAt: `${day}T10:00:00.000Z` };
}

describe('Personalized Mastery System', () => {
  it('turns internal topic slugs into learner-facing labels', () => {
    expect(masteryTopicLabel('n4-vocab')).toBe('N4 Vocab');
    expect(masteryTopicLabel('daily-life')).toBe('Daily Life');
  });
  it('derives recognition strength from SRS stage, schedule, and overdue state', () => {
    const now = new Date('2026-07-11T12:00:00.000Z');
    expect(recognitionScoreFromSrs(row('a'), now)).toBeGreaterThan(recognitionScoreFromSrs(row('a', { stage: 'recognized' }), now));
    expect(recognitionScoreFromSrs(row('a', { dueOn: '2026-06-01' }), now)).toBeLessThan(recognitionScoreFromSrs(row('a'), now));
  });

  it('tracks recognition, reading, listening, and production separately', () => {
    const map = buildMasteryMap({
      flashcards: [flashcard('taberu')], srsCards: [row('taberu')],
      evidence: [evidence('taberu', 'listening', 1), evidence('taberu', 'production', 0.2)],
      now: new Date('2026-07-11T12:00:00.000Z'),
    });
    const item = map.items[0];
    expect(item.scores.recognition).toBeGreaterThan(60);
    expect(item.scores.listening).toBe(100);
    expect(item.scores.production).toBe(20);
    expect(item.level).toBe('familiar');
  });

  it('aggregates learner-facing word groups and finds the weakest focus', () => {
    const map = buildMasteryMap({
      flashcards: [flashcard('v', 'verb'), flashcard('a', 'adjective')],
      srsCards: [row('v'), row('a', { stage: 'seen', repetitions: 0, intervalDays: 0 })],
      now: new Date('2026-07-11T12:00:00.000Z'),
    });
    expect(map.groups.find(group => group.group === 'verb')?.score).toBeGreaterThan(map.groups.find(group => group.group === 'adjective')?.score ?? 100);
    expect(map.weakestGroup).toBe('adjective');
  });

  it('calculates change against the nearest snapshot at least seven days old', () => {
    const base = buildMasteryMap({ flashcards: [flashcard('v')], srsCards: [row('v')], now: new Date('2026-07-11T12:00:00.000Z') });
    const map = buildMasteryMap({
      flashcards: [flashcard('v')], srsCards: [row('v')],
      snapshots: [{ ...buildMasterySnapshot(base, '2026-07-01'), overallScore: base.overallScore - 8 }],
      now: new Date('2026-07-11T12:00:00.000Z'),
    });
    expect(map.weeklyChange).toBe(8);
  });

  it('only blocks prerequisites after enough genuine evidence exists', () => {
    const sparse = buildMasteryMap({ flashcards: [flashcard('a')], srsCards: [], now: new Date('2026-07-11T12:00:00.000Z') });
    expect(evaluateMasteryPrerequisite(sparse).allowed).toBe(true);
    const practiced = buildMasteryMap({
      flashcards: [flashcard('a'), flashcard('b'), flashcard('c')], srsCards: [],
      evidence: ['a', 'b', 'c'].map(id => evidence(id, 'recognition', 0.2)),
      now: new Date('2026-07-11T12:00:00.000Z'),
    });
    expect(evaluateMasteryPrerequisite(practiced).allowed).toBe(false);
  });

  it('keeps early learners unblocked and gates only evidence-backed low mastery', () => {
    const entries = ['a', 'b', 'c', 'd', 'e'].map(id => evidence(id, 'recognition', 0.1));
    const low = [{ date: '2026-07-11', overallScore: 10, groupScores: {} }];
    expect(evaluatePersistedMasteryGate(entries.slice(0, 4), low).allowed).toBe(true);
    expect(evaluatePersistedMasteryGate(entries, low).allowed).toBe(false);
    const strong = ['a', 'b', 'c', 'd', 'e'].map(id => evidence(id, 'recognition', 0.6));
    expect(evaluatePersistedMasteryGate(strong, low).allowed).toBe(true);
  });

  it('uses current evidence instead of a stale Progress-screen snapshot', () => {
    const weak = ['a', 'b', 'c', 'd', 'e'].map(id => evidence(id, 'recognition', 0.1));
    const strong = ['a', 'b', 'c', 'd', 'e'].map(id => evidence(id, 'recognition', 0.8));
    const staleHigh = [{ date: '2026-06-01', overallScore: 90, groupScores: {} }];
    const staleLow = [{ date: '2026-06-01', overallScore: 5, groupScores: {} }];
    expect(evaluatePersistedMasteryGate(weak, staleHigh).allowed).toBe(false);
    expect(evaluatePersistedMasteryGate(strong, staleLow).allowed).toBe(true);
    expect(evaluatePersistedMasteryGate(strong, []).score).toBe(80);
    const improved = [
      ...weak,
      ...['a', 'b', 'c', 'd', 'e'].map(id => evidence(id, 'recognition', 0.8, '2026-07-12')),
    ];
    expect(evaluatePersistedMasteryGate(improved, staleLow).score).toBe(80);
  });
});
