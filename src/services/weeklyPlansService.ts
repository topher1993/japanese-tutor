// Phase 37b — Loader for hand-authored weekly plans.
// Per docs/phase-37-todo-gated-progression-proposal.md §3.1 the plans live
// in src/data/weeklyPlans.ts and are typed against WeekPlan from
// src/types/weeklyTodo.ts. Service is a thin lookup wrapper so swapping to a
// remote source later does not touch screens.

import { WEEKLY_PLANS } from '../data/weeklyPlans';
import type { WeekPlan } from '../types/weeklyTodo';

export function getWeekPlan(weekNumber: number): WeekPlan | undefined {
  return WEEKLY_PLANS.find(plan => plan.weekNumber === weekNumber);
}

export function getAllWeekPlans(): WeekPlan[] {
  return [...WEEKLY_PLANS];
}
