import { describe, expect, it } from 'vitest';

import {
  betaFeedbackScreenOptions,
  buildFirstPolishSprint,
  summarizeSprintReadiness,
} from '../src/services/betaPolishSprintService';
import type { BetaFeedbackEntry } from '../src/types/betaFeedback';

function feedback(overrides: Partial<BetaFeedbackEntry>): BetaFeedbackEntry {
  return {
    screen: 'Lessons',
    rating: 4,
    note: 'Looks good',
    createdAt: '2026-06-18',
    ...overrides,
  };
}

describe('Phase 14 first beta polish sprint', () => {
  it('offers fixed screen options so tester notes stay consistent', () => {
    expect(betaFeedbackScreenOptions).toEqual([
      'Home',
      'Lessons',
      'Flashcards',
      'Workplace Survival',
      'Quiz',
      'Progress',
      'Beta Feedback',
      'Onboarding',
    ]);
  });

  it('promotes blockers and important feedback into the active sprint before minor/content backlog', () => {
    const sprint = buildFirstPolishSprint([
      feedback({ screen: 'Quiz', rating: 4, severity: 'minor', category: 'learning-flow', note: 'More encouragement' }),
      feedback({ screen: 'Lessons', rating: 1, category: 'bug', note: 'Cannot open first lesson' }),
      feedback({ screen: 'Home', rating: 2, category: 'device-layout', note: 'Title is close to the phone status bar' }),
      feedback({ screen: 'Workplace Survival', rating: 5, category: 'content', note: 'Add cafeteria phrase' }),
    ], { capacity: 2 });

    expect(sprint.activeItems.map(item => item.screen)).toEqual(['Lessons', 'Home']);
    expect(sprint.backlogItems.map(item => item.screen)).toEqual(['Quiz', 'Workplace Survival']);
    expect(sprint.activeItems[0]).toMatchObject({ status: 'ready-to-fix', action: 'fix-before-beta' });
    expect(sprint.activeItems[1]).toMatchObject({ status: 'ready-to-polish', action: 'schedule-next-polish-pass' });
  });

  it('summarizes readiness for beta release decisions', () => {
    expect(summarizeSprintReadiness(buildFirstPolishSprint([]))).toBe('No beta feedback captured yet. Continue tester intake.');

    expect(summarizeSprintReadiness(buildFirstPolishSprint([
      feedback({ screen: 'Lessons', rating: 1, category: 'bug', note: 'Crash' }),
    ]))).toBe('Resolve 1 blocker before beta expansion.');

    expect(summarizeSprintReadiness(buildFirstPolishSprint([
      feedback({ screen: 'Home', rating: 2, category: 'device-layout', note: 'Spacing issue' }),
    ]))).toBe('Polish 1 important issue before broad beta.');

    expect(summarizeSprintReadiness(buildFirstPolishSprint([
      feedback({ screen: 'Quiz', rating: 5, severity: 'minor', category: 'ui-polish', note: 'Nice-to-have animation' }),
    ]))).toBe('No blockers or important issues. Safe to continue beta while monitoring minor polish.');
  });
});
