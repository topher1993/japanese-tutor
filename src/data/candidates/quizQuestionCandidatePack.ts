export type QuizReviewStatus = 'candidate' | 'sensei-review-needed' | 'approved-for-beta' | 'rejected';

export interface QuizChoice {
  id: string;
  text: string;
}

export interface QuizQuestionCandidateEntry {
  id: string;
  prompt: string;
  choices: QuizChoice[];
  correctChoiceId: string;
  explanation: string;
  category: string;
  jlptLevel: 'N5' | 'N4';
  reviewStatus: QuizReviewStatus;
  connectedToApp: boolean;
}

import { quizQuestionCandidatePack } from './quizQuestionCandidateData';

export function getQuizQuestionCandidatePack(): QuizQuestionCandidateEntry[] {
  return quizQuestionCandidatePack;
}