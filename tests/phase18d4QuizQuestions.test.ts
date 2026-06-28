import { describe, expect, it } from 'vitest';

import { getQuizQuestionCandidatePack } from '../src/data/candidates/quizQuestionCandidatePack';

describe('Phase 18D-4 quiz question candidate pack', () => {
  it('contains at least 300 quiz question candidates', () => {
    const pack = getQuizQuestionCandidatePack();
    expect(pack.length).toBeGreaterThanOrEqual(300);
  });

  it('has unique question ids', () => {
    const pack = getQuizQuestionCandidatePack();
    const ids = new Set(pack.map((q) => q.id));
    expect(ids.size).toBe(pack.length);
  });

  it('every question has prompt, exactly 4 choices, and a valid correctChoiceId', () => {
    const pack = getQuizQuestionCandidatePack();
    for (const q of pack) {
      expect(q.prompt.trim().length).toBeGreaterThan(0);
      expect(q.choices.length).toBe(4);
      const ids = new Set(q.choices.map((c) => c.id));
      expect(ids.size).toBe(4);
      expect(q.correctChoiceId).toBeTruthy();
      expect(ids.has(q.correctChoiceId)).toBe(true);
      expect(q.category.trim().length).toBeGreaterThan(0);
    }
  });

  it('every question is candidate-only and not connected to live app', () => {
    const pack = getQuizQuestionCandidatePack();
    for (const q of pack) {
      expect(q.connectedToApp).toBe(false);
      expect(q.reviewStatus).toMatch(/^(sensei-review-needed|approved-for-beta)$/);
    }
  });
});