import { openOnboardingStorage } from './onboardingStorage';

type NavigationStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export interface PersistedNavigationState {
  showDailyRush: boolean;
}

const NAVIGATION_STORAGE_KEY = 'japanese-tutor:navigation:v1';
const DEFAULT_NAVIGATION_STATE: PersistedNavigationState = { showDailyRush: false };

function normalizeNavigationState(value: unknown): PersistedNavigationState {
  if (!value || typeof value !== 'object') return { ...DEFAULT_NAVIGATION_STATE };
  return { showDailyRush: (value as Partial<PersistedNavigationState>).showDailyRush === true };
}

export function createNavigationStateStore(storage: NavigationStorage) {
  return {
    async load(): Promise<PersistedNavigationState> {
      try {
        const raw = await storage.getItem(NAVIGATION_STORAGE_KEY);
        return raw ? normalizeNavigationState(JSON.parse(raw)) : { ...DEFAULT_NAVIGATION_STATE };
      } catch {
        return { ...DEFAULT_NAVIGATION_STATE };
      }
    },
    async save(state: PersistedNavigationState): Promise<void> {
      await storage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(normalizeNavigationState(state)));
    },
  };
}

export async function loadPersistedNavigationState(): Promise<PersistedNavigationState> {
  try {
    return await createNavigationStateStore(await openOnboardingStorage()).load();
  } catch {
    return { ...DEFAULT_NAVIGATION_STATE };
  }
}

export async function savePersistedNavigationState(state: PersistedNavigationState): Promise<void> {
  try {
    await createNavigationStateStore(await openOnboardingStorage()).save(state);
  } catch {
    // Navigation persistence is best-effort; in-memory navigation still works.
  }
}
