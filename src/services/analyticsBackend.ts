/**
 * Phase 44.3 — Analytics backend wiring (PostHog).
 *
 * This module owns the ONLY contact surface with posthog-react-native.
 * Everything else in the app talks to `track()` in analyticsService.ts;
 * `track()` in turn calls `sendToBackend()` from THIS module. Tests can
 * override `sendToBackend` via vi.mock without touching posthog.
 *
 * Why a wrapper:
 *   1. **Testability** — posthog-react-native instantiates a singleton
 *      class on import. Mocking the whole module via vi.mock works but
 *      couples tests to the SDK's surface. A named export we own is
 *      much cleaner (the injectable-dispatcher pattern).
 *   2. **Backend portability** — if we ever swap PostHog for Amplitude,
 *      Firebase, or self-hosted, only this file changes. Call sites
 *      stay byte-identical.
 *   3. **Privacy centralisation** — every event passes through
 *      scrubPii() in analyticsService.ts BEFORE reaching this module,
 *      so the SDK can never see raw PII.
 *
 * PostHog API (v4.54.4):
 *   - `new PostHog(apiKey, options?)` — instantiates the SDK client
 *   - `client.capture(event, props)` — fires an event
 *   - The class is the default export of 'posthog-react-native'.
 */

// Keep the wrapper surface narrow because posthog-react-native's types
// bring in heavy transitive dependencies (PostHogProvider, JSX, etc.)
// that conflict with this project's tsconfig. The runtime contract
// is what matters; this module only needs capture() and identify().
type PostHogClient = {
  capture: (event: string, props?: Record<string, unknown>) => void;
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
};
type PostHogClass = new (apiKey: string, options?: Record<string, unknown>) => PostHogClient;

import type { AnalyticsEvent } from './analyticsService';

let client: PostHogClient | null = null;

/**
 * Initialize the PostHog SDK. Idempotent — safe to call multiple times.
 *
 * `host` defaults to PostHog's US cloud. Set `EXPO_PUBLIC_POSTHOG_HOST`
 * to point at self-hosted or EU cloud.
 */
export async function initBackend(opts?: { host?: string; installId?: string }): Promise<boolean> {
  // A caller may initialize the SDK before durable identity hydration has
  // finished. A later call with installId must still bind the existing client
  // instead of returning early and leaving PostHog's anonymous id in place.
  if (client) {
    try {
      if (opts?.installId) client.identify(opts.installId, { install_id: opts.installId });
    } catch (err) {
      if (__DEV__) console.warn('[analyticsBackend] identify failed', err);
      return false;
    }
    return true;
  }
  const apiKey = process.env.EXPO_PUBLIC_ANALYTICS_KEY;
  if (!apiKey || apiKey.length === 0) return false;
  const host = opts?.host || process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
  try {
    const mod = await import('posthog-react-native');
    const PostHogCtor = mod.default as unknown as PostHogClass;
    client = new PostHogCtor(apiKey, {
      host,
      // Disable session recording (extra cost, not useful for our use case).
      enableSessionReplay: false,
    });
    if (opts?.installId) client.identify(opts.installId, { install_id: opts.installId });
    return true;
  } catch (err) {
    // Phase 41: production log guard — keep __DEV__ on the same line as console.warn
    // so the test at tests/phase41ProductionLogGuard.test.ts accepts it.
    if (__DEV__) console.warn('[analyticsBackend] PostHog init failed; queue-only mode', err);
    return false;
  }
}

/**
 * Send an event to the configured backend. The default implementation
 * calls posthog-react-native; tests override this export.
 *
 * Contract:
 *   - MUST be safe to call when the backend is uninitialized (returns
 *     silently — does NOT throw).
 *   - MUST NOT block the caller (fire-and-forget).
 *   - MUST NEVER throw — failures degrade silently so analytics
 *     never breaks the user-facing app.
 */
export async function sendToBackend(
  event: AnalyticsEvent,
  props: Record<string, unknown>,
): Promise<void> {
  if (!client) return;
  try {
    client.capture(event, props);
  } catch (err) {
    if (__DEV__) console.warn('[analyticsBackend] capture failed', event, err);
  }
}

/**
 * Test-only: drop the client reference so the next initBackend() call
 * re-runs the SDK init. Production code never calls this.
 */
export function __resetBackendForTests(): void {
  client = null;
}
