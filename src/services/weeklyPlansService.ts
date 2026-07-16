// Phase 37b — Loader for hand-authored weekly plans.
// Per docs/phase-37-todo-gated-progression-proposal.md §3.1 the plans live
// in src/data/weeklyPlans.ts and are typed against WeekPlan from
// src/types/weeklyTodo.ts. Service is a thin lookup wrapper so swapping to a
// remote source later does not touch screens.

import { GRAMMAR_WEEKLY_PLANS, WEEKLY_PLANS } from '../data/weeklyPlans';
import type { TodoTrack, WeekPlan } from '../types/weeklyTodo';

export function getWeekPlan(weekNumber: number, track: TodoTrack = 'all'): WeekPlan | undefined {
  const plans = track === 'grammar' ? GRAMMAR_WEEKLY_PLANS : WEEKLY_PLANS;
  return plans.find(plan => plan.weekNumber === weekNumber);
}

export function getAllWeekPlans(track: TodoTrack = 'all'): WeekPlan[] {
  return [...(track === 'grammar' ? GRAMMAR_WEEKLY_PLANS : WEEKLY_PLANS)];
}
