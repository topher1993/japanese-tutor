import { describe, expect, it } from 'vitest';

import { createStudyPlanTracker } from '../src/services/studyPlanService';

describe('Phase 20C daily streak / study plan', () => {
  it('starts at zero streak', () => {
    const tracker = createStudyPlanTracker();
    expect(tracker.getStreak()).toBe(0);
  });

  it('increments streak when study session is logged for today', () => {
    const tracker = createStudyPlanTracker();
    tracker.logStudy(new Date(2026, 5, 20, 10), 30);
    expect(tracker.getStreak(new Date(2026, 5, 20, 23, 59))).toBe(1);
  });

  it('breaks streak when a day is skipped', () => {
    const tracker = createStudyPlanTracker();
    tracker.logStudy(new Date(2026, 5, 20, 10), 30);
    tracker.logStudy(new Date(2026, 5, 22, 10), 30);
    expect(tracker.getStreak(new Date(2026, 5, 22, 23, 59))).toBe(1);
  });

  it('accumulates consecutive days into streak', () => {
    const tracker = createStudyPlanTracker();
    tracker.logStudy(new Date(2026, 5, 18, 10), 20);
    tracker.logStudy(new Date(2026, 5, 19, 10), 25);
    tracker.logStudy(new Date(2026, 5, 20, 10), 30);
    expect(tracker.getStreak(new Date(2026, 5, 20, 23, 59))).toBe(3);
  });

  it('produces a daily plan with N5 tasks', () => {
    const tracker = createStudyPlanTracker();
    const plan = tracker.buildDailyPlan('N5');
    expect(plan.level).toBe('N5');
    expect(plan.tasks.length).toBeGreaterThan(0);
    for (const t of plan.tasks) {
      expect(t.title.trim().length).toBeGreaterThan(0);
    }
  });

  it('produces a foundation plan without a kanji task for absolute beginners', () => {
    const tracker = createStudyPlanTracker();
    const plan = tracker.buildDailyPlan('Absolute Beginner');
    expect(plan.level).toBe('Absolute Beginner');
    expect(plan.tasks.some(task => task.category === 'listening')).toBe(true);
    expect(plan.tasks.some(task => task.category === 'kanji')).toBe(false);
  });
});
