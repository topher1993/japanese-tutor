import type { LearnerLanguage } from './onboarding';
import type { StreakState } from './progress';
import type { PlacementLevel } from '../services/placementTestService';

export type StudyGoal = 'daily-conversation' | 'workplace-survival' | 'jlpt-prep' | 'travel-basics';
export type JlptTargetLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type DailyStudyMinutes = 2 | 5 | 10 | 15 | 30;
export type AudioStudyDelayMs = 600 | 800 | 1200 | 1600;

export interface WorkplaceProfile {
  /** Free text is intentionally capped by the service before persistence. */
  industry: string;
  role: string;
  commonSituations: string[];
}

export interface UserProfileStatic {
  supportLanguage: LearnerLanguage;
  studyGoal: StudyGoal;
  /** `workplace-survival` replaces Beru's draft `workplace` goal label. */
  workplace: WorkplaceProfile | null;
  jlptTarget: JlptTargetLevel | null;
  dailyStudyMinutes: DailyStudyMinutes;
  audioStudyDelayMs: AudioStudyDelayMs;
}

export interface DailyRushProfileStats {
  totalRuns: number;
  totalGood: number;
  totalAgain: number;
  totalXpEarned: number;
  lastCompletedDate?: string;
  lastSummary?: {
    total: number;
    good: number;
    again: number;
    xpEarned: number;
    accuracyPercent: number;
  };
}

export interface PlacementProfile {
  level: PlacementLevel;
  scorePercent: number;
  completedAt: string;
  testVersion: string;
}

export interface UserProfileDynamic {
  xp: number;
  streak: StreakState;
  dailyRush: DailyRushProfileStats;
  lastStudyActivityAt?: string;
  placement?: PlacementProfile;
  placementPromptDismissed?: boolean;
}

export interface UserProfileMeta {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  migratedFrom?: 'onboarding-preference-v1';
}

export interface UserProfile {
  onboarded: boolean;
  static: UserProfileStatic;
  dynamic: UserProfileDynamic;
  meta: UserProfileMeta;
}

export type UserProfilePatch = Partial<{
  onboarded: boolean;
  static: Partial<UserProfileStatic>;
  dynamic: Partial<UserProfileDynamic>;
}>;
