// Phase 37g — dev-only helper for the weekly-todos feature flag.
//
// This file lives under src/dev/ to signal "dev-only, do not auto-import."
// No production module imports it; the Settings screen wires it under an
// `__DEV__` guard at render time, and Expo's bundler tree-shakes the unused
// branch out of release builds.
//
// The wrapper exists for three reasons:
//   1. One canonical call site for the toggle, so we never have to grep the
//      app for stray `setTodoFeatureEnabled` callers.
//   2. A `[dev-menu]` console.warn banner so it's obvious in the Metro / JS
//      log that someone flipped the flag from a UI control.
//   3. Defensive behavior: if `setTodoFeatureEnabled` is undefined (e.g. the
//      helper is imported from a test or a non-app context), we no-op and
//      warn rather than throwing.

import {
  isTodoFeatureEnabled,
  setTodoFeatureEnabled,
} from '../services/practiceProgressStore';

function safeToggle(next: boolean): boolean {
  if (typeof setTodoFeatureEnabled !== 'function') {
    // eslint-disable-next-line no-console
    console.warn(
      '[dev-menu] setTodoFeatureEnabled is unavailable — no-op. ' +
        'Are you running outside the app context?',
    );
    return false;
  }
  setTodoFeatureEnabled(next);
  return true;
}

/** Flip the weekly-todos feature flag ON. Returns true if the toggle landed. */
export function enableWeeklyTodos(): boolean {
  const ok = safeToggle(true);
  if (ok) {
    // eslint-disable-next-line no-console
    console.warn('[dev-menu] enabled weekly todos');
  }
  return ok;
}

/** Flip the weekly-todos feature flag OFF. Returns true if the toggle landed. */
export function disableWeeklyTodos(): boolean {
  const ok = safeToggle(false);
  if (ok) {
    // eslint-disable-next-line no-console
    console.warn('[dev-menu] disabled weekly todos');
  }
  return ok;
}

/**
 * Read the current flag value. Falls back to `false` when the store export
 * is unavailable so the UI never throws during a test render.
 */
export function getWeeklyTodosEnabled(): boolean {
  if (typeof isTodoFeatureEnabled !== 'function') return false;
  try {
    return isTodoFeatureEnabled();
  } catch {
    return false;
  }
}
