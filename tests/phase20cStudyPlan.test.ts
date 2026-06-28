import { describe, expect, it } from 'vitest';

import { createStudyPlanTracker } from '../src/services/studyPlanService';

describe('Phase 20C daily streak / study plan', () => {
  it('starts at zero streak', () => {
    const tracker = createStudyPlanTracker();
    expect(tracker.getStreak()).toBe(0);
  });

  it('increments streak when study session is logged for today', () => {
    const tracker = createStudyPlanTracker();
    tracker.logStudy(new Date('2026-06-20T10:00:00Z'), 30);
    expect(tracker.getStreak(new Date('2026-06-20T23:59:00Z'))).toBe(1);
  });

  it('breaks streak when a day is skipped', () => {
    const tracker = createStudyPlanTracker();
    tracker.logStudy(new Date('2026-06-20T10:00:00Z'), 30);
    tracker.logStudy(new Date('2026-06-22T10:00:00Z'), 30);
    expect(tracker.getStreak(new Date('2026-06-22T23:59:00Z'))).toBe(1);
  });

  it('accumulates consecutive days into streak', () => {
    const tracker = createStudyPlanTracker();
    tracker.logStudy(new Date('2026-06-18T10:00:00Z'), 20);
    tracker.logStudy(new Date('2026-06-19T10:00:00Z'), 25);
    tracker.logStudy(new Date('2026-06-20T10:00:00Z'), 30);
    expect(tracker.getStreak(new Date('2026-06-20T23:59:00Z'))).toBe(3);
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
});