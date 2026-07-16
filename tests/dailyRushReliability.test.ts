import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { createFlashcardDeck } from '../src/services/flashcardService';
import { getAllLessons } from '../src/services/lessonService';
import {
  answerDailyRushCard,
  buildDailyFlashcardRush,
  buildDailyRushRetryCard,
  buildSrsReviewTelemetry,
  getDailyRushRetryDecision,
  persistDailyRushCompletionWrites,
  summarizeDailyRush,
} from '../src/services/dailyFlashcardRushService';
import type { ReviewCard } from '../src/services/spacedRepetitionService';

describe('Daily Rush reliability', () => {
  it('requeues the first miss and reaches the cap on the second miss', () => {
    const firstMiss = getDailyRushRetryDecision(false, 0, 2);
    expect(firstMiss).toEqual({ appearanceCount: 1, requeue: true, capped: false });

    const secondMiss = getDailyRushRetryDecision(false, firstMiss.appearanceCount, 2);
    expect(secondMiss).toEqual({ appearanceCount: 2, requeue: false, capped: true });

    expect(getDailyRushRetryDecision(true, 0, 2)).toEqual({
      appearanceCount: 1,
      requeue: false,
      capped: false,
    });
  });

  it('builds a distinct retry appearance and moves the correct-answer position', () => {
    const rush = buildDailyFlashcardRush(createFlashcardDeck(getAllLessons()), {
      date: '2026-07-14',
      supportLanguage: 'en',
    });
    const original = rush.cards[0];
    const retry = buildDailyRushRetryCard(original, rush.cards.length + 1, 2);

    expect(retry.id).not.toBe(original.id);
    expect(retry.position).toBe(rush.cards.length + 1);
    expect(retry.card.id).toBe(original.card.id);
    expect(retry.choices.findIndex(choice => choice.correct))
      .not.toBe(original.choices.findIndex(choice => choice.correct));

    const wrongChoice = original.choices.find(choice => !choice.correct)!;
    const firstResult = answerDailyRushCard(original, wrongChoice.id);
    const retryCorrect = retry.choices.find(choice => choice.correct)!;
    const retryResult = answerDailyRushCard(retry, retryCorrect.id);
    expect(firstResult.appearanceId).toBe(original.id);
    expect(retryResult.appearanceId).toBe(retry.id);
    // A retry is retrieval practice, not an XP-farming second result.
    expect(summarizeDailyRush([firstResult, retryResult])).toMatchObject({
      total: 1,
      good: 0,
      again: 1,
      xpEarned: firstResult.xpEarned,
    });
  });

  it('awaits todo persistence before profile/XP and propagates either failure', async () => {
    const order: string[] = [];
    await persistDailyRushCompletionWrites({
      persistTodo: async () => { order.push('todo'); },
      persistProfile: async () => { order.push('profile'); },
    });
    expect(order).toEqual(['todo', 'profile']);

    const profileAfterTodoFailure = vi.fn(async () => undefined);
    await expect(persistDailyRushCompletionWrites({
      persistTodo: async () => { throw new Error('todo failed'); },
      persistProfile: profileAfterTodoFailure,
    })).rejects.toThrow('todo failed');
    expect(profileAfterTodoFailure).not.toHaveBeenCalled();

    await expect(persistDailyRushCompletionWrites({
      persistTodo: async () => undefined,
      persistProfile: async () => { throw new Error('profile failed'); },
    })).rejects.toThrow('profile failed');
  });

  it('builds production SRS review telemetry from the actual pre/post rows', () => {
    const before: ReviewCard = {
      id: 'srs-1', refId: 'card-1', intervalDays: 3, repetitions: 2,
      easeFactor: 2.5, dueOn: '2026-07-08', lastReviewedOn: '2026-07-05', stage: 'seen',
    };
    const after: ReviewCard = {
      ...before, intervalDays: 1, repetitions: 0, easeFactor: 2.18,
      dueOn: '2026-07-15', lastReviewedOn: '2026-07-14',
    };
    expect(buildSrsReviewTelemetry('card-1', 'again', before, after, '2026-07-14')).toEqual({
      card_id: 'card-1',
      rating: 'again',
      pre_ease: 2.5,
      post_ease: 2.18,
      pre_interval: 3,
      post_interval: 1,
      reps: 0,
      overdue_days: 6,
      overdue_state: 'catch_up_handled',
    });
  });

  it('shows a retryable error and never claims XP before all writes succeed', () => {
    const source = readFileSync('src/screens/DailyRushScreen.tsx', 'utf8');
    expect(source).toContain("setCompletionStatus('error')");
    expect(source).toContain('label="Retry save"');
    expect(source).toContain("'XP not saved'");
    expect(source).toContain("'XP pending save'");
    expect(source).toContain("track('srs_review'");
    expect(source).toContain('disabled={completionStatus === \'saving\'}');
  });
});
