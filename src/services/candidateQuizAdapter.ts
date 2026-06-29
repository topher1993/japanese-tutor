import { getQuizQuestionCandidatePack } from '../data/candidates/quizQuestionCandidatePack';
import type { QuizQuestion } from '../types/quiz';

const CHOICE_IDS = ['A', 'B', 'C', 'D'] as const;

export function buildCandidateQuizQuestions(): QuizQuestion[] {
  return getQuizQuestionCandidatePack()
    .filter(q => q.reviewStatus === 'approved-for-beta')
    .map((q): QuizQuestion => {
      const choices = q.choices.slice(0, 4).map((choice, index) => ({
        id: CHOICE_IDS[index],
        text: choice.text,
      }));
      const correctChoice = choices.find(choice => choice.id === q.correctChoiceId)?.id ?? 'A';
      return {
        id: `candidate-quiz-${q.id}`,
        prompt: q.prompt,
        choices,
        correctChoice,
        explanation: q.explanation,
      };
    });
}

export function getCandidateQuizCounts(): { total: number } {
  const approved = getQuizQuestionCandidatePack().filter(q => q.reviewStatus === 'approved-for-beta').length;
  return { total: approved };
}