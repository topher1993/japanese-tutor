export type LearnerLanguage = 'en' | 'vi' | 'tl';
export type OnboardingStepId = 'welcome' | 'language' | 'workplace-goal' | 'daily-habit';
export interface OnboardingStep { id: OnboardingStepId; title: string; body: string; cta: string; }
export interface OnboardingState { currentStepId: OnboardingStepId; completed: boolean; language: LearnerLanguage; }
