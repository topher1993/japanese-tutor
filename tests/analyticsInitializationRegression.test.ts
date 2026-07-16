import { afterEach, describe, expect, it, vi } from 'vitest';

import { shouldTrackInitialTab } from '../src/services/analyticsService';

const originalNodeEnv = process.env.NODE_ENV;
const originalVitest = process.env.VITEST;
const originalWorkerId = process.env.VITEST_WORKER_ID;
const originalAnalyticsKey = process.env.EXPO_PUBLIC_ANALYTICS_KEY;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv('NODE_ENV', originalNodeEnv);
  restoreEnv('VITEST', originalVitest);
  restoreEnv('VITEST_WORKER_ID', originalWorkerId);
  restoreEnv('EXPO_PUBLIC_ANALYTICS_KEY', originalAnalyticsKey);
  vi.doUnmock('../src/services/analyticsBackend');
  vi.doUnmock('posthog-react-native');
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('analytics initialization regressions', () => {
  it('does not classify Splash or onboarding as an initial tab visit', () => {
    const ready = {
      profileReady: true,
      navigationReady: true,
      onboarded: true,
      alreadyTracked: false,
    };

    expect(shouldTrackInitialTab(ready)).toBe(true);
    expect(shouldTrackInitialTab({ ...ready, profileReady: false })).toBe(false);
    expect(shouldTrackInitialTab({ ...ready, navigationReady: false })).toBe(false);
    expect(shouldTrackInitialTab({ ...ready, onboarded: false })).toBe(false);
    expect(shouldTrackInitialTab({ ...ready, alreadyTracked: true })).toBe(false);
  });

  it('flushes boot events once and does not replay live-delivered history', async () => {
    restoreEnv('NODE_ENV', undefined);
    restoreEnv('VITEST', undefined);
    restoreEnv('VITEST_WORKER_ID', undefined);
    process.env.EXPO_PUBLIC_ANALYTICS_KEY = 'phc_test';
    const sendToBackend = vi.fn(async () => undefined);
    vi.doMock('../src/services/analyticsBackend', () => ({ sendToBackend }));
    vi.resetModules();
    const analytics = await import('../src/services/analyticsService');

    analytics.track('onboarding_step_viewed', { step: 'welcome' });
    await analytics.initializeAnalyticsContext({
      async getItem() { return 'stable-install-id'; },
      async setItem() {},
    });

    analytics.flushQueuedAnalytics();
    analytics.flushQueuedAnalytics();
    expect(sendToBackend).toHaveBeenCalledTimes(1);
    expect(sendToBackend).toHaveBeenLastCalledWith(
      'onboarding_step_viewed',
      expect.objectContaining({ install_id: 'stable-install-id', app_version: '1.1.0' }),
    );

    analytics.track('tab_visited', { tab: 'Home' });
    expect(sendToBackend).toHaveBeenCalledTimes(2);
    analytics.flushQueuedAnalytics();
    expect(sendToBackend).toHaveBeenCalledTimes(2);
  });

  it('scrubs development-console payloads at the analytics chokepoint', async () => {
    restoreEnv('NODE_ENV', undefined);
    restoreEnv('VITEST', undefined);
    restoreEnv('VITEST_WORKER_ID', undefined);
    delete process.env.EXPO_PUBLIC_ANALYTICS_KEY;
    vi.resetModules();
    const analytics = await import('../src/services/analyticsService');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    analytics.track('error_caught', {
      message: 'Contact learner@example.com or 5551234567',
    });

    expect(log).toHaveBeenCalledWith('[analytics] error_caught', {
      message: 'Contact [email] or [number]',
    });
  });

  it('identifies an existing PostHog client when durable identity arrives later', async () => {
    process.env.EXPO_PUBLIC_ANALYTICS_KEY = 'phc_test';
    const construct = vi.fn();
    const capture = vi.fn();
    const identify = vi.fn();
    class MockPostHog {
      constructor(apiKey: string, options?: Record<string, unknown>) {
        construct(apiKey, options);
      }

      capture(event: string, props?: Record<string, unknown>): void {
        capture(event, props);
      }

      identify(distinctId: string, properties?: Record<string, unknown>): void {
        identify(distinctId, properties);
      }
    }
    vi.doMock('posthog-react-native', () => ({ default: MockPostHog }));
    vi.resetModules();
    const backend = await import('../src/services/analyticsBackend');

    await expect(backend.initBackend()).resolves.toBe(true);
    await expect(backend.initBackend({ installId: 'stable-install-id' })).resolves.toBe(true);

    expect(construct).toHaveBeenCalledTimes(1);
    expect(identify).toHaveBeenCalledWith(
      'stable-install-id',
      { install_id: 'stable-install-id' },
    );
  });
});
