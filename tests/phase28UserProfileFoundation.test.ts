import { describe, expect, it } from 'vitest';

import { createSqliteKeyValueStorage } from '../src/services/keyValueStorage';
import { getOnboardingStorageKey } from '../src/services/onboardingPreferenceService';
import { createDefaultUserProfile, createUserProfileService } from '../src/services/userProfileService';
import { createInMemoryUserProfileRepository, createSqliteUserProfileRepository } from '../src/repositories/userProfileRepository';
import type { SqliteLikeDatabase } from '../src/repositories/sqliteLearningRepository';

type Row = { key: string; value: string; updated_at?: string };

function createFakeSqliteDatabase(): SqliteLikeDatabase {
  const tables = new Map<string, Row[]>();
  return {
    tables: tables as unknown as Map<string, unknown[]>,
    async execAsync(sql) {
      if (sql.includes('CREATE TABLE') && sql.includes('kv_preferences')) tables.set('kv_preferences', tables.get('kv_preferences') ?? []);
      if (sql.includes('CREATE TABLE') && sql.includes('user_profile')) tables.set('user_profile', tables.get('user_profile') ?? []);
    },
    async runAsync(sql, ...params) {
      if (sql.includes('INSERT OR REPLACE INTO kv_preferences')) {
        const [key, value, updatedAt] = params as [string, string, string];
        const rows = tables.get('kv_preferences') ?? [];
        const idx = rows.findIndex(r => r.key === key);
        const row = { key, value, updated_at: updatedAt };
        if (idx >= 0) rows[idx] = row; else rows.push(row);
        tables.set('kv_preferences', rows);
        return { changes: 1 };
      }
      if (sql.includes('INSERT OR REPLACE INTO user_profile')) {
        const [key, value, updatedAt] = params as [string, string, string];
        const rows = tables.get('user_profile') ?? [];
        const idx = rows.findIndex(r => r.key === key);
        const row = { key, value, updated_at: updatedAt };
        if (idx >= 0) rows[idx] = row; else rows.push(row);
        tables.set('user_profile', rows);
        return { changes: 1 };
      }
      if (sql.includes('DELETE FROM kv_preferences')) {
        const [key] = params as [string];
        const rows = tables.get('kv_preferences') ?? [];
        const before = rows.length;
        tables.set('kv_preferences', rows.filter(r => r.key !== key));
        return { changes: before - (tables.get('kv_preferences')?.length ?? 0) };
      }
      if (sql.includes('DELETE FROM user_profile')) {
        const [key] = params as [string];
        const rows = tables.get('user_profile') ?? [];
        const before = rows.length;
        tables.set('user_profile', rows.filter(r => r.key !== key));
        return { changes: before - (tables.get('user_profile')?.length ?? 0) };
      }
      return { changes: 0 };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      if (sql.includes('SELECT value FROM kv_preferences')) {
        const [key] = params as [string];
        const row = (tables.get('kv_preferences') ?? []).find(r => r.key === key);
        return (row ? [{ value: row.value }] : []) as T[];
      }
      if (sql.includes('SELECT value FROM user_profile')) {
        const [key] = params as [string];
        const row = (tables.get('user_profile') ?? []).find(r => r.key === key);
        return (row ? [{ value: row.value }] : []) as T[];
      }
      if (sql.includes('SELECT key FROM kv_preferences')) {
        return (tables.get('kv_preferences') ?? []).map(r => ({ key: r.key })) as T[];
      }
      return [] as T[];
    },
  };
}

describe('Phase 28 user profile foundation', () => {
  it('creates a v1 default profile when no legacy onboarding preference exists', async () => {
    const service = createUserProfileService(createInMemoryUserProfileRepository());

    const profile = await service.load();

    expect(profile.meta.schemaVersion).toBe(1);
    expect(profile.onboarded).toBe(false);
    expect(profile.static.supportLanguage).toBe('en');
    expect(profile.static.studyGoal).toBe('daily-conversation');
    expect(profile.static.dailyStudyMinutes).toBe(10);
    expect(profile.dynamic.xp).toBe(0);
  });

  it('migrates the legacy onboarding preference once and deletes the old key', async () => {
    const db = createFakeSqliteDatabase();
    const legacyStorage = createSqliteKeyValueStorage(db);
    await legacyStorage.setItem(getOnboardingStorageKey(), JSON.stringify({ onboarded: true, language: 'vi' }));
    const service = createUserProfileService(createSqliteUserProfileRepository(db), legacyStorage);

    const profile = await service.load();

    expect(profile.onboarded).toBe(true);
    expect(profile.static.supportLanguage).toBe('vi');
    expect(profile.meta.migratedFrom).toBe('onboarding-preference-v1');
    expect(await legacyStorage.getItem(getOnboardingStorageKey())).toBeNull();
    expect(await service.load()).toEqual(profile);
  });

  it('updates profile preferences in the single profile row without rewriting the legacy key', async () => {
    const db = createFakeSqliteDatabase();
    const legacyStorage = createSqliteKeyValueStorage(db);
    const service = createUserProfileService(createSqliteUserProfileRepository(db), legacyStorage);

    await service.load();
    const updated = await service.editPreferences({ supportLanguage: 'tl', dailyStudyMinutes: 15 });

    expect(updated.static.supportLanguage).toBe('tl');
    expect(updated.static.dailyStudyMinutes).toBe(15);
    expect(await legacyStorage.getItem(getOnboardingStorageKey())).toBeNull();
  });

  it('normalizes workplace profile text and keeps workplace data only for workplace-survival goal', async () => {
    const service = createUserProfileService(createInMemoryUserProfileRepository(createDefaultUserProfile()));

    const workplace = await service.update({
      static: {
        studyGoal: 'workplace-survival',
        workplace: {
          industry: 'hospitality front desk with very long extra detail',
          role: 'night shift concierge with very long extra detail',
          commonSituations: ['check in guests', 'answer phone', 'give directions', 'handle complaints', 'call manager', 'extra'],
        },
      },
    });
    expect(workplace.static.workplace?.industry.length).toBeLessThanOrEqual(40);
    expect(workplace.static.workplace?.commonSituations).toHaveLength(5);

    const daily = await service.update({ static: { studyGoal: 'daily-conversation' } });
    expect(daily.static.workplace).toBeNull();
  });
});
