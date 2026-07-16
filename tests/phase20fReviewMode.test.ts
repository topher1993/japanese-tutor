import { describe, expect, it } from 'vitest';

import { buildReviewSession } from '../src/services/reviewModeService';

describe('Phase 20F review mode', () => {
  it('builds a session with review items', () => {
    const session = buildReviewSession();
    expect(session.items.length).toBeGreaterThan(0);
    expect(session.totalCount).toBe(session.items.length);
  });

  it('every item has a prompt and 4 choices', () => {
    const session = buildReviewSession();
    for (const item of session.items) {
      expect(item.prompt.trim().length).toBeGreaterThan(0);
      expect(item.choices.length).toBe(4);
    }
  });

  it('marks correct answers correctly', () => {
    const session = buildReviewSession();
    const responses = session.items.map((it) => it.correctIndex);
    const result = session.score(responses);
    expect(result.correctCount).toBe(session.items.length);
    expect(result.percent).toBe(100);
  });

  it('produces 0% score when all wrong', () => {
    const session = buildReviewSession();
    const responses = session.items.map((it) => (it.correctIndex + 1) % 4);
    const result = session.score(responses);
    expect(result.correctCount).toBe(0);
    expect(result.percent).toBe(0);
  });

  it('session respects JLPT level filter', () => {
    const session = buildReviewSession('N4');
    for (const item of session.items) {
      expect(['N5', 'N4']).toContain(item.jlptLevel);
    }
  });
});
