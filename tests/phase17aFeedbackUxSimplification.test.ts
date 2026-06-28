import { describe, expect, it } from 'vitest';
import {
  buildSimpleFeedbackEntry,
  getSimpleFeedbackOptions,
  mapSimpleFeedbackToTriage,
} from '../src/services/simpleFeedbackUxService';

describe('Phase 17A feedback UX simplification', () => {
  it('shows four learner-friendly feedback choices instead of technical categories first', () => {
    expect(getSimpleFeedbackOptions().map(option => option.label)).toEqual([
      'Report a problem',
      'Confusing / hard to use',
      'Translation or Japanese issue',
      'Suggestion / idea',
    ]);
  });

  it('maps simple learner choices to internal triage without asking learners for category labels', () => {
    expect(mapSimpleFeedbackToTriage({ type: 'problem', stoppedUse: true })).toMatchObject({
      severity: 'blocker',
      category: 'bug',
    });

    expect(mapSimpleFeedbackToTriage({ type: 'problem', stoppedUse: false })).toMatchObject({
      severity: 'important',
      category: 'bug',
    });

    expect(mapSimpleFeedbackToTriage({ type: 'confusing' })).toMatchObject({
      severity: 'important',
      category: 'learning-flow',
    });

    expect(mapSimpleFeedbackToTriage({ type: 'translation' })).toMatchObject({
      severity: 'important',
      category: 'content',
    });

    expect(mapSimpleFeedbackToTriage({ type: 'suggestion' })).toMatchObject({
      severity: 'minor',
      category: 'ui-polish',
    });
  });

  it('builds a saved feedback entry from simple fields while preserving local-only triage metadata', () => {
    const entry = buildSimpleFeedbackEntry({
      type: 'translation',
      screen: 'Lessons',
      note: 'The shopping phrase translation seems strange.',
      rating: 3,
      createdAt: '2026-06-19',
    });

    expect(entry).toEqual({
      screen: 'Lessons',
      rating: 3,
      note: 'The shopping phrase translation seems strange.',
      createdAt: '2026-06-19',
      severity: 'important',
      category: 'content',
      feedbackType: 'translation',
    });
  });
});
