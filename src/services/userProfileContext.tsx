import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { createSharedSqliteAdapter, openSharedNativeDatabase } from '../db/nativeDatabase';
import { createInMemoryKeyValueStorage, createSqliteKeyValueStorage, type AsyncKeyValueStorage } from './keyValueStorage';
import { createUserProfileService, type UserProfileService } from './userProfileService';
import {
  createInMemoryUserProfileRepository,
  createKeyValueUserProfileRepository,
  createSqliteUserProfileRepository,
  type UserProfileRepository,
} from '../repositories/userProfileRepository';
import type { SqliteLikeDatabase } from '../repositories/sqliteLearningRepository';
import type { UserProfile, UserProfilePatch } from '../types/userProfile';
import { createWebOnboardingStorage } from './onboardingPreferenceService';

// React Native injects `__DEV__` at runtime; declare it for TS so we don't
// get an implicit-any error when guarding console.warn calls.
declare const __DEV__: boolean | undefined;

interface UserProfileContextValue {
  ready: boolean;
  durable: boolean;
  profile: UserProfile | null;
  service: UserProfileService | null;
  updateProfile: (patch: UserProfilePatch) => Promise<UserProfile | null>;
  reloadProfile: () => Promise<UserProfile | null>;
  resetProfile: () => Promise<{ profileRowsCleared: number }>;
}

const UserProfileContext = createContext<UserProfileContextValue>({
  ready: false,
  durable: false,
  profile: null,
  service: null,
  updateProfile: async () => null,
  reloadProfile: async () => null,
  resetProfile: async () => ({ profileRowsCleared: 0 }),
});

export function useUserProfileContext(): UserProfileContextValue {
  return useContext(UserProfileContext);
}

async function openNativeProfileStores(): Promise<{
  repository: UserProfileRepository;
  legacyStorage: AsyncKeyValueStorage;
}> {
  const db = await openSharedNativeDatabase();
  const sqliteAdapter: SqliteLikeDatabase = createSharedSqliteAdapter(db);
  return {
    repository: createSqliteUserProfileRepository(sqliteAdapter),
    legacyStorage: createSqliteKeyValueStorage(sqliteAdapter),
  };
}

/**
 * Phase 28 user-profile foundation. Mirrors LearningRepositoryProvider's
 * SQLite-open-fail → in-memory fallback so Profile/reset state is always
 * readable and never blocks the app shell.
 */
export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<UserProfileContextValue>({
    ready: false,
    durable: false,
    profile: null,
    service: null,
    updateProfile: async () => null,
    reloadProfile: async () => null,
    resetProfile: async () => ({ profileRowsCleared: 0 }),
  });

  useEffect(() => {
    let cancelled = false;

    async function openProfile() {
      try {
        const webStorage = Platform.OS === 'web' ? createWebOnboardingStorage() : null;
        const stores = Platform.OS === 'web'
          ? webStorage
            ? { repository: createKeyValueUserProfileRepository(webStorage), legacyStorage: webStorage, durable: true }
            : { repository: createInMemoryUserProfileRepository(), legacyStorage: createInMemoryKeyValueStorage(), durable: false }
          : { ...(await openNativeProfileStores()), durable: true };
        const service = createUserProfileService(stores.repository, stores.legacyStorage);
        const profile = await service.load();
        if (cancelled) return;
        setValue(makeContextValue(service, profile, stores.durable));
      } catch (err) {
        if (__DEV__) console.warn('[profile] open failed; falling back to in-memory', err);
        const service = createUserProfileService(createInMemoryUserProfileRepository(), createInMemoryKeyValueStorage());
        const profile = await service.load();
        if (cancelled) return;
        setValue(makeContextValue(service, profile, false));
      }
    }

    openProfile();
    return () => { cancelled = true; };
  }, []);

  function makeContextValue(service: UserProfileService, profile: UserProfile, durable: boolean): UserProfileContextValue {
    const reloadProfile = async () => {
      const next = await service.load();
      setValue(makeContextValue(service, next, durable));
      return next;
    };
    const updateProfile = async (patch: UserProfilePatch) => {
      const next = await service.update(patch);
      setValue(makeContextValue(service, next, durable));
      return next;
    };
    const resetProfile = async () => {
      const profileRowsCleared = await service.clear();
      const next = await service.load();
      setValue(makeContextValue(service, next, durable));
      return { profileRowsCleared };
    };
    return { ready: true, durable, profile, service, updateProfile, reloadProfile, resetProfile };
  }

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}
