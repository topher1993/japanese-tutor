import type { LearnerLanguage, OnboardingState, OnboardingStep, OnboardingStepId } from '../types/onboarding';
const steps: OnboardingStep[] = [
  { id: 'welcome', title: 'Japanese Tutor for Work', body: 'Learn practical Japanese for daily work, safety, and life in Japan.', cta: 'Start setup' },
  { id: 'language', title: 'Choose your helper language', body: 'Sensei will use this language to explain Japanese phrases. You can still see other translations when useful.', cta: 'Continue' },
  { id: 'workplace-goal', title: 'Focus on workplace survival first', body: 'Practice greetings, safety, schedules, tools, and emergency phrases.', cta: 'Set goal' },
  { id: 'daily-habit', title: 'Build a 5-minute daily habit', body: 'One small lesson, a quick quiz, and flashcards each day.', cta: 'Open app' }
];
export function getOnboardingSteps(): OnboardingStep[] { return steps; }
export function getDefaultOnboardingState(): OnboardingState { return { currentStepId: 'welcome', completed: false, language: 'en' }; }
export function selectLearnerLanguage(state: OnboardingState, language: LearnerLanguage): OnboardingState { return { ...state, language }; }
export function advanceOnboarding(state: OnboardingState): OnboardingState { const ids = steps.map(step => step.id); const idx = ids.indexOf(state.currentStepId); const next = ids[idx + 1] as OnboardingStepId | undefined; return next ? { ...state, currentStepId: next } : { ...state, completed: true }; }
export function getCurrentOnboardingStep(state: OnboardingState): OnboardingStep { return steps.find(step => step.id === state.currentStepId) ?? steps[0]; }
