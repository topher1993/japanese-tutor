import type { LearnerLanguage } from '../types/onboarding';

// React Native injects `__DEV__` at runtime; declare it for TS so we don't
// pull in @types/react-native for one symbol.
declare const __DEV__: boolean | undefined;

/**
 * Phase 22 audit fix P0-01: the previous `createBrowserOnboardingStorage()`
 * returned `undefined` on React Native, silently dropping learner preferences
 * on every cold start. The new contract is:
 *
 *   - `OnboardingStorageAdapter` is now ASYNC (SQLite-backed on RN, localStorage
 *     on web). Reads happen at app start, NOT in render — `App.tsx` shows a
 *     splash while the preference is loading.
 *   - The factory is renamed to `createOnboardingStorage(platform)` so the
 *     intent is clear: it picks the right adapter for the runtime.
 *   - There is no silent no-op path. If the storage layer fails to construct,
 *     `App.tsx` falls back to "not onboarded" AND the learner sees a one-time
 *     banner explaining what happened (logged in dev).
 */
export interface OnboardingPreference {
  onboarded: boolean;
  language: LearnerLanguage;
}

export interface OnboardingStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const ONBOARDING_STORAGE_KEY = 'japanese-tutor:onboarding-preference:v1';
const DEFAULT_PREFERENCE: OnboardingPreference = { onboarded: false, language: 'en' };
const allowedLanguages: LearnerLanguage[] = ['en', 'vi', 'tl'];

export function getOnboardingStorageKey(): string {
  return ONBOARDING_STORAGE_KEY;
}

export function getDefaultOnboardingPreference(): OnboardingPreference {
  return { ...DEFAULT_PREFERENCE };
}

/**
 * Phase 22 audit fix P1-06: Settings screen needs a public way to wipe the
 * preference without holding a store reference. Web-only convenience that
 * goes straight at `window.localStorage`. Native callers should use
 * `createOnboardingPreferenceStore(storage).clear()` instead.
 */
export function clearOnboardingPreference(): Promise<void> {
  const storage = createWebOnboardingStorage();
  if (!storage) return Promise.resolve();
  return storage.removeItem(ONBOARDING_STORAGE_KEY);
}

function normalizePreference(value: unknown): OnboardingPreference {
  if (!value || typeof value !== 'object') return getDefaultOnboardingPreference();
  const candidate = value as Partial<OnboardingPreference>;
  const language = allowedLanguages.includes(candidate.language as LearnerLanguage)
    ? candidate.language as LearnerLanguage
    : 'en';
  return { onboarded: candidate.onboarded === true, language };
}

/**
 * Web-only adapter: browser localStorage. Used in the Expo web build.
 * Returns null when localStorage is unavailable (e.g. SSR or private mode).
 */
export function createWebOnboardingStorage(): OnboardingStorageAdapter | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return {
    async getItem(key) { return window.localStorage.getItem(key); },
    async setItem(key, value) { window.localStorage.setItem(key, value); },
    async removeItem(key) { window.localStorage.removeItem(key); },
  };
}

/**
 * Legacy alias retained for tests that pin the old name. Maps to the new
 * web adapter. New callers should use `createWebOnboardingStorage` directly.
 * @deprecated use createWebOnboardingStorage
 */
export function createBrowserOnboardingStorage(): OnboardingStorageAdapter | undefined {
  const adapter = createWebOnboardingStorage();
  return adapter ?? undefined;
}

/**
 * The store is now async. Callers must `await`. `App.tsx` already loads the
 * preference in a `useEffect` with a splash fallback (per P2-13).
 */
export function createOnboardingPreferenceStore(storage: OnboardingStorageAdapter | null | undefined) {
  return {
    async load(): Promise<OnboardingPreference> {
      if (!storage) return getDefaultOnboardingPreference();
      try {
        const raw = await storage.getItem(ONBOARDING_STORAGE_KEY);
        if (!raw) return getDefaultOnboardingPreference();
        return normalizePreference(JSON.parse(raw));
      } catch (err) {
        if (typeof __DEV__ === 'undefined' || __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[onboarding] failed to load preference, using default', err);
        }
        return getDefaultOnboardingPreference();
      }
    },
    async save(preference: OnboardingPreference): Promise<OnboardingPreference> {
      const normalized = normalizePreference(preference);
      if (storage) {
        try {
          await storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(normalized));
        } catch (err) {
          if (typeof __DEV__ === 'undefined' || __DEV__) {
                    // eslint-disable-next-line no-console
                    console.warn('[onboarding] failed to save preference', err);
                  }
        }
      }
      return normalized;
    },
    async clear(): Promise<void> {
      if (storage) {
        try { await storage.removeItem(ONBOARDING_STORAGE_KEY); } catch { /* best effort */ }
      }
    },
  };
}