import { getQuizQuestionCandidatePack } from '../data/candidates/quizQuestionCandidatePack';
import type { QuizQuestion } from '../types/quiz';

const CHOICE_IDS = ['A', 'B', 'C', 'D'] as const;

function hasFourUniqueChoices(q: ReturnType<typeof getQuizQuestionCandidatePack>[number]): boolean {
  const choices = q.choices.slice(0, 4);
  if (choices.length !== 4) return false;
  if (!choices.some(choice => choice.id === q.correctChoiceId)) return false;
  return new Set(choices.map(choice => choice.text.trim().toLowerCase())).size === 4;
}

function getAppReadyCandidateQuizQuestions() {
  return getQuizQuestionCandidatePack()
    .filter(q => q.reviewStatus === 'approved-for-beta')
    .filter(hasFourUniqueChoices);
}

export function buildCandidateQuizQuestions(): QuizQuestion[] {
  return getAppReadyCandidateQuizQuestions()
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
  return { total: getAppReadyCandidateQuizQuestions().length };
}