import { describe, expect, it } from 'vitest';

import { buildPlacementTest, scorePlacementTest } from '../src/services/placementTestService';

describe('Phase 20D placement test', () => {
  it('builds a multi-level placement test', () => {
    const test = buildPlacementTest();
    expect(test.levels.length).toBeGreaterThanOrEqual(2);
    expect(test.totalQuestions).toBeGreaterThan(0);
  });

  it('every question has 4 choices and a correct index', () => {
    const test = buildPlacementTest();
    for (const q of test.questions) {
      expect(q.choices.length).toBe(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
    }
  });

  it('scores all-correct responses as 100% with the highest recommended level', () => {
    const test = buildPlacementTest();
    const responses = test.questions.map((q) => q.correctIndex);
    const result = scorePlacementTest(responses);
    expect(result.scorePercent).toBe(100);
    expect(result.recommendedLevel).toBe('N3-or-above');
  });

  it('scores low responses as N5 recommended', () => {
    const test = buildPlacementTest();
    const responses = test.questions.map(() => 0);
    const result = scorePlacementTest(responses);
    expect(result.scorePercent).toBeLessThan(40);
    expect(result.recommendedLevel).toBe('N5');
  });

  it('returns per-level breakdown counts', () => {
    const test = buildPlacementTest();
    const responses = test.questions.map((q) => q.correctIndex);
    const result = scorePlacementTest(responses);
    expect(result.byLevel.length).toBe(test.levels.length);
    for (const lvl of result.byLevel) {
      expect(lvl.correct + lvl.total).toBeGreaterThan(0);
    }
  });
});