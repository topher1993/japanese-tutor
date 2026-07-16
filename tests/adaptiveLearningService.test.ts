import { describe, expect, it } from 'vitest';
import { buildAdaptiveLearningSnapshot } from '../src/services/adaptiveLearningService';

const now = new Date('2026-07-11T00:00:00Z');

describe('adaptive learning snapshot', () => {
  it('prioritizes due review over other recommendations', () => {
    const snapshot = buildAdaptiveLearningSnapshot([
      { id: 'due', refId: 'due', intervalDays: 2, repetitions: 2, easeFactor: 2.5, dueOn: '2026-07-10', lastReviewedOn: '2026-07-08', stage: 'memorized' },
      { id: 'weak', refId: 'weak', intervalDays: 1, repetitions: 0, easeFactor: 2.5, dueOn: '2026-07-12', lastReviewedOn: null, stage: 'recognized' },
    ], now);
    expect(snapshot.dueCards).toBe(1);
    expect(snapshot.weakCards).toBe(1);
    expect(snapshot.recommendation).toBe('review-due');
  });

  it('reports a new learner when no SRS cards exist', () => {
    expect(buildAdaptiveLearningSnapshot([], now)).toMatchObject({
      totalCards: 0,
      retentionPercent: 0,
      recommendation: 'learn-new',
    });
  });
});
