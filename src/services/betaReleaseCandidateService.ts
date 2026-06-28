export interface DeviceQaTarget {
  name: string;
  type: 'web-viewport' | 'real-device' | 'simulator';
  requiredForBeta: boolean;
}

export interface Phase8DeviceQaChecklist {
  title: string;
  devices: DeviceQaTarget[];
  screens: string[];
  checks: string[];
  requiredEvidence: string[];
}

export interface DependencySummary {
  moderate: number;
  high: number;
  critical: number;
  total: number;
}

export interface BetaReadinessInput {
  webScreenshotQaPassed: boolean;
  realDeviceQaPassed: boolean;
  dependencySummary: DependencySummary;
  blockingDefects: string[];
}

export interface BetaReadinessDecision {
  verdict: 'GO FOR INTERNAL BETA' | 'NO-GO: DEVICE QA REQUIRED' | 'NO-GO: BLOCKING DEFECTS';
  blockers: string[];
  warnings: string[];
}

export interface ReleaseCandidateInput extends BetaReadinessInput {
  validationPassed: boolean;
}

export interface ReleaseCandidateSummary extends BetaReadinessDecision {
  phase: 'Phase 8';
  validationEvidence: string[];
}

export function buildPhase8DeviceQaChecklist(): Phase8DeviceQaChecklist {
  return {
    title: 'Phase 8 Real-Device Beta QA Checklist',
    devices: [
      { name: 'Small Android 360x640', type: 'web-viewport', requiredForBeta: false },
      { name: 'Standard Mobile 390x844', type: 'web-viewport', requiredForBeta: false },
      { name: 'Large Mobile 430x932', type: 'web-viewport', requiredForBeta: false },
      { name: 'Expo Go Android Device', type: 'real-device', requiredForBeta: true },
      { name: 'iPhone Simulator or Physical iPhone', type: 'simulator', requiredForBeta: true },
    ],
    screens: ['Onboarding', 'Home', 'Lessons', 'Flashcards', 'Workplace Survival', 'Quiz', 'Progress', 'Beta Feedback'],
    checks: [
      'no horizontal scrolling',
      'bottom navigation is readable and tappable',
      'Japanese text is legible',
      'workplace phrases are easy to find',
      'onboarding completion persists after reload',
      'feedback screen is local-only and does not submit network data',
    ],
    requiredEvidence: [
      'actual Expo Go or simulator device tested: yes/no',
      'tester device model or simulator profile',
      'pass/fail notes for each main screen',
      'screenshots or manual observations',
    ],
  };
}

export function buildBetaFeedbackPrompts(): string[] {
  return [
    'Can you understand what the app is for within 10 seconds?',
    'Is the onboarding language choice clear?',
    'Are workplace phrases easy to find?',
    'Is Japanese text readable?',
    'Is the bottom navigation easy to tap?',
    'Which screen feels most useful?',
    'Which screen feels confusing?',
    'What workplace phrase do you need that is missing?',
  ];
}

function dependencyWarnings(summary: DependencySummary): string[] {
  return summary.moderate > 0 ? [`${summary.moderate} moderate dependency audit findings remain documented`] : [];
}

export function evaluateInternalBetaReadiness(input: BetaReadinessInput): BetaReadinessDecision {
  const blockers = [...input.blockingDefects];
  const warnings = dependencyWarnings(input.dependencySummary);

  if (input.dependencySummary.high > 0 || input.dependencySummary.critical > 0) {
    blockers.push('high or critical dependency audit findings must be resolved');
  }
  if (!input.webScreenshotQaPassed) {
    blockers.push('web/mobile screenshot QA must pass');
  }
  if (!input.realDeviceQaPassed) {
    blockers.push('real-device Expo Go or simulator QA is still required');
  }

  if (blockers.some(blocker => blocker.includes('real-device'))) {
    return { verdict: 'NO-GO: DEVICE QA REQUIRED', blockers, warnings };
  }
  if (blockers.length > 0) {
    return { verdict: 'NO-GO: BLOCKING DEFECTS', blockers, warnings };
  }
  return { verdict: 'GO FOR INTERNAL BETA', blockers, warnings };
}

export function buildReleaseCandidateSummary(input: ReleaseCandidateInput): ReleaseCandidateSummary {
  const base = evaluateInternalBetaReadiness({
    webScreenshotQaPassed: input.webScreenshotQaPassed,
    realDeviceQaPassed: input.realDeviceQaPassed,
    dependencySummary: input.dependencySummary,
    blockingDefects: input.validationPassed ? input.blockingDefects : [...input.blockingDefects, 'validation gate failed'],
  });
  return {
    phase: 'Phase 8',
    ...base,
    validationEvidence: ['typecheck', 'tests', 'expo web export', 'phase 8 screenshots'],
  };
}
