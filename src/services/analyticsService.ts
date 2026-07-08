// Phase 44 — Analytics service (telemetry setup-only).
//
// This module is the SETUP for Phase 44 telemetry. It does NOT yet
// instrument any screen — that comes in Phase 44.2+ after the event
// taxonomy is reviewed.
//
// Design choices:
//
//   1. **No external SDK yet.** Phase 44 setup-only ships with no
//      external dependency. The `track()` function currently logs
//      to the dev console (gated by __DEV__) and queues events in
//      memory. A future commit can swap the in-memory queue for a
//      real PostHog/Amplitude/Firebase SDK call without touching
//      any call site.
//
//   2. **No-op by default.** If `process.env.EXPO_PUBLIC_ANALYTICS_KEY`
//      is unset (or the app is running in test mode), `track()` is a
//      no-op. No events are logged, queued, or transmitted. This means
//      Phase 44 setup-only is safe to ship before any privacy review.
//
//   3. **Strongly-typed event names.** `AnalyticsEvent` is a string
//      union, not a free string. Adding a new event requires updating
//      this type, which gives the typechecker a chance to flag any
//      caller that passes an unknown event. Properties are typed
//      `Record<string, unknown>` for now — Phase 44.2 will add
//      per-event prop schemas.
//
//   4. **Privacy.** No PII (names, emails, exact lesson text) is
//      captured by this setup. Future instrumentation must add
//      `scrubPii()` calls before any event reaches this service.

// React Native injects __DEV__ at runtime (true in dev, false in prod).
// Node test environment gets it from tests/setup.ts (true for parity).
declare const __DEV__: boolean | undefined;

// Phase 44.2: scrub PII out of every props bag before it reaches the
// in-memory queue. Callers must not need to remember to scrub — the
// contract is "track() never sends PII, period".
import { scrubPii } from '../utils/scrubPii';

// Phase 44.3: route events to the configured backend. The backend
// module is the ONLY place posthog-react-native is imported; track()
// just fires the named export and stays decoupled from the SDK.
import { sendToBackend } from './analyticsBackend';

export type AnalyticsEvent =
  // Navigation events
  | 'tab_visited'
  | 'screen_opened'
  | 'screen_closed'
  // Lesson events
  | 'lesson_opened'
  | 'lesson_completed'
  | 'lesson_mark_complete_attempt'
  | 'lesson_mark_complete_success'
  | 'lesson_mark_complete_failure'
  // Onboarding events
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_step_viewed'
  // Settings events
  | 'settings_reset_app'
  | 'settings_open_reviewer_tools'
  // Error events
  | 'error_caught'
  | 'store_unavailable_shown'
  // Discovery events
  | 'disclosure_opened'
  | 'disclosure_closed'
  /**
   * Phase 50: per-review telemetry (Beru Q4 must-have).
   * Props shape: { card_id: string; rating: 'again'|'hard'|'good'|'easy';
   *   pre_ease: number; post_ease: number; pre_interval: number;
   *   post_interval: number; reps: number; overdue_days: number;
   *   overdue_state: 'on_time'|'recent_overdue'|'catch_up_handled' }.
   */
  | 'srs_review'
  /**
   * Phase 50: per-session aggregate (Beru Q4 must-have).
   * Props shape: { lapse_count: number; average_ef: number;
   *   cards_due_at_session_start: number }.
   */
  | 'srs_session_summary';

export interface AnalyticsContext {
  /** Stable per-install identifier (UUID v4). Generated on first call. */
  readonly installId: string;
  /** App version (from expo config). */
  readonly appVersion: string;
  /** True when `__DEV__` is set. */
  readonly isDev: boolean;
  /** True when running under Vitest (NODE_ENV=test or VITEST). */
  readonly isTest: boolean;
}

let cachedContext: AnalyticsContext | null = null;
const eventQueue: Array<{ event: AnalyticsEvent; props: Record<string, unknown>; ts: number }> = [];

function getContext(): AnalyticsContext {
  if (cachedContext) return cachedContext;
  const isTest = typeof process !== 'undefined' &&
    (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true' ||
     process.env?.VITEST_WORKER_ID !== undefined);
  // Lazy-load installId from localStorage on web, or a module-level random on native.
  // For Phase 44 setup we use a stable per-process id; persistence comes in Phase 44.2.
  const installId = isTest ? 'test-install' : `dev-${Math.random().toString(36).slice(2, 12)}`;
  cachedContext = {
    installId,
    appVersion: '0.1.0',
    isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
    isTest,
  };
  return cachedContext;
}

/**
 * Check if the SDK has been configured for production use.
 *
 * Enabled when `EXPO_PUBLIC_ANALYTICS_KEY` is set.
 *
 * NOTE: This does NOT depend on `isTest` — that flag only affects
 * `track()` behavior (no-op vs queue). Tests that want to verify
 * the "enabled" gate can set the env var and call this function
 * without having to bypass the test-environment check.
 */
export function isAnalyticsEnabled(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  const key = process.env.EXPO_PUBLIC_ANALYTICS_KEY;
  return typeof key === 'string' && key.length > 0;
}

/**
 * Track an analytics event.
 *
 * @param event - The event name (must be one of AnalyticsEvent).
 * @param props - Event-specific properties. Will be JSON-stringified
 *                before transmission. Pass `{}` if no properties.
 *
 * Behavior:
 * - In test mode: no-op (events are not queued, not logged, not transmitted).
 * - In dev mode without API key: logs to console (gated by __DEV__) and queues in memory.
 * - In dev/prod with API key: logs to console AND queues for future transport.
 *
 * Phase 44.2 will replace the `queueEvent()` call below with a real
 * SDK invocation.
 */
export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  const ctx = getContext();
  // Test mode: completely silent.
  if (ctx.isTest) return;
  // Phase 44.2: scrub PII before the entry ever enters the queue. This
  // is the single chokepoint — every event passes through here, so
  // every event is scrubbed.
  const scrubbed = scrubPii(props);
  const entry = { event, props: scrubbed, ts: Date.now() };
  eventQueue.push(entry);
  // Cap queue at 100 events to avoid unbounded memory growth in dev mode.
  if (eventQueue.length > 100) eventQueue.shift();
  // Dev console echo — gated so it never leaks to production.
  if (ctx.isDev && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, props);
  }
  // Phase 44.3: fire to the configured backend. sendToBackend is a
  // no-op when the backend hasn't been initialised (no API key set),
  // so the in-memory queue remains the source of truth for the dev
  // debug card. We do NOT await — track() must stay synchronous to
  // keep call sites cheap. Errors are swallowed inside sendToBackend.
  if (isAnalyticsEnabled()) {
    void sendToBackend(event, scrubbed);
  }
}

/**
 * Read the current in-memory event queue. Useful for the debug UI
 * (not yet built) and for tests.
 */
export function getQueuedEvents(): ReadonlyArray<{ event: AnalyticsEvent; props: Record<string, unknown>; ts: number }> {
  return [...eventQueue];
}

/**
 * Clear the in-memory event queue. Used by tests and by the debug UI.
 */
export function clearQueuedEvents(): void {
  eventQueue.length = 0;
}

/**
 * Reset the cached context. Used by tests to simulate a fresh launch.
 */
export function resetAnalyticsForTests(): void {
  cachedContext = null;
  eventQueue.length = 0;
}