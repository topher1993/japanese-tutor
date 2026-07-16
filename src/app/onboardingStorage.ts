// Phase 42 / P1-1 — Onboarding storage bootstrap extracted from App.tsx.
//
// The original App.tsx contained a ~30-line async function (loadPreference)
// that decided between web localStorage and native SQLite, opened the
// SQLite handle, ran createTablesSql, and built a key-value storage adapter.
// The same code was duplicated in the OnboardingScreen.onDone callback
// (without the read step). Both have been collapsed into this module so
// the read+write paths share a single bootstrap helper.

import { Platform } from 'react-native';

import { createSharedSqliteAdapter, openSharedNativeDatabase } from '../db/nativeDatabase';
import { createSqliteKeyValueStorage } from '../services/keyValueStorage';
import { createInMemoryKeyValueStorage } from '../services/keyValueStorage';
import { createOnboardingPreferenceStore, type OnboardingPreference } from '../services/onboardingPreferenceService';
import type { SqliteLikeDatabase } from '../repositories/sqliteLearningRepository';

type AsyncKeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

let sharedStoragePromise: Promise<AsyncKeyValueStorage> | null = null;

/**
 * Open the onboarding key-value store. On web this is the browser local-
 * storage adapter; on native this opens the SQLite database, runs
 * createTablesSql, and returns a SQLite-backed KV adapter. Falls back to
 * an in-memory store on failure (caller can choose how to surface).
 */
async function initializeAppStorage(): Promise<AsyncKeyValueStorage> {
  if (Platform.OS === 'web') {
    const { createWebOnboardingStorage } = await import('../services/onboardingPreferenceService');
    const webStorage = createWebOnboardingStorage();
    if (!webStorage) return createInMemoryKeyValueStorage();
    return webStorage;
  }
  try {
    const db = await openSharedNativeDatabase();
    const sharedAdapter = createSharedSqliteAdapter(db);
    const sqliteAdapter: SqliteLikeDatabase = {
      ...sharedAdapter,
      getAllAsync: sharedAdapter.getAllAsync as SqliteLikeDatabase['getAllAsync'],
    };
    return createSqliteKeyValueStorage(sqliteAdapter);
  } catch (err) {
    if (__DEV__) console.warn('[app] SQLite init failed; falling back to in-memory storage', err);
    return createInMemoryKeyValueStorage();
  }
}

/**
 * Return one shared storage initialization for the app process. Onboarding,
 * navigation restoration, and subsequent saves all use the same SQLite
 * connection instead of racing through schema setup on cold start.
 */
export function openOnboardingStorage(): Promise<AsyncKeyValueStorage> {
  if (!sharedStoragePromise) sharedStoragePromise = initializeAppStorage();
  return sharedStoragePromise;
}

/**
 * Load the persisted onboarding preference, or the default if storage is
 * unavailable or the preference doesn't exist yet.
 */
export async function loadOnboardingPreference(_skipOnboarding: boolean): Promise<OnboardingPreference> {
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
