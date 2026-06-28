import { getQuickQuiz, gradeQuiz } from './quizService';
import type { QuizQuestion, QuizResult } from '../types/quiz';
export interface QuizSession { quizId: string; questions: QuizQuestion[]; currentIndex: number; answers: Record<string, string>; complete: boolean; }
export function createQuizSession(): QuizSession { const quiz = getQuickQuiz(); return { quizId: quiz.id, questions: quiz.questions, currentIndex: 0, answers: {}, complete: false }; }
export function getCurrentQuestion(session: QuizSession): QuizQuestion | undefined { return session.questions[session.currentIndex]; }
export function getQuizSessionProgress(session: QuizSession) { return { current: Math.min(session.currentIndex + 1, session.questions.length), total: session.questions.length, answered: Object.keys(session.answers).length, complete: session.complete }; }
export function answerCurrentQuestion(session: QuizSession, choice: string): QuizSession { const current = getCurrentQuestion(session); if (!current) return { ...session, complete: true }; const nextIndex = session.currentIndex + 1; return { ...session, answers: { ...session.answers, [current.id]: choice }, currentIndex: nextIndex, complete: nextIndex >= session.questions.length }; }
export function finishQuizSession(session: QuizSession): QuizResult { return gradeQuiz({ id: session.quizId, title: 'Session Quiz', lessonId: 'lesson-workplace-greetings', questions: session.questions }, session.answers); }
