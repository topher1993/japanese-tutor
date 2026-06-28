import { describe, expect, it } from 'vitest';
import { buildSenseiContentReview, getInternalBetaContentPack } from '../src/services/senseiContentReviewService';
import { mockSenseiLessons } from '../src/data/mockSenseiLessons';
import { survivalPhrases } from '../src/data/workplaceSurvivalPhrases';
import { quickQuiz } from '../src/data/quizzes';

describe('Phase 10 Sensei content review', () => {
  it('approves the internal beta content pack when all learner-facing content passes review', () => {
    const review = buildSenseiContentReview({ lessons: mockSenseiLessons, survivalPhrases, quizzes: [quickQuiz] });

    expect(review.verdict).toBe('approved-for-internal-beta');
    expect(review.blockers).toEqual([]);
    expect(review.summary.reviewedLessonCount).toBeGreaterThanOrEqual(5);
    expect(review.summary.reviewedSurvivalPhraseCount).toBeGreaterThanOrEqual(18);
    expect(review.requiredFollowUps).toContain('Track Chris-reported minor UI issues in the beta polish queue.');
  });

  it('exposes a clear first beta content pack for testers', () => {
    const pack = getInternalBetaContentPack();

    expect(pack.title).toBe('Internal Beta Pack 1 — N5 Workplace Survival');
    expect(pack.level).toBe('N5');
    expect(pack.lessonIds).toEqual(expect.arrayContaining(['lesson-workplace-greetings', 'lesson-safety-stop', 'lesson-emergency']));
    expect(pack.survivalCategoryIds).toEqual(expect.arrayContaining(['greetings', 'safety', 'emergency']));
    expect(pack.testerGuidance).toContain('focus on usefulness at work');
  });
});
