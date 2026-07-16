import { getQuickQuiz, gradeQuiz } from './quizService';
import type { QuizQuestion, QuizResult } from '../types/quiz';
export interface QuizSession { quizId: string; questions: QuizQuestion[]; currentIndex: number; answers: Record<string, string>; complete: boolean; }
export const QUIZ_SESSION_SIZE = 10;

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function shuffleQuestionChoices(question: QuizQuestion, random: () => number): QuizQuestion {
  const shuffled = shuffle(question.choices, random);
  const choiceIds: QuizQuestion['choices'][number]['id'][] = ['A', 'B', 'C', 'D'];
  let correctChoice: QuizQuestion['correctChoice'] = 'A';
  const choices = shuffled.map((choice, index) => {
    const id = choiceIds[index] ?? 'D';
    if (choice.id === question.correctChoice) correctChoice = id;
    return { ...choice, id };
  });
  return { ...question, choices, correctChoice };
}

export function createQuizSession(random: () => number = Math.random): QuizSession {
  const quiz = getQuickQuiz();
  const questions = shuffle(quiz.questions, random)
    .slice(0, QUIZ_SESSION_SIZE)
    .map(question => shuffleQuestionChoices(question, random));
  return { quizId: quiz.id, questions, currentIndex: 0, answers: {}, complete: false };
}
export function getCurrentQuestion(session: QuizSession): QuizQuestion | undefined { return session.questions[session.currentIndex]; }
export function getQuizSessionProgress(session: QuizSession) { return { current: Math.min(session.currentIndex + 1, session.questions.length), total: session.questions.length, answered: Object.keys(session.answers).length, complete: session.complete }; }
export function answerCurrentQuestion(session: QuizSession, choice: string): QuizSession { const current = getCurrentQuestion(session); if (!current) return { ...session, complete: true }; const nextIndex = session.currentIndex + 1; return { ...session, answers: { ...session.answers, [current.id]: choice }, currentIndex: nextIndex, complete: nextIndex >= session.questions.length }; }
export function finishQuizSession(session: QuizSession): QuizResult { return gradeQuiz({ id: session.quizId, title: 'Session Quiz', lessonId: 'lesson-workplace-greetings', questions: session.questions }, session.answers); }
