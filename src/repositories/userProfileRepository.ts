import type { SqliteLikeDatabase } from './sqliteLearningRepository';
import { createTablesSql } from '../db/schema';
import type { UserProfile } from '../types/userProfile';

export const USER_PROFILE_ROW_KEY = 'primary';
export const USER_PROFILE_STORAGE_KEY = 'japanese-tutor:user-profile:v1';

export interface UserProfileKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface UserProfileRepository {
  initialize(): Promise<void>;
  load(): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<UserProfile>;
  clear(): Promise<number>;
  close(): Promise<void>;
}

function parseProfile(raw: string | null): UserProfile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.static) || !isRecord(parsed.dynamic) || !isRecord(parsed.meta)) return null;
    if (parsed.meta.schemaVersion !== 1) return null;
    return parsed as unknown as UserProfile;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createSqliteUserProfileRepository(db: SqliteLikeDatabase): UserProfileRepository {
  return {
    async initialize() {
      for (const sql of createTablesSql) await db.execAsync(sql);
      if (db.tables && !db.tables.has('user_profile')) db.tables.set('user_profile', []);
    },
    async load() {
      const rows = await db.getAllAsync<{ value: string }>(
        'SELECT value FROM user_profile WHERE key = ?',
        USER_PROFILE_ROW_KEY,
      );
      return parseProfile(rows[0]?.value ?? null);
    },
    async save(profile) {
      await db.runAsync(
        'INSERT OR REPLACE INTO user_profile (key, value, updated_at) VALUES (?, ?, ?)',
        USER_PROFILE_ROW_KEY,
        JSON.stringify(profile),
        profile.meta.updatedAt,
      );
      return profile;
    },
    async clear() {
      const result = await db.runAsync('DELETE FROM user_profile WHERE key = ?', USER_PROFILE_ROW_KEY);
      return result.changes ?? 0;
    },
    async close() {
      // expo-sqlite connection ownership stays with the provider; no-op here.
    },
  };
}

export function createInMemoryUserProfileRepository(initial?: UserProfile | null): UserProfileRepository {
  let profile = initial ?? null;
  return {
    async initialize() {
      // no-op
    },
    async load() {
      return profile ? JSON.parse(JSON.stringify(profile)) as UserProfile : null;
    },
    async save(next) {
      profile = JSON.parse(JSON.stringify(next)) as UserProfile;
      return this.load() as Promise<UserProfile>;
    },
    async clear() {
      const existed = profile ? 1 : 0;
      profile = null;
      return existed;
    },
    async close() {
      // no-op for web/tests.
    },
  };
}

/** Durable browser repository backed by the same async storage contract used
 * by onboarding. Keeping the profile in localStorage makes the web build
 * behave like native across reloads instead of silently starting a new
 * learner profile on every mount. */
export function createKeyValueUserProfileRepository(
  storage: UserProfileKeyValueStorage,
): UserProfileRepository {
  return {
    async initialize() {
      // The key-value backend has no schema setup step.
    },
    async load() {
      return parseProfile(await storage.getItem(USER_PROFILE_STORAGE_KEY));
    },
    async save(profile) {
      await storage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      return profile;
    },
    async clear() {
      const existed = await storage.getItem(USER_PROFILE_STORAGE_KEY);
      await storage.removeItem(USER_PROFILE_STORAGE_KEY);
      return existed ? 1 : 0;
    },
    async close() {
      // Storage ownership stays with the browser adapter.
    },
  };
}
