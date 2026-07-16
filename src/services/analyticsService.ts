// Typed, privacy-scrubbed analytics. Events remain local when no public
// PostHog key is configured; otherwise they are delivered after durable
// per-install identity has initialized. Analytics must never block learning.

// React Native injects __DEV__ at runtime (true in dev, false in prod).
// Node test environment gets it from tests/setup.ts (true for parity).
declare const __DEV__: boolean | undefined;

// Scrub PII out of every props bag before it reaches any output. Callers must
// not need to remember to scrub; the
// contract is "track() never sends PII, period".
import { scrubPii } from '../utils/scrubPii';

// The backend module is the only place posthog-react-native is imported; track()
// just fires the named export and stays decoupled from the SDK.
import { sendToBackend } from './analyticsBackend';
import appConfig from '../../app.json';
import { getInstallId, type InstallIdStorage } from '../utils/installId';

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
  // Listening & Sentence Lab events
  | 'sentence_lab_answered'
  // Onboarding events
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_step_viewed'
  // Placement evaluation events
  | 'placement_started'
  | 'placement_completed'
  | 'placement_skipped'
  // Unofficial JLPT-style mock exam events. Never attach prompts or answers.
  | 'jlpt_exam_started'
  | 'jlpt_exam_resumed'
  | 'jlpt_exam_section_submitted'
  | 'jlpt_exam_completed'
  | 'jlpt_exam_abandoned'
  | 'jlpt_exam_audio_failed'
  // Settings events
  | 'settings_reset_app'
  | 'settings_open_reviewer_tools'
  // Error events
  | 'error_caught'
  | 'store_unavailable_shown'
  // Discovery events
  | 'disclosure_opened'
  | 'disclosure_closed'
  /** Learner opened a task recommended by Adaptive Daily Plan 2.0. */
  | 'adaptive_plan_task_opened'
  | 'mastery_focus_opened'
  // Koi Sensei events. Payloads are constructed only by the strict
  // content-free adapter in features/koi-sensei/analytics.
  | 'koi_hub_opened'
  | 'koi_feature_opened'
  | 'koi_chat_result'
  | 'koi_allowance_blocked'
  | 'koi_consent_changed'
  | 'koi_local_data_action'
  | 'koi_safety_reported'
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
  | 'srs_session_summary'
  /**
   * Phase 51: card flipped to back face with the 1.5s soft dwell
   * gate passed (Beru Q1.1). Emitted from FlashcardsScreen on
   * `mouseleave`/`blur` of the back face, not on unmount.
   * Props shape: { card_id: string; dwell_ms: number;
   *   stage_before: 'seen' | 'recognized' | 'memorized' }.
   */
  | 'card_flipped_back'
  /**
   * Phase 51: stage transition driven by a Daily Rush outcome
   * (Beru Q3). Includes both the from→to pair and the latency
   * numbers that drove the decision so telemetry can
   * verify baseline seeds against observed p50/p75.
   * Props shape: { card_id: string;
   *   from_stage: 'seen' | 'recognized' | 'memorized';
   *   to_stage: 'seen' | 'recognized' | 'memorized';
   *   answer_ms: number; baseline_ms: number }.
   */
  | 'card_stage_advanced'
  /**
   * Phase 51: long-press "didn't know it" gesture fired in
   * Flashcards or Daily Rush (Beru Q4). Maps to srs.review(q=2)
   * and resets stage to `seen`.
   * Props shape: { card_id: string;
   *   stage_before: 'seen' | 'recognized' | 'memorized';
   *   from_screen: 'flashcards' | 'daily_rush' }.
   */
  | 'card_skipped'
  /**
   * Phase 51: per-session cap reached for a single card (Beru Q6
   * Failure mode A). After 2 consecutive Daily Rush misses the
   * card is deferred to tomorrow and this event is emitted so
   * telemetry can spot stubborn-card patterns.
   * Props shape: { card_id: string; attempts_in_session: number;
   *   defer_to_next_session: boolean }.
   */
  | 'card_session_capped'
  | 'japanese_audio_played'
  | 'japanese_shadowing_attempt';

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
type AnalyticsQueueEntry = { event: AnalyticsEvent; props: Record<string, unknown>; ts: number };

