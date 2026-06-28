export interface BroaderBetaTrialInput {
  trialName: string;
  maxTesters: number;
  days: number;
  expoUrl: string;
  requiredSdk: number;
}

export type ExpoAccessKind = 'missing' | 'lan' | 'tunnel' | 'unknown';

export interface ExpoAccessClassification {
  kind: ExpoAccessKind;
  stableForRemoteIos: boolean;
  note: string;
}

export interface IosBetaDistributionPlanInput {
  expoUrl: string;
  appleDeveloperAccountReady: boolean;
  easConfigured: boolean;
}

export interface IosBetaDistributionPlan {
  primaryRecommendation: 'prepare-testflight-beta';
  temporaryAccess: 'expo-tunnel-for-short-qa-only';
  expoAccess: ExpoAccessClassification;
  blockers: string[];
  testFlightSteps: string[];
  testerMessage: string;
}

export interface BroaderBetaTrialPlan {
  verdict: 'ready-for-limited-broader-beta';
  trialName: string;
  maxTesters: number;
  durationDays: number;
  expoGo: { url: string; requiredSdk: number; accessKind: ExpoAccessKind; stableForRemoteIos: boolean };
  cohorts: string[];
  requiredScreens: string[];
  feedbackInstructions: string[];
  exitCriteria: string[];
}

export const betaTrialDailyChecklist = [
  'Open app in the current beta distribution channel',
  'Complete or review onboarding',
  'Study one lesson or survival phrase set',
  'Try one quiz interaction',
  'Check Progress/Stats',
  'Save one simple Beta Feedback note',
  'Send screenshot for any blocker or important issue',
] as const;

export function classifyExpoAccessUrl(expoUrl: string): ExpoAccessClassification {
  if (!expoUrl.trim()) {
    return {
      kind: 'missing',
      stableForRemoteIos: false,
      note: 'No Expo access URL is currently published.',
    };
  }

  if (/^exp:\/\/((\d{1,3}\.){3}\d{1,3}|localhost|127\.0\.0\.1)(:\d+)?/.test(expoUrl)) {
    return {
      kind: 'lan',
      stableForRemoteIos: false,
      note: 'LAN Expo URLs only work on the same local network and are not reliable for iOS testers outside that network.',
    };
  }

  if (/^exp:\/\/[^/]+\.exp\.direct/.test(expoUrl)) {
    return {
      kind: 'tunnel',
      stableForRemoteIos: false,
      note: 'Expo tunnel URLs are useful for short QA sessions but can change after restarts and should not be treated as stable iOS beta distribution.',
    };
  }

  return {
    kind: 'unknown',
    stableForRemoteIos: false,
    note: 'Unknown Expo URL format; do not treat it as stable iOS beta distribution without verification.',
  };
}

export function buildIosBetaDistributionPlan(input: IosBetaDistributionPlanInput): IosBetaDistributionPlan {
  const blockers: string[] = [];
  if (!input.appleDeveloperAccountReady) blockers.push('Apple Developer Program access is required for TestFlight distribution.');
  if (!input.easConfigured) blockers.push('EAS project/build configuration is required before submitting an iOS beta build.');

  return {
    primaryRecommendation: 'prepare-testflight-beta',
    temporaryAccess: 'expo-tunnel-for-short-qa-only',
    expoAccess: classifyExpoAccessUrl(input.expoUrl),
    blockers,
    testFlightSteps: [
      'Confirm Apple Developer Program access and App Store Connect permissions.',
      'Configure EAS project identity, bundle identifier, app icon, build number, and credentials.',
      'Run full TypeScript, test, Expo export, Expo install, and Expo Doctor gates before native build.',
      'Create an iOS preview/production build with EAS Build.',
      'Submit the iOS build to App Store Connect with EAS Submit or Transporter.',
      'Create a TestFlight tester group and invite the first limited beta testers.',
      'Keep Expo tunnel only as temporary engineering QA while TestFlight is being prepared.',
    ],
    testerMessage: 'Do not rely on old Expo links for iOS testing. Use Expo tunnel only during a live QA session; use TestFlight for stable iOS beta access once the build is submitted.',
  };
}

export function buildBroaderBetaTrialPlan(input: BroaderBetaTrialInput): BroaderBetaTrialPlan {
  const expoAccess = classifyExpoAccessUrl(input.expoUrl);
  return {
    verdict: 'ready-for-limited-broader-beta',
    trialName: input.trialName,
    maxTesters: input.maxTesters,
    durationDays: input.days,
    expoGo: {
      url: input.expoUrl,
      requiredSdk: input.requiredSdk,
      accessKind: expoAccess.kind,
      stableForRemoteIos: expoAccess.stableForRemoteIos,
    },
    cohorts: ['Chris control device', '1-2 close testers', '2-3 additional learners/helpers'],
    requiredScreens: ['Onboarding', 'Home', 'Lessons', 'Flashcards', 'Workplace Survival', 'Quiz', 'Progress', 'Beta Feedback'],
    feedbackInstructions: [
      'Every tester must save at least one local Beta Feedback entry or send one screenshot/note.',
      'Use the simple feedback choices first: problem, confusing, translation/Japanese issue, or suggestion.',
      'Developer testers may open advanced details if they need to override severity or category.',
      'Send screenshots immediately for blocker or important device-layout issues.',
    ],
    exitCriteria: [
      '0 unresolved blockers',
      'No more than 2 unresolved important issues',
      'At least 3 testers complete one study session',
      'Every required screen has been opened by at least one tester',
      'No SDK compatibility errors on tester devices',
    ],
  };
}

export function evaluateBroaderBetaExitReadiness(input: { blockers: number; important: number; totalFeedback: number }): string {
  if (input.blockers > 0) return 'NO-GO: resolve blockers before expansion';
  if (input.important > 2) return 'HOLD: run another polish sprint for important issues';
  if (input.totalFeedback === 0) return 'HOLD: collect feedback from broader testers first';
  return 'GO: broader beta can continue';
}
