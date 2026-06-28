import { describe, expect, it } from 'vitest';
import { buildInternalBetaLaunchPackage, buildTesterFeedbackWorkflow } from '../src/services/internalBetaLaunchService';

describe('Phase 11 internal beta launch package', () => {
  it('packages tester instructions, known issues, release notes, and Expo Go run details', () => {
    const launch = buildInternalBetaLaunchPackage({ lanIp: '192.168.10.109', port: 8081, sdk: 54 });

    expect(launch.verdict).toBe('ready-for-internal-beta-testers');
    expect(launch.expoGo.url).toBe('exp://192.168.10.109:8081');
    expect(launch.expoGo.requiredSdk).toBe(54);
    expect(launch.testerInstructions).toEqual(expect.arrayContaining([
      'Install or open Expo Go with SDK 54 support.',
      'Use the app for one short N5 workplace survival study session.',
      'Submit feedback through the local Beta Feedback screen and send notes/screenshots to Chris or Belion.',
    ]));
    expect(launch.knownIssues).toContain('Minor UI polish issues were observed during device QA and are deferred as non-blocking.');
    expect(launch.releaseNotes).toContain('Internal Beta Pack 1 — N5 Workplace Survival');
    expect(launch.testFocus).toEqual(expect.arrayContaining(['onboarding', 'lessons', 'workplace survival', 'quiz', 'progress', 'beta feedback']));
  });

  it('defines a local-only feedback workflow with no backend claims', () => {
    const workflow = buildTesterFeedbackWorkflow();

    expect(workflow.storageMode).toBe('local-only');
    expect(workflow.steps).toEqual(expect.arrayContaining([
      'Open Progress.',
      'Tap Open beta feedback.',
      'Choose the simple feedback type that matches what happened.',
      'Choose the screen being reviewed.',
      'Optionally select rating 1-5.',
      'Write a short note if useful.',
      'Tap Save local feedback.',
    ]));
    expect(workflow.limitations).toContain('Feedback stays on the tester device unless the tester shares notes or screenshots.');
  });
});
