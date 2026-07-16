import { localDateKey } from '../../../utils/localDate';
import { getKoiUnlockedCosmetics } from '../domain/cosmetics';
import { createDefaultKoiProgression } from '../domain/progression';
import type { KoiCosmetic, KoiCosmeticSlot } from '../domain/types';
import type {
  KoiActiveDojoSessionV1,
  KoiCachedPetSnapshotV1,
  KoiSenseiLocalStateV1,
} from './koiSenseiRepository';

export const KOI_CARE_ACTIONS = [
  {
    id: 'morning-greeting',
    label: 'Share a greeting',
    description: 'Practice a kind Japanese greeting together.',
    response: 'おはよう！ Showing up together is enough for today.',
    bondReward: 2,
  },
  {
    id: 'green-tea',
    label: 'Offer green tea',
    description: 'Take a quiet study break with Koi.',
    response: 'ありがとう。 A calm pause helps new words settle in.',
    bondReward: 2,
  },
  {
    id: 'tidy-study-desk',
    label: 'Tidy the study desk',
    description: 'Prepare a welcoming place for the next lesson.',
    response: 'きれいですね。 Our study space is ready whenever you are.',
    bondReward: 3,
  },
] as const;

export type KoiCareActionId = (typeof KOI_CARE_ACTIONS)[number]['id'];

export const KOI_CARE_ACTION_IDS = KOI_CARE_ACTIONS.map(action => action.id) as readonly KoiCareActionId[];
export const KOI_LEAGUE_POINT_CAP = 500;
export const KOI_STARTER_CARE_ITEM_IDS = ['care.green-tea', 'care.study-cloth', 'care-greeting-card'] as const;
export const KOI_STARTER_DOJO_THEME_ID = 'dojo.aoi-garden';
export const KOI_DEFAULT_LEAGUE_ALIAS = 'Quiet Koi 27';

export interface KoiCareExperienceV1 {
  totalInteractions: number;
  lastInteractionDateByAction: Partial<Record<KoiCareActionId, string>>;
}

export interface KoiDojoExperienceV1 {
  completedSessions: number;
  bestScore: number;
  lastRewardedSessionId?: string;
}

export interface KoiLeagueExperienceV1 {
  alias: string;
  weekKey: string;
  weeklyPoints: number;
}

export interface KoiExperienceStateV1 {
  schemaVersion: 1;
  care: KoiCareExperienceV1;
  dojo: KoiDojoExperienceV1;
  league: KoiLeagueExperienceV1;
}

export interface KoiCareResult {
  applied: boolean;
  reason: 'applied' | 'already-cared-today';
  petSnapshot: KoiCachedPetSnapshotV1;
  experience: KoiExperienceStateV1;
  response: string;
}

export interface KoiDojoCompletionResult {
  applied: boolean;
  score: number;
  coinReward: number;
  bondReward: number;
  leaguePointReward: number;
  petSnapshot: KoiCachedPetSnapshotV1;
  experience: KoiExperienceStateV1;
}

export interface KoiLeagueStanding {
  alias: string;
  points: number;
  isLearner: boolean;
}

export function createDefaultKoiExperienceState(): KoiExperienceStateV1 {
  return {
    schemaVersion: 1,
    care: { totalInteractions: 0, lastInteractionDateByAction: {} },
    dojo: { completedSessions: 0, bestScore: 0 },
    league: { alias: KOI_DEFAULT_LEAGUE_ALIAS, weekKey: '', weeklyPoints: 0 },
  };
}

export function createDefaultKoiPetSnapshot(): KoiCachedPetSnapshotV1 {
  return {
    schemaVersion: 1,
    revision: 0,
    syncedAt: 0,
    progression: createDefaultKoiProgression(),
    bond: 0,
    coins: 0,
    equippedCosmeticIds: {},
    ownedCareItemIds: [...KOI_STARTER_CARE_ITEM_IDS],
    ownedDojoThemeIds: [KOI_STARTER_DOJO_THEME_ID],
    selectedDojoThemeId: KOI_STARTER_DOJO_THEME_ID,
  };
}

export function applyKoiCareAction(
  petSnapshot: KoiCachedPetSnapshotV1,
  experience: KoiExperienceStateV1,
  actionId: KoiCareActionId,
  dateKey: string = localDateKey(),
): KoiCareResult {
  const action = KOI_CARE_ACTIONS.find(candidate => candidate.id === actionId);
  if (!action) throw new Error(`Unknown Koi care action: ${actionId}.`);
  if (experience.care.lastInteractionDateByAction[actionId] === dateKey) {
    return {
      applied: false,
      reason: 'already-cared-today',
      petSnapshot,
      experience,
      response: 'We already shared this care moment today. Koi is content, and nothing decays while you are away.',
    };
  }

  return {
    applied: true,
    reason: 'applied',
    petSnapshot: {
      ...petSnapshot,
      revision: petSnapshot.revision + 1,
      bond: Math.min(1_000, petSnapshot.bond + action.bondReward),
    },
    experience: {
      ...experience,
      care: {
        totalInteractions: experience.care.totalInteractions + 1,
        lastInteractionDateByAction: {
          ...experience.care.lastInteractionDateByAction,
          [actionId]: dateKey,
        },
      },
    },
    response: action.response,
  };
}

