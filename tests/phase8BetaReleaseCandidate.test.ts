import { describe, expect, it } from 'vitest';
import {
  buildBetaFeedbackPrompts,
  buildPhase8DeviceQaChecklist,
  buildReleaseCandidateSummary,
  evaluateInternalBetaReadiness,
} from '../src/services/betaReleaseCandidateService';
import { createLocalBetaFeedbackStore, summarizeBetaFeedback } from '../src/services/betaFeedbackService';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('Phase 8 real-device beta QA and release candidate', () => {
  it('builds a device QA checklist covering web viewports and real-device targets', () => {
    const checklist = buildPhase8DeviceQaChecklist();

    expect(checklist.title).toContain('Phase 8');
    expect(checklist.devices.map(device => device.name)).toEqual(expect.arrayContaining([
      'Small Android 360x640',
      'Standard Mobile 390x844',
      'Large Mobile 430x932',
      'Expo Go Android Device',
      'iPhone Simulator or Physical iPhone',
    ]));
    expect(checklist.screens).toEqual(expect.arrayContaining(['Onboarding', 'Home', 'Lessons', 'Flashcards', 'Workplace Survival', 'Quiz', 'Progress', 'Beta Feedback']));
    expect(checklist.requiredEvidence).toContain('actual Expo Go or simulator device tested: yes/no');
  });

  it('blocks internal beta when real-device QA has not been completed', () => {
    const decision = evaluateInternalBetaReadiness({
      webScreenshotQaPassed: true,
      realDeviceQaPassed: false,
      dependencySummary: { moderate: 10, high: 0, critical: 0, total: 10 },
      blockingDefects: [],
    });

    expect(decision.verdict).toBe('NO-GO: DEVICE QA REQUIRED');
    expect(decision.blockers).toContain('real-device Expo Go or simulator QA is still required');
    expect(decision.warnings).toContain('10 moderate dependency audit findings remain documented');
  });

  it('allows internal beta only when device QA passes and no blocking defects exist', () => {
    const decision = evaluateInternalBetaReadiness({
      webScreenshotQaPassed: true,
      realDeviceQaPassed: true,
      dependencySummary: { moderate: 10, high: 0, critical: 0, total: 10 },
      blockingDefects: [],
    });

    expect(decision.verdict).toBe('GO FOR INTERNAL BETA');
    expect(decision.blockers).toEqual([]);
    expect(decision.warnings).toContain('10 moderate dependency audit findings remain documented');
  });

  it('builds beta feedback prompts and summarizes local tester feedback', () => {
    const prompts = buildBetaFeedbackPrompts();
    expect(prompts).toContain('Can you understand what the app is for within 10 seconds?');
    expect(prompts).toContain('What workplace phrase do you need that is missing?');

    const store = createLocalBetaFeedbackStore(memoryStorage());
    store.add({ screen: 'Workplace Survival', rating: 4, note: 'Useful safety phrases', createdAt: '2026-06-18' });
    store.add({ screen: 'Quiz', rating: 3, note: 'Need clearer answer feedback', createdAt: '2026-06-18' });

    const summary = summarizeBetaFeedback(store.list());
    expect(summary.count).toBe(2);
    expect(summary.averageRating).toBe(3.5);
    expect(summary.screensNeedingReview).toContain('Quiz');
  });

  it('builds a release candidate summary with blockers and warnings separated', () => {
    const summary = buildReleaseCandidateSummary({
      validationPassed: true,
      webScreenshotQaPassed: true,
      realDeviceQaPassed: false,
      dependencySummary: { moderate: 10, high: 0, critical: 0, total: 10 },
      blockingDefects: [],
    });

    expect(summary.phase).toBe('Phase 8');
    expect(summary.verdict).toBe('NO-GO: DEVICE QA REQUIRED');
    expect(summary.blockers).toContain('real-device Expo Go or simulator QA is still required');
    expect(summary.warnings).toContain('10 moderate dependency audit findings remain documented');
    expect(summary.validationEvidence).toEqual(expect.arrayContaining(['typecheck', 'tests', 'expo web export', 'phase 8 screenshots']));
  });
});
