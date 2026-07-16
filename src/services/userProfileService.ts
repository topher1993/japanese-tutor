import type { OnboardingPreference } from './onboardingPreferenceService';
import { getOnboardingStorageKey } from './onboardingPreferenceService';
import type { AsyncKeyValueStorage } from './keyValueStorage';
import { createInitialProgress } from './progressService';
import type { DailyRushProfileStats, PlacementProfile, UserProfile, UserProfilePatch, WorkplaceProfile } from '../types/userProfile';
import type { PlacementLevel } from './placementTestService';
import type { LearnerLanguage } from '../types/onboarding';
import type { UserProfileRepository } from '../repositories/userProfileRepository';
import { localDateKey } from '../utils/localDate';

type ProfileLegacyStorage = Pick<AsyncKeyValueStorage, 'getItem' | 'setItem' | 'removeItem'>;

export const CURRENT_PROFILE_SCHEMA_VERSION = 1;
export const USER_PROFILE_MIGRATIONS: Array<(profile: unknown) => unknown> = [];

const DEFAULT_DAILY_MINUTES = 10;
const MAX_FREE_TEXT_CHARS = 40;
const MAX_SITUATIONS = 5;

export interface UserProfileService {
  load(): Promise<UserProfile>;
  update(patch: UserProfilePatch): Promise<UserProfile>;
  editPreferences(patch: Pick<Partial<UserProfile['static']>, 'supportLanguage' | 'dailyStudyMinutes'>): Promise<UserProfile>;
  clear(): Promise<number>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clampText(value: string): string {
  return value.trim().slice(0, MAX_FREE_TEXT_CHARS);
}

function normalizeWorkplace(workplace: WorkplaceProfile | null | undefined): WorkplaceProfile | null {
  if (!workplace) return null;
  return {
    industry: clampText(workplace.industry),
    role: clampText(workplace.role),
    commonSituations: workplace.commonSituations
      .map(clampText)
      .filter(Boolean)
      .slice(0, MAX_SITUATIONS),
  };
}

function normalizeDailyRushStats(stats: Partial<DailyRushProfileStats> | null | undefined): DailyRushProfileStats {
  const lastSummary = stats?.lastSummary
    ? {
      total: Math.max(0, Number(stats.lastSummary.total) || 0),
      good: Math.max(0, Number(stats.lastSummary.good) || 0),
      again: Math.max(0, Number(stats.lastSummary.again) || 0),
      xpEarned: Math.max(0, Number(stats.lastSummary.xpEarned) || 0),
      accuracyPercent: Math.max(0, Math.min(100, Number(stats.lastSummary.accuracyPercent) || 0)),
    }
    : undefined;
  return {
    totalRuns: Math.max(0, Number(stats?.totalRuns) || 0),
    totalGood: Math.max(0, Number(stats?.totalGood) || 0),
    totalAgain: Math.max(0, Number(stats?.totalAgain) || 0),
    totalXpEarned: Math.max(0, Number(stats?.totalXpEarned) || 0),
    lastCompletedDate: stats?.lastCompletedDate,
    ...(lastSummary ? { lastSummary } : {}),
  };
}

function normalizeLanguage(value: unknown): LearnerLanguage {
  return value === 'vi' || value === 'tl' || value === 'en' ? value : 'en';
}

function normalizePlacement(placement: PlacementProfile | null | undefined): PlacementProfile | undefined {
  if (!placement) return undefined;
  const validLevels: PlacementLevel[] = ['absolute-beginner', 'N5', 'N4', 'N3', 'N3-or-above'];
  if (!validLevels.includes(placement.level)) return undefined;
  return {
    level: placement.level,
    scorePercent: Math.max(0, Math.min(100, Number(placement.scorePercent) || 0)),
    completedAt: typeof placement.completedAt === 'string' ? placement.completedAt : nowIso(),
    testVersion: typeof placement.testVersion === 'string' && placement.testVersion.length > 0
      ? placement.testVersion
      : 'v1',
  };
}

type UserProfileSeed = Partial<Omit<UserProfile, 'static' | 'dynamic' | 'meta'>> & {
  static?: Partial<UserProfile['static']>;
  dynamic?: Partial<UserProfile['dynamic']>;
  meta?: Partial<UserProfile['meta']>;
};

export function createDefaultUserProfile(overrides: UserProfileSeed = {}): UserProfile {
  const timestamp = nowIso();
  const base: UserProfile = {
    onboarded: false,
    static: {
      supportLanguage: 'en',
      studyGoal: 'daily-conversation',
      workplace: null,
      jlptTarget: 'N5',
      dailyStudyMinutes: DEFAULT_DAILY_MINUTES,
      audioStudyDelayMs: 800,
    },
    dynamic: {
      xp: 0,
      streak: createInitialProgress(localDateKey()).streak,
      dailyRush: normalizeDailyRushStats(null),
    },
    meta: {
      schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
  return normalizeProfile({
    ...base,
    ...overrides,
    static: { ...base.static, ...overrides.static },
    dynamic: { ...base.dynamic, ...overrides.dynamic },
    meta: { ...base.meta, ...overrides.meta },
  });
}

function profileFromLegacyOnboarding(pref: OnboardingPreference): UserProfile {
  const timestamp = nowIso();
  return createDefaultUserProfile({
    onboarded: pref.onboarded,
    static: { supportLanguage: normalizeLanguage(pref.language) },
    meta: {
      schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
      migratedFrom: 'onboarding-preference-v1',
    },
  });
}

function normalizeProfile(profile: UserProfile): UserProfile {
  const updatedAt = profile.meta?.updatedAt ?? nowIso();
  const createdAt = profile.meta?.createdAt ?? updatedAt;
  const dailyStudyMinutes = ([2, 5, 10, 15, 30] as const).includes(profile.static.dailyStudyMinutes)
    ? profile.static.dailyStudyMinutes
    : DEFAULT_DAILY_MINUTES;
  const audioStudyDelayMs = ([600, 800, 1200, 1600] as const).includes(profile.static.audioStudyDelayMs)
    ? profile.static.audioStudyDelayMs
    : 800;
  const supportLanguage = normalizeLanguage(profile.static.supportLanguage);
  const studyGoal = profile.static.studyGoal ?? 'daily-conversation';
  const workplace = normalizeWorkplace(profile.static.workplace);

  return {
    onboarded: profile.onboarded === true,
    static: {
      supportLanguage,
      studyGoal,
      workplace: studyGoal === 'workplace-survival' ? workplace ?? { industry: '', role: '', commonSituations: [] } : null,
      jlptTarget: profile.static.jlptTarget ?? 'N5',
      dailyStudyMinutes,
      audioStudyDelayMs,
    },
    dynamic: {
      xp: Math.max(0, Number(profile.dynamic.xp) || 0),
      streak: profile.dynamic.streak ?? createInitialProgress(localDateKey()).streak,
      dailyRush: normalizeDailyRushStats(profile.dynamic.dailyRush),
      lastStudyActivityAt: profile.dynamic.lastStudyActivityAt,
      placement: normalizePlacement(profile.dynamic.placement),
      placementPromptDismissed: profile.dynamic.placementPromptDismissed === true,
    },
    meta: {
      schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION,
      createdAt,
      updatedAt,
      migratedFrom: profile.meta.migratedFrom,
    },
  };
}

function mergeProfile(profile: UserProfile, patch: UserProfilePatch): UserProfile {
  return normalizeProfile({
    ...profile,
    ...('onboarded' in patch ? { onboarded: patch.onboarded === true } : {}),
    static: { ...profile.static, ...patch.static },
    dynamic: { ...profile.dynamic, ...patch.dynamic },
    meta: { ...profile.meta, updatedAt: nowIso() },
  });
}

/**
 * Phase 28 user-profile service.
 *
 * Atomicity contract: profile identity/static/dynamic fields live in the
 * `user_profile` JSON row. The legacy onboarding preference still lives in
 * `kv_preferences` only until first profile load. `load()` migrates that row
 * once, saves the merged profile, then deletes the legacy key. Future
 * `update()` and `editPreferences()` calls write only the profile row, so the
 * active profile is a single persisted object and cannot drift across two
 * storage backends.
 */
export function createUserProfileService(
  repository: UserProfileRepository,
  legacyPreferences?: ProfileLegacyStorage | null,
): UserProfileService {
  // Profile controls save immediately. Serialize mutations so two quick taps
  // cannot both read the same old row and make the later write erase the
  // earlier preference change. Keep the chain usable after a failed write.
  let mutationChain: Promise<void> = Promise.resolve();

  function enqueueMutation<T>(work: () => Promise<T>): Promise<T> {
    const result = mutationChain.then(work);
    mutationChain = result.then(() => undefined, () => undefined);
    return result;
  }

  async function loadLegacyPreference(): Promise<OnboardingPreference | null> {
    if (!legacyPreferences) return null;
    const raw = await legacyPreferences.getItem(getOnboardingStorageKey());
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<OnboardingPreference>;
      return { onboarded: parsed.onboarded === true, language: normalizeLanguage(parsed.language) };
    } catch {
      return null;
    }
  }

  async function loadProfile(): Promise<UserProfile> {
    await repository.initialize();
    const existing = await repository.load();
    const legacy = await loadLegacyPreference();
    if (existing) {
      const normalized = normalizeProfile(existing);
      if (!legacy) return normalized;

      // Older app builds could create a default profile and then persist
      // onboarding separately. Reconcile that split-brain state once before
      // deleting the legacy key, otherwise an already-onboarded learner is
      // sent through onboarding again after upgrading.
      const reconciled = legacy.onboarded
        ? await repository.save(mergeProfile(normalized, {
          onboarded: true,
          static: { supportLanguage: legacy.language },
        }))
        : normalized;
      await legacyPreferences?.removeItem(getOnboardingStorageKey());
      return reconciled;
    }

    if (legacy) {
      const migrated = await repository.save(profileFromLegacyOnboarding(legacy));
      // Legacy kv_preferences row deleted post-migration; rerun triggers no-op.
      await legacyPreferences?.removeItem(getOnboardingStorageKey());
      return migrated;
    }

    const created = createDefaultUserProfile();
    return repository.save(created);
  }

  return {
    load: loadProfile,
    update(patch) {
      return enqueueMutation(async () => {
        const current = await loadProfile();
        return repository.save(mergeProfile(current, patch));
      });
    },
    async editPreferences(patch) {
      return this.update({ static: patch });
    },
    clear() {
      return enqueueMutation(() => repository.clear());
    },
  };
}
