import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildProgressDashboard } from '../src/services/progressDashboardService';
import { getAllLessons } from '../src/services/lessonService';
import type { LearnerProgress } from '../src/types/progress';

const progressSource = readFileSync('src/screens/ProgressScreen.tsx', 'utf8');
const studyPlanSource = readFileSync('src/services/studyPlanService.ts', 'utf8');
const screenScaffoldSource = readFileSync('src/components/ScreenScaffold.tsx', 'utf8');

describe('Phase 37 Progress tab bug fixes', () => {
  it('counts only real bundled lesson ids once in the progress dashboard', () => {
    const lessons = getAllLessons();
    const progress: LearnerProgress = {
      startedAt: '2026-07-01',
      completedLessonIds: [lessons[0].id, lessons[0].id, 'deleted-or-stale-lesson-id'],
      quizScores: [],
      streak: { currentStreak: 0, longestStreak: 0 },
    };

    const dashboard = buildProgressDashboard(progress, lessons);

    expect(dashboard.completedLessons).toBe(1);
    expect(dashboard.completionPercent).toBe(Math.round((1 / lessons.length) * 100));
    expect(dashboard.nextRecommendedLesson?.id).toBe(lessons[1].id);
  });

  it('does not ship hard-coded earned achievements on the Progress tab', () => {
    expect(progressSource).not.toContain("earned: true");
    expect(progressSource).toContain('buildProfileProgression');
    expect(progressSource).toContain('progression.badges');
    expect(progressSource).toContain('PROFILE_BADGE_TO_IMAGE');
  });

  it('builds the Progress daily plan from the learner profile target instead of hard-coded N5', () => {
    expect(progressSource).toContain('useUserProfileContext');
    expect(progressSource).toContain('planLevel');
    expect(progressSource).toContain('tracker.buildDailyPlan(planLevel)');
    expect(progressSource).not.toContain("tracker.buildDailyPlan('N5')");
    expect(studyPlanSource).toContain("| 'N1'");
  });

  it('leaves enough scroll padding for the bottom tab bar to not cover Progress content', () => {
    expect(screenScaffoldSource).toContain('paddingBottom: ds.spacing.xxl * 3');
    expect(screenScaffoldSource).not.toContain('paddingBottom: ds.spacing.lg');
  });
});
