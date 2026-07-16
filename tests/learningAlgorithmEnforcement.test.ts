import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createInMemorySrsStore } from '../src/services/persistentSrsStore';
import { createSpacedRepetitionScheduler } from '../src/services/spacedRepetitionService';

describe('learning algorithm enforcement', () => {
  it('keeps exactly one SRS scheduling record per learning refId', () => {
    const scheduler = createSpacedRepetitionScheduler();
    const first = scheduler.createCard('same-learning-item');
    const repeated = scheduler.createCard('same-learning-item');

    expect(repeated.id).toBe(first.id);
    expect(scheduler.dueCards()).toHaveLength(0); // still stage=seen
  });

  it('clears both persistent-list and in-memory SRS state on reset', async () => {
    const srs = createInMemorySrsStore();
    const card = srs.createCard('reset-me');
    await srs.setStage(card.id, 'memorized');
    expect(srs.getCard(card.id)).toBeDefined();

    await srs.clearAll();

    expect(await srs.listCards()).toEqual([]);
    expect(srs.getCard(card.id)).toBeUndefined();
    expect(await srs.dueCount()).toBe(0);
  });

  it('does not mark flashcard ids as completed lessons or demote memorized successes', () => {
    const source = readFileSync('src/screens/FlashcardsScreen.tsx', 'utf8');
    expect(source).not.toContain('completeCurrentLesson(card.id');
    expect(source).toContain("srs.getCard(cardId)?.stage === 'memorized'");
    expect(source).toContain("? 'memorized'");
  });

  it('records Daily Rush stage advancement and blocks zero-card completion', () => {
    const source = readFileSync('src/screens/DailyRushScreen.tsx', 'utf8');
    expect(source).toContain('recordCardStageAdvanced(weekNumber, cardRefId, nextStage)');
    expect(source).toContain('effectiveRush.cards.length === 0');
    expect(source).toContain('All caught up');
  });
});
