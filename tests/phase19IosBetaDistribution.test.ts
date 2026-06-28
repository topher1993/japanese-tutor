import { describe, expect, it } from 'vitest';

import {
  buildIosBetaDistributionPlan,
  classifyExpoAccessUrl,
} from '../src/services/broaderBetaTrialService';

describe('Phase 19 iOS beta distribution', () => {
  it('classifies Expo links so stale or LAN-only URLs are not treated as stable iOS beta access', () => {
    expect(classifyExpoAccessUrl('exp://192.168.10.109:8081')).toMatchObject({
      kind: 'lan',
      stableForRemoteIos: false,
    });
    expect(classifyExpoAccessUrl('exp://example-anonymous-8081.exp.direct')).toMatchObject({
      kind: 'tunnel',
      stableForRemoteIos: false,
    });
    expect(classifyExpoAccessUrl('')).toMatchObject({
      kind: 'missing',
      stableForRemoteIos: false,
    });
  });

  it('recommends TestFlight as the stable iOS beta path while keeping Expo tunnel as temporary QA only', () => {
    const plan = buildIosBetaDistributionPlan({
      expoUrl: 'exp://old-anonymous-8081.exp.direct',
      appleDeveloperAccountReady: false,
      easConfigured: false,
    });

    expect(plan.primaryRecommendation).toBe('prepare-testflight-beta');
    expect(plan.temporaryAccess).toBe('expo-tunnel-for-short-qa-only');
    expect(plan.blockers).toContain('Apple Developer Program access is required for TestFlight distribution.');
    expect(plan.blockers).toContain('EAS project/build configuration is required before submitting an iOS beta build.');
    expect(plan.testerMessage).toContain('Do not rely on old Expo links for iOS testing');
    expect(plan.testFlightSteps.length).toBeGreaterThanOrEqual(5);
  });
});
