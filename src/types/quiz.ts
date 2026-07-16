export interface QuizChoice { id: 'A' | 'B' | 'C' | 'D'; text: string; }
export interface QuizQuestion { id: string; prompt: string; choices: QuizChoice[]; correctChoice: QuizChoice['id']; explanation: string; }
export interface Quiz { id: string; title: string; lessonId: string; questions: QuizQuestion[]; }
export interface QuizFeedback { questionId: string; correct: boolean; selectedChoice?: string; correctChoice: string; explanation: string; }
export interface QuizResult { score: number; total: number; feedback: QuizFeedback[]; }

export type QuizPracticeMode = 'mixed' | 'listening' | 'builder' | 'fillBlank';
export type QuizContentSource = 'mixed' | 'phrases' | 'grammar';