export function equipKoiCosmetic(
  petSnapshot: KoiCachedPetSnapshotV1,
  cosmetic: KoiCosmetic,
): KoiCachedPetSnapshotV1 {
  const unlockedIds = new Set(getKoiUnlockedCosmetics(petSnapshot.progression).map(item => item.id));
  if (!unlockedIds.has(cosmetic.id)) throw new Error('That Koi cosmetic has not been unlocked through mastery.');
  const equippedCosmeticIds = { ...petSnapshot.equippedCosmeticIds };
  if (equippedCosmeticIds[cosmetic.slot] === cosmetic.id) delete equippedCosmeticIds[cosmetic.slot];
  else equippedCosmeticIds[cosmetic.slot] = cosmetic.id;
  return { ...petSnapshot, revision: petSnapshot.revision + 1, equippedCosmeticIds };
}

export function getEquippedKoiCosmeticId(
  petSnapshot: KoiCachedPetSnapshotV1,
  slot: KoiCosmeticSlot,
): string | undefined {
  return petSnapshot.equippedCosmeticIds[slot];
}

export function getKoiWeekKey(date: Date = new Date()): string {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - weekday);
  const weekYear = current.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((current.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

export function rollKoiLeagueWeek(
  experience: KoiExperienceStateV1,
  weekKey: string,
): KoiExperienceStateV1 {
  if (experience.league.weekKey === weekKey) return experience;
  return {
    ...experience,
    league: { ...experience.league, weekKey, weeklyPoints: 0 },
  };
}

export function completeKoiDojoSession(
  session: KoiActiveDojoSessionV1,
  petSnapshot: KoiCachedPetSnapshotV1,
  experienceValue: KoiExperienceStateV1,
  options: { leagueEnabled: boolean; weekKey?: string } = { leagueEnabled: false },
): KoiDojoCompletionResult {
  if (session.currentRound !== session.questionContentIds.length) {
    throw new Error('Finish all five Koi dojo rounds before collecting the result.');
  }
  const score = session.correctContentIds.length;
  if (experienceValue.dojo.lastRewardedSessionId === session.sessionId) {
    return {
      applied: false,
      score,
      coinReward: 0,
      bondReward: 0,
      leaguePointReward: 0,
      petSnapshot,
      experience: experienceValue,
    };
  }
  const weekKey = options.weekKey ?? getKoiWeekKey();
  const experience = rollKoiLeagueWeek(experienceValue, weekKey);
  const coinReward = 5 + (score * 2);
  const bondReward = 1;
  const proposedLeagueReward = options.leagueEnabled ? 10 + (score * 2) : 0;
  const availableLeaguePoints = Math.max(0, KOI_LEAGUE_POINT_CAP - experience.league.weeklyPoints);
  const leaguePointReward = Math.min(proposedLeagueReward, availableLeaguePoints);
  return {
    applied: true,
    score,
    coinReward,
    bondReward,
    leaguePointReward,
    petSnapshot: {
      ...petSnapshot,
      revision: petSnapshot.revision + 1,
      coins: petSnapshot.coins + coinReward,
      bond: Math.min(1_000, petSnapshot.bond + bondReward),
    },
    experience: {
      ...experience,
      dojo: {
        completedSessions: experience.dojo.completedSessions + 1,
        bestScore: Math.max(experience.dojo.bestScore, score),
        lastRewardedSessionId: session.sessionId,
      },
      league: {
        ...experience.league,
        weeklyPoints: experience.league.weeklyPoints + leaguePointReward,
      },
    },
  };
}

function stableWeekSeed(weekKey: string): number {
  return Array.from(weekKey).reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 997, 17);
}

export function buildGentleKoiLeagueStandings(
  experience: KoiExperienceStateV1,
  weekKey: string = getKoiWeekKey(),
): KoiLeagueStanding[] {
  const current = rollKoiLeagueWeek(experience, weekKey);
  const seed = stableWeekSeed(weekKey);
  const aliases = ['Sakura Finch', 'Mossy Lantern', 'Silver Tanuki', 'Paper Crane', 'Moon Rabbit'];
  const companions = aliases.map((alias, index) => ({
    alias,
    points: 28 + (index * 31) + ((seed + index * 13) % 24),
    isLearner: false,
  }));
  return [
    ...companions,
    { alias: current.league.alias, points: current.league.weeklyPoints, isLearner: true },
  ].sort((left, right) => right.points - left.points || left.alias.localeCompare(right.alias));
}

/** Creates a user-readable export and intentionally excludes retry queues and internal tombstones. */
export function buildKoiLocalDataExport(
  state: KoiSenseiLocalStateV1,
  exportedAt: number = Date.now(),
): string {
  return JSON.stringify({
    exportSchemaVersion: 1,
    exportedAt,
    koiSensei: {
      eligibility: state.eligibility,
      draft: state.draft,
      preferences: state.preferences,
      petSnapshot: state.petSnapshot,
      messages: state.messages,
      experience: state.experience,
      activeDojoSession: state.activeDojoSession,
    },
  }, null, 2);
}
