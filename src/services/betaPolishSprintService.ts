import { buildFeedbackPolishQueue, type ClassifiedBetaFeedback } from './betaFeedbackTriageService';
import type { BetaFeedbackEntry, BetaFeedbackSeverity } from '../types/betaFeedback';

export const betaFeedbackScreenOptions = [
  'Home',
  'Lessons',
  'Flashcards',
  'Workplace Survival',
  'Quiz',
  'Progress',
  'Beta Feedback',
  'Onboarding',
] as const;

export type BetaFeedbackScreenOption = typeof betaFeedbackScreenOptions[number];
export type PolishSprintStatus = 'ready-to-fix' | 'ready-to-polish' | 'queued-for-later';

export interface PolishSprintItem extends ClassifiedBetaFeedback {
  status: PolishSprintStatus;
}

export interface FirstPolishSprint {
  activeItems: PolishSprintItem[];
  backlogItems: PolishSprintItem[];
  summary: Record<BetaFeedbackSeverity, number>;
  capacity: number;
}

function statusFor(item: ClassifiedBetaFeedback, active: boolean): PolishSprintStatus {
  if (!active) return 'queued-for-later';
  if (item.severity === 'blocker') return 'ready-to-fix';
  return 'ready-to-polish';
}

export function buildFirstPolishSprint(
  entries: BetaFeedbackEntry[],
  options: { capacity?: number } = {},
): FirstPolishSprint {
  const capacity = options.capacity ?? 3;
  const queue = buildFeedbackPolishQueue(entries);
  const activeItems = queue.items.slice(0, capacity).map(item => ({ ...item, status: statusFor(item, true) }));
  const backlogItems = queue.items.slice(capacity).map(item => ({ ...item, status: statusFor(item, false) }));

  return {
    activeItems,
    backlogItems,
    summary: queue.summary,
    capacity,
  };
}

export function summarizeSprintReadiness(sprint: FirstPolishSprint): string {
  const total = sprint.summary.blocker + sprint.summary.important + sprint.summary.minor;
  if (total === 0) return 'No beta feedback captured yet. Continue tester intake.';
  if (sprint.summary.blocker > 0) return `Resolve ${sprint.summary.blocker} blocker before beta expansion.`;
  if (sprint.summary.important > 0) return `Polish ${sprint.summary.important} important issue before broad beta.`;
  return 'No blockers or important issues. Safe to continue beta while monitoring minor polish.';
}
