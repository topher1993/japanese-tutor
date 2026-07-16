import type { SenseiLesson } from '../types/lesson';
import type { LearnerProgress } from '../types/progress';
import type { ProgressDashboard } from './progressDashboardService';
import { consecutiveIsoWeeks } from './weeklyReviewService';

export interface ProfileBadgeProgress {
  id: string;
  label: string;
  description: string;
  earned: boolean;
}

export interface ProfileHistoryItem {
  id: string;
  title: string;
  level: string;
  score?: number;
  completedAt?: string;
}

export interface ProfileProgression {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  badges: ProfileBadgeProgress[];
  recentHistory: ProfileHistoryItem[];
  nextMilestone: { label: string; remaining: number };
}

export interface ProfileProgressionExtras {
  dailyRushRuns?: number;
  dailyRushGood?: number;
}

function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 120) + 1);
}

export function buildProfileProgression(
  progress: LearnerProgress,
  lessons: SenseiLesson[],
  dashboard: ProgressDashboard,
  extras: ProfileProgressionExtras = {},
): ProfileProgression {
  const completed = new Set(progress.completedLessonIds);
  const quizXp = progress.quizScores.reduce((sum, score) => sum + Math.max(0, Math.round(score.score / 10)), 0);
  const rushXp = (extras.dailyRushGood ?? 0) * 2 + (extras.dailyRushRuns ?? 0) * 8;
  const xp = completed.size * 30 + dashboard.currentStreak * 5 + quizXp + rushXp;
  const level = levelFromXp(xp);
  const xpFloor = (level - 1) * 120;
  const xpForNextLevel = 120;
  const xpIntoLevel = xp - xpFloor;
  const recentHistory = progress.completedLessonIds
    .slice(-5)
    .reverse()
    .map(id => {
      const lesson = lessons.find(candidate => candidate.id === id);
      const latestScore = [...progress.quizScores].reverse().find(score => score.lessonId === id);
      return {
        id,
        title: lesson?.title ?? id,
        level: lesson?.level ?? 'N5',
        score: latestScore?.score,
        completedAt: latestScore?.completedAt,
      };
    });
  // Phase 45 Tier-2 / Track 2 (Beru pedagogical pick-list, Set 3):
  //   N5 = coverage-by-track across the five N5 workplace-phrase tracks
  //        (greetings / floor / schedule / safety / polite-forms). The five
  //        source-of-truth lesson IDs are the week-1 N5 lessons authored
  //        with one track each in mockSenseiLessons.
  //   N4 = N5 breadth + at least 5 total lessons completed (extends the
  //        existing `n4-unlocked` volume-based rule so N4 truly requires
  //        both breadth AND volume).
  //   N3 = N4 earned + completion of the weekly-review feature for four
  //        consecutive ISO weeks, using persisted completion stamps.
  const n5TrackLessonIds = [
    'lesson-workplace-greetings',
    'lesson-safety-stop',
    'lesson-asking-help',
    'lesson-schedule-time',
    'lesson-emergency',
  ];
  const n5Breadth = n5TrackLessonIds.every(id => completed.has(id));
  // Phase 46: N3 unlocks when N4 earned + 4 consecutive ISO weeks of
  // weekly-review completion. The counter is recorded by
  // weeklyTodoService.maybeRecordWeeklyReviewCompletion whenever the
  // weekly-todo board hits allDone (see JT-CARRY-FORWARD.md §2.1).
  const n4Earned = n5Breadth && completed.size >= 5;
  const weeklyCompletions = progress.weeklyReviewCompletions ?? [];
  const consecutiveWeeklyReviewWeeks = consecutiveIsoWeeks(weeklyCompletions);
  const badges: ProfileBadgeProgress[] = [
    { id: 'first-lesson', label: 'First lesson', description: 'Complete one lesson', earned: completed.size >= 1 },
    { id: 'seven-day-streak', label: '7-day streak', description: 'Study seven days in a row', earned: dashboard.currentStreak >= 7 },
    { id: 'daily-rush-starter', label: 'Rush starter', description: 'Finish Daily Flashcard Rush twice', earned: (extras.dailyRushRuns ?? 0) >= 2 },
    { id: 'perfect-quiz', label: 'Perfect quiz', description: 'Score 100% on a quiz', earned: progress.quizScores.some(score => score.score >= 100) },
    { id: 'n4-unlocked', label: 'N4 path', description: 'Complete at least five lessons', earned: completed.size >= 5 },
    { id: 'jlpt-n5', label: 'JLPT N5 ready', description: 'Complete all five N5 workplace-phrase tracks', earned: n5Breadth },
    { id: 'jlpt-n4', label: 'JLPT N4 path', description: 'N5 breadth + at least 5 total lessons', earned: n4Earned },
    { id: 'jlpt-n3', label: 'JLPT N3', description: 'N4 earned + weekly-review 4-week streak', earned: n4Earned && consecutiveWeeklyReviewWeeks >= 4 },
  ];
  const remaining = Math.max(0, xpForNextLevel - xpIntoLevel);
  return {
    xp,
    level,
    xpIntoLevel,
    xpForNextLevel,
    badges,
    recentHistory,
    nextMilestone: {
      label: `${remaining} XP to Level ${level + 1}`,
      remaining,
    },
  };
}
