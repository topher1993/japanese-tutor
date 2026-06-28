import { describe, expect, it } from 'vitest';

import { createSpacedRepetitionScheduler } from '../src/services/spacedRepetitionService';

describe('Phase 20B spaced repetition review', () => {
  it('schedules a card with default 1-day interval on first correct', () => {
    const scheduler = createSpacedRepetitionScheduler();
    const card = scheduler.createCard('vocab-1');
    const reviewed = scheduler.review(card.id, 'good');
    expect(reviewed.intervalDays).toBe(1);
    expect(reviewed.repetitions).toBe(1);
  });

  it('graduates to longer intervals after consecutive correct reviews', () => {
    const scheduler = createSpacedRepetitionScheduler();
    const card = scheduler.createCard('vocab-2');
    let reviewed = scheduler.review(card.id, 'good');
    reviewed = scheduler.review(reviewed.id, 'good');
    reviewed = scheduler.review(reviewed.id, 'good');
    expect(reviewed.intervalDays).toBeGreaterThanOrEqual(3);
    expect(reviewed.repetitions).toBe(3);
  });

  it('resets repetitions when a card is answered poorly', () => {
    const scheduler = createSpacedRepetitionScheduler();
    const card = scheduler.createCard('vocab-3');
    let reviewed = scheduler.review(card.id, 'good');
    reviewed = scheduler.review(reviewed.id, 'good');
    reviewed = scheduler.review(reviewed.id, 'again');
    expect(reviewed.repetitions).toBe(0);
    expect(reviewed.intervalDays).toBeLessThanOrEqual(1);
  });

  it('returns due cards based on today', () => {
    const scheduler = createSpacedRepetitionScheduler();
    scheduler.createCard('c-1');
    scheduler.createCard('c-2');
    const due = scheduler.dueCards();
    expect(due.length).toBe(2);
  });
});