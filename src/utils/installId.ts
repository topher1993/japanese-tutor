/**
 * Phase 44.3 — installId persistence.
 *
 * PostHog identifies users across sessions with a stable install ID.
 * Without persistence, every cold start gets a fresh ID and dashboards
 * can't compute weekly active users, retention, or any per-user funnel.
 *
 * Storage strategy:
 *   - Reuse the project's existing AsyncKeyValueStorage layer
 *     (SQLite on native, localStorage on web) — no new dependency.
 *   - Cache the ID in memory after first read so we don't hit storage
 *     on every track() call.
 *   - Generate a UUID v4 (via Web Crypto on native + web, or a
 *     random fallback if unavailable).
 *   - On storage failure (read OR write), fall back to a per-process
 *     random ID. Better to log anonymous events than to crash the app.
 *
 * Key: `analytics.installId` — namespaced so it doesn't collide with
 * onboarding, profile, or future per-feature keys.
 */

import type { AsyncKeyValueStorage } from '../services/keyValueStorage';

const STORAGE_KEY = 'analytics.installId';

let cachedId: string | null = null;

/**
 * Generate a UUID v4-shaped string. Uses Web Crypto when available
 * (Expo SDK 54 always provides it via `react-native-get-random-values`,
 * which posthog-react-native pulls in transitively). Falls back to
 * Math.random for the rare test/web environment without it.
 */
function generateId(): string {
  const g: { crypto?: { randomUUID?: () => string } } = globalThis as unknown as {
    crypto?: { randomUUID?: () => string };
  };
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }
  // Fallback: 32 hex chars + dashes. Not RFC 4122 compliant, but
  // stable enough for an analytics install ID.
  const hex = (n: number) => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `${hex(0)}-${hex(1)}-4${hex(2).slice(1)}-${hex(3)}-${hex(4)}${hex(5)}`;
}

/**
 * Load the persisted install ID, or generate + persist a new one.
 *
 * @param storage - The AsyncKeyValueStorage to read/write from. Caller
 *                  owns the storage lifecycle (typically the same store
 *                  used for onboarding preferences).
 */
export async function getInstallId(storage: AsyncKeyValueStorage): Promise<string> {
  if (cachedId) return cachedId;
  try {
    const existing = await storage.getItem(STORAGE_KEY);
    if (existing && existing.length > 0) {
      cachedId = existing;
      return cachedId;
    }
    const fresh = generateId();
    await storage.setItem(STORAGE_KEY, fresh);
    cachedId = fresh;
    return cachedId;
  } catch {
    // Storage is unreachable. Fall back to a per-process random id —
    // events will be logged but not tied to previous sessions. That's
    // a degraded mode, not a crash.
    cachedId = `proc-${Math.random().toString(36).slice(2, 12)}`;
    return cachedId;
  }
}

/**
 * Clear the in-memory cache. Used by tests to simulate a fresh launch
 * without having to wipe the underlying storage.
 */
export function resetInstallIdForTests(): void {
  cachedId = null;
}