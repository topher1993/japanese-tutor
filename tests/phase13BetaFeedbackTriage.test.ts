import { describe, expect, it } from 'vitest';

import {
  buildFeedbackPolishQueue,
  classifyBetaFeedbackEntry,
  feedbackCategories,
  feedbackSeverities,
} from '../src/services/betaFeedbackTriageService';
import type { BetaFeedbackEntry } from '../src/types/betaFeedback';

function entry(overrides: Partial<BetaFeedbackEntry>): BetaFeedbackEntry {
  return {
    screen: 'Lessons',
    rating: 4,
    note: 'Looks good',
    createdAt: '2026-06-18',
    ...overrides,
  };
}

describe('Phase 13 beta feedback triage and polish queue', () => {
  it('supports tester-friendly severity and category labels', () => {
    expect(feedbackSeverities).toEqual(['blocker', 'important', 'minor']);
    expect(feedbackCategories).toEqual(['ui-polish', 'content', 'device-layout', 'learning-flow', 'bug']);
  });

  it('classifies feedback by explicit tester fields and rating fallback', () => {
    expect(classifyBetaFeedbackEntry(entry({ rating: 1, severity: 'minor', category: 'ui-polish' }))).toMatchObject({
      severity: 'blocker',
      category: 'ui-polish',
      action: 'fix-before-beta',
    });

    expect(classifyBetaFeedbackEntry(entry({ rating: 2, category: 'device-layout', note: 'Text touches status bar' }))).toMatchObject({
      severity: 'important',
      category: 'device-layout',
      action: 'schedule-next-polish-pass',
    });

    expect(classifyBetaFeedbackEntry(entry({ rating: 5, note: 'Please add cafeteria phrases' }))).toMatchObject({
      severity: 'minor',
      category: 'content',
      action: 'queue-for-content-expansion',
    });
  });

  it('builds a priority polish queue with blockers first and summary counts', () => {
    const queue = buildFeedbackPolishQueue([
      entry({ screen: 'Quiz', rating: 4, severity: 'minor', category: 'learning-flow', note: 'Add more encouragement' }),
      entry({ screen: 'Lessons', rating: 1, category: 'bug', note: 'Cannot open lesson' }),
      entry({ screen: 'Home', rating: 2, category: 'device-layout', note: 'Title is near phone status bar' }),
    ]);

    expect(queue.items.map(item => item.screen)).toEqual(['Lessons', 'Home', 'Quiz']);
    expect(queue.summary).toEqual({ blocker: 1, important: 1, minor: 1 });
    expect(queue.nextAction).toBe('Resolve 1 beta blocker before expanding features.');
  });
});
