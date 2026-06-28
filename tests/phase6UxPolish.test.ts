import { describe, expect, it } from 'vitest';
import { getOnboardingSteps, getDefaultOnboardingState, advanceOnboarding, selectLearnerLanguage } from '../src/services/onboardingService';
import { getEmptyStateContent } from '../src/services/emptyStateService';
import { getLogoConcepts, getSplashScreenConcepts, getSafeIllustrationPrompts } from '../src/services/assetConceptService';
import { getPolishedDesignTokens, getComponentPolishSpec } from '../src/services/uxPolishService';
import { buildSmallScreenQaMatrix } from '../src/services/smallScreenQaService';
import { buildDependencyRemediationPlan } from '../src/services/dependencyRemediationService';

describe('Phase 6 UX polish and device QA', () => {
  it('defines a beginner-friendly onboarding flow with language selection', () => {
    const steps = getOnboardingSteps();
    expect(steps.map(step => step.id)).toEqual(['welcome', 'language', 'workplace-goal', 'daily-habit']);
    expect(steps[0].title).toContain('Japanese Tutor');
    const state = selectLearnerLanguage(getDefaultOnboardingState(), 'vi');
    expect(state.language).toBe('vi');
    expect(advanceOnboarding(state).currentStepId).toBe('language');
  });

  it('provides useful empty states for study surfaces', () => {
    expect(getEmptyStateContent('lessons')).toMatchObject({ title: expect.stringContaining('lesson'), actionLabel: 'Start first lesson' });
    expect(getEmptyStateContent('flashcards').body).toContain('review');
    expect(getEmptyStateContent('progress').actionLabel).toBe('Complete a lesson');
  });

  it('generates safe logo, splash, and illustration concepts without forbidden assets', () => {
    const logos = getLogoConcepts();
    expect(logos.length).toBeGreaterThanOrEqual(3);
    expect(logos[0]).toContain('speech');
    const splashes = getSplashScreenConcepts();
    expect(splashes.some(concept => concept.includes('workplace'))).toBe(true);
    const prompts = getSafeIllustrationPrompts();
    const forbidden = ['anime', 'solo leveling', 'copyrighted', 'company logo'];
    expect(prompts.every(prompt => forbidden.every(word => !prompt.toLowerCase().includes(word)))).toBe(true);
  });

  it('defines polished mobile design tokens and component specs', () => {
    const tokens = getPolishedDesignTokens();
    expect(tokens.radius.pill).toBe(9999);
    expect(tokens.colors.background).toBe('#F3F6F5');
    expect(tokens.touchTarget.minimum).toBeGreaterThanOrEqual(44);
    const spec = getComponentPolishSpec('LessonHeroCard');
    expect(spec.borderRadius).toBeGreaterThanOrEqual(24);
    expect(spec.mobileRule).toContain('single column');
  });

  it('builds a small-screen QA matrix for the main flows', () => {
    const matrix = buildSmallScreenQaMatrix();
    expect(matrix.devices.map(device => device.name)).toContain('Small Android 360x640');
    expect(matrix.screens).toEqual(expect.arrayContaining(['Home', 'Onboarding', 'Survival', 'Quiz', 'Progress']));
    expect(matrix.checks).toContain('no horizontal scrolling');
  });

  it('creates a controlled dependency remediation plan without applying fixes', () => {
    const plan = buildDependencyRemediationPlan({ moderate: 10, high: 0, critical: 0 });
    expect(plan.status).toBe('plan-only');
    expect(plan.allowedActions).toContain('inspect npm audit report');
    expect(plan.forbiddenActions).toContain('run npm audit fix --force without approval');
    expect(plan.requiresApproval).toBe(true);
  });
});
