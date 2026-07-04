// Phase 42 / P1-1 — Onboarding storage bootstrap extracted from App.tsx.
//
// The original App.tsx contained a ~30-line async function (loadPreference)
// that decided between web localStorage and native SQLite, opened the
// SQLite handle, ran createTablesSql, and built a key-value storage adapter.
// The same code was duplicated in the OnboardingScreen.onDone callback
// (without the read step). Both have been collapsed into this module so
// the read+write paths share a single bootstrap helper.

import { Platform } from 'react-native';

import { createTablesSql } from '../db/schema';
import { createSqliteKeyValueStorage } from '../services/keyValueStorage';
import { createInMemoryKeyValueStorage } from '../services/keyValueStorage';
import { createOnboardingPreferenceStore, type OnboardingPreference } from '../services/onboardingPreferenceService';
import type { SqliteLikeDatabase } from '../repositories/sqliteLearningRepository';

type AsyncKeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * Open the onboarding key-value store. On web this is the browser local-
 * storage adapter; on native this opens the SQLite database, runs
 * createTablesSql, and returns a SQLite-backed KV adapter. Falls back to
 * an in-memory store on failure (caller can choose how to surface).
 */
export async function openOnboardingStorage(): Promise<AsyncKeyValueStorage> {
  if (Platform.OS === 'web') {
    const { createWebOnboardingStorage } = await import('../services/onboardingPreferenceService');
    const webStorage = createWebOnboardingStorage();
    if (!webStorage) return createInMemoryKeyValueStorage();
    return webStorage;
  }
  try {
    const SQLite = await import('expo-sqlite');
    const db = await SQLite.openDatabaseAsync('japanese-tutor.db');
    for (const sql of createTablesSql) await db.execAsync(sql);
    return createSqliteKeyValueStorage({
      execAsync: (sql: string) => db.execAsync(sql),
      runAsync: (sql: string, ...params: unknown[]) => db.runAsync(sql, ...params as never[]),
      getAllAsync: ((sql: string, ...params: unknown[]) =>
        db.getAllAsync(sql, ...(params as never[]))) as SqliteLikeDatabase['getAllAsync'],
    });
  } catch (err) {
    if (__DEV__) console.warn('[app] SQLite init failed; falling back to in-memory storage', err);
    return createInMemoryKeyValueStorage();
  }
}

/**
 * Load the persisted onboarding preference, or the default if storage is
 * unavailable or the preference doesn't exist yet.
 */
export async function loadOnboardingPreference(skipOnboarding: boolean): Promise<OnboardingPreference> {
  try {
    const storage = await openOnboardingStorage();
    const store = createOnboardingPreferenceStore(storage);
    return await store.load();
  } catch (err) {
    if (__DEV__) console.warn('[app] onboarding preference load failed; using default', err);
    const { getDefaultOnboardingPreference } = await import('../services/onboardingPreferenceService');
    return getDefaultOnboardingPreference();
  }
}

/**
 * Persist an onboarding choice to the same storage path the app reads from
 * on cold start.
 */
export async function saveOnboardingPreference(preference: OnboardingPreference): Promise<void> {
  try {
    const storage = await openOnboardingStorage();
    const store = createOnboardingPreferenceStore(storage);
    await store.save(preference);
  } catch (err) {
    if (__DEV__) console.warn('[app] failed to persist onboarding choice', err);
  }
}