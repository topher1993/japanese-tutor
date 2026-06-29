import type { SqliteLikeDatabase } from './sqliteLearningRepository';
import { createTablesSql } from '../db/schema';
import type { UserProfile } from '../types/userProfile';

export const USER_PROFILE_ROW_KEY = 'primary';

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
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.meta?.schemaVersion !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
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
