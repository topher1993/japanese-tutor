import { getQuizQuestionCandidatePack } from '../data/candidates/quizQuestionCandidatePack';

export function getCandidateQuizCounts(): { total: number } {
  const approved = getQuizQuestionCandidatePack().filter(q => q.reviewStatus === 'approved-for-beta').length;
  return { total: approved };
}