import type { SqliteLikeDatabase } from '../repositories/sqliteLearningRepository';

/**
 * Async key/value storage backed by the SQLite `kv_preferences` table.
 * Used by `onboardingPreferenceService` (Phase 22 audit fix P0-01) and any
 * future learner-level persistence (Phase 22 audit fix P0-02).
 *
 * The interface is intentionally async — SQLite is async on React Native,
 * and `App.tsx` must not call into a sync getter at render time (was the
 * root cause of the cold-start onboarding bug).
 */
export interface AsyncKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /** Convenience: list all keys (for QA + SettingsScreen). */
  keys(): Promise<string[]>;
}

export function createSqliteKeyValueStorage(db: SqliteLikeDatabase): AsyncKeyValueStorage {
  return {
    async getItem(key) {
      const rows = await db.getAllAsync<{ value: string }>(
        'SELECT value FROM kv_preferences WHERE key = ?',
        key,
      );
      return rows[0]?.value ?? null;
    },
    async setItem(key, value) {
      await db.runAsync(
        'INSERT OR REPLACE INTO kv_preferences (key, value, updated_at) VALUES (?, ?, ?)',
        key,
        value,
        new Date().toISOString(),
      );
    },
    async removeItem(key) {
      await db.runAsync('DELETE FROM kv_preferences WHERE key = ?', key);
    },
    async keys() {
      const rows = await db.getAllAsync<{ key: string }>('SELECT key FROM kv_preferences');
      return rows.map(r => r.key);
    },
  };
}

/**
 * In-memory fallback used in tests and when no SQLite database is available
 * (e.g. pure-unit-test contexts where we don't want to spin up SQLite).
 * Behaves identically to the SQLite adapter from a caller's perspective.
 */
export function createInMemoryKeyValueStorage(): AsyncKeyValueStorage {
  const map = new Map<string, string>();
  return {
    async getItem(key) { return map.get(key) ?? null; },
    async setItem(key, value) { map.set(key, value); },
    async removeItem(key) { map.delete(key); },
    async keys() { return Array.from(map.keys()); },
  };
}