import type { BetaFeedbackCategory, BetaFeedbackEntry, BetaFeedbackSeverity } from '../types/betaFeedback';

export const feedbackSeverities = ['blocker', 'important', 'minor'] as const satisfies readonly BetaFeedbackSeverity[];
export const feedbackCategories = ['ui-polish', 'content', 'device-layout', 'learning-flow', 'bug'] as const satisfies readonly BetaFeedbackCategory[];

export type BetaFeedbackAction = 'fix-before-beta' | 'schedule-next-polish-pass' | 'queue-for-content-expansion' | 'monitor';

export interface ClassifiedBetaFeedback extends Omit<BetaFeedbackEntry, 'severity' | 'category'> {
  severity: BetaFeedbackSeverity;
  category: BetaFeedbackCategory;
  action: BetaFeedbackAction;
  priority: number;
}

export interface FeedbackPolishQueue {
  items: ClassifiedBetaFeedback[];
  summary: Record<BetaFeedbackSeverity, number>;
  nextAction: string;
}

function inferCategory(entry: BetaFeedbackEntry): BetaFeedbackCategory {
  if (entry.category) return entry.category;
  const note = entry.note.toLowerCase();
  if (note.includes('status bar') || note.includes('phone') || note.includes('screen') || note.includes('layout')) return 'device-layout';
  if (note.includes('phrase') || note.includes('japanese') || note.includes('translation') || note.includes('vocabulary')) return 'content';
  if (note.includes('quiz') || note.includes('lesson') || note.includes('practice')) return 'learning-flow';
  if (note.includes('crash') || note.includes('cannot') || note.includes('error')) return 'bug';
  return 'ui-polish';
}

function inferSeverity(entry: BetaFeedbackEntry): BetaFeedbackSeverity {
  if (entry.rating <= 1) return 'blocker';
  if (entry.rating <= 3) return 'important';
  return entry.severity ?? 'minor';
}

function actionFor(severity: BetaFeedbackSeverity, category: BetaFeedbackCategory): BetaFeedbackAction {
  if (severity === 'blocker') return 'fix-before-beta';
  if (category === 'content') return 'queue-for-content-expansion';
  if (severity === 'important') return 'schedule-next-polish-pass';
  return 'monitor';
}

function priorityFor(severity: BetaFeedbackSeverity): number {
  if (severity === 'blocker') return 1;
  if (severity === 'important') return 2;
  return 3;
}

export function classifyBetaFeedbackEntry(entry: BetaFeedbackEntry): ClassifiedBetaFeedback {
  const severity = inferSeverity(entry);
  const category = inferCategory(entry);
  return {
    ...entry,
    severity,
    category,
    action: actionFor(severity, category),
    priority: priorityFor(severity),
  };
}

export function buildFeedbackPolishQueue(entries: BetaFeedbackEntry[]): FeedbackPolishQueue {
  const items = entries
    .map(classifyBetaFeedbackEntry)
    .sort((left, right) => left.priority - right.priority || left.createdAt.localeCompare(right.createdAt) || left.screen.localeCompare(right.screen));

  const summary = items.reduce<Record<BetaFeedbackSeverity, number>>(
    (counts, item) => ({ ...counts, [item.severity]: counts[item.severity] + 1 }),
    { blocker: 0, important: 0, minor: 0 },
  );

  const nextAction = summary.blocker > 0
    ? `Resolve ${summary.blocker} beta blocker before expanding features.`
    : summary.important > 0
      ? `Schedule ${summary.important} important polish item before broad beta.`
      : 'Continue beta and monitor minor polish/content requests.';

  return { items, summary, nextAction };
}
