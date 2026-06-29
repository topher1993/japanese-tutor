import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { getQuickQuiz } from '../src/services/quizService';
import { getQuizQuestionCandidatePack } from '../src/data/candidates/quizQuestionCandidatePack';
import { buildReviewSession } from '../src/services/reviewModeService';
import { getCandidateReviewCounts } from '../src/services/candidateReviewAdapter';

const dailyRushScreenSource = readFileSync('src/screens/DailyRushScreen.tsx', 'utf8');

describe('Phase 35 learning materials are wired into app practice surfaces', () => {
  it('normal Test sessions include approved candidate quiz questions, not only the small starter quiz', () => {
    const approvedCandidates = getQuizQuestionCandidatePack().filter(q => q.reviewStatus === 'approved-for-beta');
    const quiz = getQuickQuiz();

    expect(approvedCandidates.length).toBeGreaterThan(300);
    expect(quiz.questions.length).toBeGreaterThan(300);
    expect(quiz.questions.some(q => q.id.startsWith('candidate-quiz-'))).toBe(true);
  });

  it('Review Mode serves the approved candidate vocabulary pool, not just the hardcoded starter items', () => {
    const counts = getCandidateReviewCounts();
    const session = buildReviewSession();

    expect(counts.total).toBeGreaterThan(1000);
    expect(session.items.length).toBe(counts.total);
    expect(session.items.some(item => item.id.startsWith('candidate-review-'))).toBe(true);
  });

  it('Daily Rush loads the full flashcard material pool including candidate vocabulary', () => {
    expect(dailyRushScreenSource).toContain('buildCandidateFlashcardCards');
    expect(dailyRushScreenSource).toContain('candidateCards');
    expect(dailyRushScreenSource).toContain('[...baseDeck.cards, ...candidateCards]');
  });
});