// `eventQueue` is the bounded debug history exposed by getQueuedEvents().
// `pendingQueue` contains only events that have not yet been handed to the
// backend. Keeping those concerns separate makes boot flushing idempotent:
// previously every flush replayed the entire debug history, including events
// that track() had already sent live.
const eventQueue: AnalyticsQueueEntry[] = [];
const pendingQueue: AnalyticsQueueEntry[] = [];
let backendDeliveryReady = false;

function runtimeFlags(): Pick<AnalyticsContext, 'isDev' | 'isTest'> {
  const isTest = typeof process !== 'undefined' &&
    (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true' ||
     process.env?.VITEST_WORKER_ID !== undefined);
  return {
    isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
    isTest,
  };
}

/** Initialize stable analytics identity from the app's shared durable store. */
export async function initializeAnalyticsContext(storage: InstallIdStorage): Promise<AnalyticsContext> {
  const flags = runtimeFlags();
  const installId = await getInstallId(storage);
  cachedContext = {
    installId,
    appVersion: appConfig.expo.version,
    ...flags,
  };
  return cachedContext;
}

export function getAnalyticsContext(): AnalyticsContext | null {
  return cachedContext ? { ...cachedContext } : null;
}

function backendProps(props: Record<string, unknown>): Record<string, unknown> {
  if (!cachedContext) return props;
  return {
    ...props,
    install_id: cachedContext.installId,
    app_version: cachedContext.appVersion,
    is_dev: cachedContext.isDev,
  };
}

/** Send events collected before async identity/backend initialization. */
export function flushQueuedAnalytics(): void {
  if (!cachedContext || cachedContext.isTest || !isAnalyticsEnabled()) return;
  backendDeliveryReady = true;
  const pending = pendingQueue.splice(0, pendingQueue.length);
  for (const entry of pending) {
    void sendToBackend(entry.event, backendProps(entry.props));
  }
}

/**
 * The initial tab event is meaningful only after the app has finished both
 * persistence bootstraps and is actually rendering an onboarded tab. Keeping
 * this predicate pure makes the Splash/onboarding exclusion regression-testable.
 */
export function shouldTrackInitialTab(input: {
  profileReady: boolean;
  navigationReady: boolean;
  onboarded: boolean;
  alreadyTracked: boolean;
}): boolean {
  return input.profileReady
    && input.navigationReady
    && input.onboarded
    && !input.alreadyTracked;
}

/**
 * Check if the SDK has been configured for production use.
 *
 * Enabled when `EXPO_PUBLIC_ANALYTICS_KEY` is set.
 *
 * This does not depend on `isTest`; that flag only affects
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
 * - In test mode: no-op (events are not queued, logged, or transmitted).
 * - Without an API key: retains bounded local debug history only.
 * - With an API key: queues until identity/backend initialization, then sends.
 */
export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  const flags = cachedContext ?? runtimeFlags();
  // Test mode: completely silent.
  if (flags.isTest) return;
  // Scrub before the entry reaches the queue, console, or backend. This is the
  // single chokepoint: every event passes through here, so
  // every event is scrubbed.
  const scrubbed = scrubPii(props);
  const entry = { event, props: scrubbed, ts: Date.now() };
  eventQueue.push(entry);
  // Cap queue at 100 events to avoid unbounded memory growth in dev mode.
  if (eventQueue.length > 100) eventQueue.shift();
  // Dev console echo — gated so it never leaks to production.
  if (flags.isDev && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, scrubbed);
  }
  // Keep track() synchronous. The backend wrapper contains delivery failures
  // so analytics can never break a user-facing action.
  if (cachedContext && isAnalyticsEnabled() && backendDeliveryReady) {
    void sendToBackend(event, backendProps(scrubbed));
  } else {
    pendingQueue.push(entry);
    if (pendingQueue.length > 100) pendingQueue.shift();
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
  pendingQueue.length = 0;
}

/**
 * Reset the cached context. Used by tests to simulate a fresh launch.
 */
export function resetAnalyticsForTests(): void {
  cachedContext = null;
  eventQueue.length = 0;
  pendingQueue.length = 0;
  backendDeliveryReady = false;
}
