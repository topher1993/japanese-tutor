import { describe, expect, it } from 'vitest';

import {
  buildBroaderBetaTrialPlan,
  betaTrialDailyChecklist,
  evaluateBroaderBetaExitReadiness,
} from '../src/services/broaderBetaTrialService';

describe('Phase 15B broader beta trial', () => {
  it('builds a limited broader beta plan with cohort, schedule, and feedback requirements', () => {
    const plan = buildBroaderBetaTrialPlan({
      trialName: 'Broader Beta Trial 1',
      maxTesters: 5,
      days: 3,
      expoUrl: 'exp://192.168.10.109:8081',
      requiredSdk: 54,
    });

    expect(plan.verdict).toBe('ready-for-limited-broader-beta');
    expect(plan.maxTesters).toBe(5);
    expect(plan.durationDays).toBe(3);
    expect(plan.expoGo).toMatchObject({
      url: 'exp://192.168.10.109:8081',
      requiredSdk: 54,
      accessKind: 'lan',
      stableForRemoteIos: false,
    });
    expect(plan.cohorts).toEqual(['Chris control device', '1-2 close testers', '2-3 additional learners/helpers']);
    expect(plan.requiredScreens).toEqual(['Onboarding', 'Home', 'Lessons', 'Flashcards', 'Workplace Survival', 'Quiz', 'Progress', 'Beta Feedback']);
    expect(plan.exitCriteria).toContain('0 unresolved blockers');
    expect(plan.exitCriteria).toContain('No more than 2 unresolved important issues');
    expect(plan.feedbackInstructions).toContain('Every tester must save at least one local Beta Feedback entry or send one screenshot/note.');
  });

  it('defines a daily tester checklist for the beta trial', () => {
    expect(betaTrialDailyChecklist).toEqual([
      'Open app in the current beta distribution channel',
      'Complete or review onboarding',
      'Study one lesson or survival phrase set',
      'Try one quiz interaction',
      'Check Progress/Stats',
      'Save one simple Beta Feedback note',
      'Send screenshot for any blocker or important issue',
    ]);
  });

  it('evaluates beta exit readiness from blocker and important issue counts', () => {
    expect(evaluateBroaderBetaExitReadiness({ blockers: 1, important: 0, totalFeedback: 5 })).toBe('NO-GO: resolve blockers before expansion');
    expect(evaluateBroaderBetaExitReadiness({ blockers: 0, important: 3, totalFeedback: 6 })).toBe('HOLD: run another polish sprint for important issues');
    expect(evaluateBroaderBetaExitReadiness({ blockers: 0, important: 1, totalFeedback: 0 })).toBe('HOLD: collect feedback from broader testers first');
    expect(evaluateBroaderBetaExitReadiness({ blockers: 0, important: 1, totalFeedback: 5 })).toBe('GO: broader beta can continue');
  });
});
