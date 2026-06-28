export interface InternalBetaLaunchInput {
  lanIp: string;
  port: number;
  sdk: number;
}

export interface ExpoGoRunDetails {
  url: string;
  requiredSdk: number;
  preflight: string[];
}

export interface InternalBetaLaunchPackage {
  verdict: 'ready-for-internal-beta-testers';
  title: string;
  expoGo: ExpoGoRunDetails;
  testerInstructions: string[];
  knownIssues: string[];
  releaseNotes: string[];
  testFocus: string[];
}

export interface TesterFeedbackWorkflow {
  storageMode: 'local-only';
  steps: string[];
  limitations: string[];
  escalation: string[];
}

export function buildTesterFeedbackWorkflow(): TesterFeedbackWorkflow {
  return {
    storageMode: 'local-only',
    steps: [
      'Open Progress.',
      'Tap Open beta feedback.',
      'Choose the simple feedback type that matches what happened.',
      'Choose the screen being reviewed.',
      'Optionally select rating 1-5.',
      'Write a short note if useful.',
      'Tap Save local feedback.',
    ],
    limitations: [
      'Feedback stays on the tester device unless the tester shares notes or screenshots.',
      'There is no backend sync, account system, or remote analytics in this beta pack.',
    ],
    escalation: [
      'Send blocking crashes immediately with a screenshot and what action caused it.',
      'Send confusing Japanese, translation issues, or missing phrases as content feedback.',
      'Send minor layout issues as polish feedback unless they block app use.',
    ],
  };
}

export function buildInternalBetaLaunchPackage(input: InternalBetaLaunchInput): InternalBetaLaunchPackage {
  return {
    verdict: 'ready-for-internal-beta-testers',
    title: 'Japanese Tutor Mobile App — Internal Beta Pack 1',
    expoGo: {
      url: `exp://${input.lanIp}:${input.port}`,
      requiredSdk: input.sdk,
      preflight: [
        `Expo Go must support SDK ${input.sdk}.`,
        'Phone must be on the same Wi-Fi network as the development PC.',
        'If the app shows an old error, fully close Expo Go and remove the old recent project entry.',
      ],
    },
    testerInstructions: [
      `Install or open Expo Go with SDK ${input.sdk} support.`,
      `Open exp://${input.lanIp}:${input.port}.`,
      'Complete onboarding or verify onboarding is already complete.',
      'Use the app for one short N5 workplace survival study session.',
      'Try Home, Lessons, Cards, Work, Quiz, Stats, and Beta Feedback.',
      'Submit feedback through the local Beta Feedback screen and send notes/screenshots to Chris or Belion.',
    ],
    knownIssues: [
      'Minor UI polish issues were observed during device QA and are deferred as non-blocking.',
      'Feedback is local-only and does not automatically sync to a backend.',
      'Vietnamese and Filipino support text should be refined with beta learner feedback.',
      'This is Week 1 N5 workplace survival content, not the complete N5-to-N2 curriculum.',
    ],
    releaseNotes: [
      'Internal Beta Pack 1 — N5 Workplace Survival',
      'Includes five Week 1 N5 workplace lessons.',
      'Includes eighteen workplace survival phrases across greetings, help, safety, schedule, tools, breaks, absence, and emergency categories.',
      'Includes a workplace greetings quiz.',
      'Includes local-only beta feedback collection through the Progress screen.',
      'Runs on Expo SDK 54 for Chris\'s current Expo Go client.',
    ],
    testFocus: ['onboarding', 'lessons', 'workplace survival', 'quiz', 'progress', 'beta feedback'],
  };
}
