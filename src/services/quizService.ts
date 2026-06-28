import { quickQuiz } from '../data/quizzes';
import type { Quiz, QuizResult } from '../types/quiz';

export function getQuickQuiz(): Quiz { return quickQuiz; }
export function gradeQuiz(quiz: Quiz, answers: Record<string, string>): QuizResult {
  const feedback = quiz.questions.map(question => {
    const selectedChoice = answers[question.id];
    const correct = selectedChoice === question.correctChoice;
    return { questionId: question.id, selectedChoice, correct, correctChoice: question.correctChoice, explanation: question.explanation };
  });
  return { score: feedback.filter(item => item.correct).length, total: quiz.questions.length, feedback };
}
