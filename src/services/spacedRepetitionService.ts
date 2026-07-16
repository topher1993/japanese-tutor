import { addLocalDateDays, localCalendarDayDifference, localDateKey } from '../utils/localDate';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewCard {
  id: string;
  refId: string;
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  dueOn: string;
  lastReviewedOn: string | null;
  /**
   * Phase 51: interactional card-stages state machine.
   * `'seen'` — freshly created (default on `createCard`).
   * `'recognized'` — first Daily Rush hit, slow.
   * `'memorized'` — first Daily Rush hit, fast (≤ baseline), OR legacy row
   *   upgraded via `kv_srs_cards.stage` DEFAULT `'memorized'`.
   * Pre-memorized cards (`'seen'` / `'recognized'`) bypass the SM-2 math; only
   * `'memorized'` enters the review queue.
   */
  stage: 'seen' | 'recognized' | 'memorized';
}

export interface SpacedRepetitionScheduler {
  createCard(refId: string): ReviewCard;
  review(cardId: string, rating: ReviewRating): ReviewCard;
  /** Persist the learning-stage transition separately from SM-2 scheduling. */
  setStage(cardId: string, stage: ReviewCard['stage']): ReviewCard;
  dueCards(now?: Date): ReviewCard[];
  /**
   * Phase 50: cards overdue enough to be in the "catch-up" bucket.
   * Per Beru pedagogy review: returns cards where (today - dueOn)
   * crossed the 2x intervalDays threshold. Beru Q1 inclusive
   * `>=`, Q2 `Math.round(intervalDays * 0.5)` halving, applied
   * on the `dueCards()` pass so the in-memory mirror stays current.
   * Card dueOn is updated; intervalDays is NOT (spec-preserving;
   * SM-2 math on the next `review()` runs over the rescheduled
   * dueOn naturally).
   */
  overdueCatchUpCards(now?: Date): ReviewCard[];
  getCard(cardId: string): ReviewCard | undefined;
  /** Remove every card from the in-memory scheduler (Settings reset). */
  clearAll(): void;
  /**
   * Seed the scheduler with a card that already has known state. Used to
   * hydrate the in-memory mirror from SQLite on cold start so that
   * subsequent `review()` calls work without re-loading the card.
   */
  adoptCard(card: ReviewCard): void;
}

// Phase 50: integer day difference between two ISO dates (today - dueIso).
function diffDays(todayIsoStr: string, dueIso: string): number {
  return localCalendarDayDifference(todayIsoStr, dueIso);
}

export function createSpacedRepetitionScheduler(): SpacedRepetitionScheduler {
  const cards = new Map<string, ReviewCard>();
  const cardIdByRefId = new Map<string, string>();
  // Catch-up is a scheduler transition, not a date-shape heuristic. Track
  // only cards this scheduler actually rescheduled so ordinary future-due
  // cards cannot be mislabeled as catch-up work.
  const catchUpCardIds = new Set<string>();
  let counter = 0;

  function nextId(refId: string): string {
    counter += 1;
    return `card-${counter}-${refId}`;
  }

  return {
    createCard(refId: string) {
      const existingId = cardIdByRefId.get(refId);
      const existing = existingId ? cards.get(existingId) : undefined;
      if (existing) return existing;
      const id = nextId(refId);
      const card: ReviewCard = {
        id,
        refId,
        intervalDays: 0,
        repetitions: 0,
        easeFactor: 2.5,
        dueOn: localDateKey(),
        lastReviewedOn: null,
        // Phase 51: every newly-created card starts life in `'seen'`. Daily
        // Rush is the only path that advances it to `'recognized'` /
        // `'memorized'`. See SKILL jt-interactional-card-stages §State
        // transitions.
        stage: 'seen',
      };
      cards.set(id, card);
      cardIdByRefId.set(refId, id);
      return card;
    },
    review(cardId: string, rating: ReviewRating) {
      const card = cards.get(cardId);
      if (!card) throw new Error(`Card not found: ${cardId}`);
      let { intervalDays, repetitions, easeFactor } = card;

      // Map our 4-button UI to the original SuperMemo quality scale (0-5).
      // 0-2 = failure; 3+ = pass. We use 2/3/4/5 for again/hard/good/easy.
      const quality: 2 | 3 | 4 | 5 =
        rating === 'again' ? 2 : rating === 'hard' ? 3 : rating === 'good' ? 4 : 5;

      // Canonical SM-2 EF formula (Wozniak 1990, eq 3).
      // For q=4 (good) this evaluates to 0, so EF doesn't change — that's
      // the spec, not a bug.
      const newEaseFactor = Math.max(
        1.3,
        easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
      );

      let newRepetitions: number;
      let newInterval: number;

      if (quality < 3) {
        // Lapse: reset the streak, relearn tomorrow.
        newRepetitions = 0;
        newInterval = 1;
      } else {
        newRepetitions = repetitions + 1;
        if (newRepetitions === 1) {
          newInterval = 1;
        } else if (newRepetitions === 2) {
          newInterval = 6;
        } else {
          newInterval = Math.round(intervalDays * newEaseFactor);
        }
      }

      const today = localDateKey();
      const updated: ReviewCard = {
        ...card,
        repetitions: newRepetitions,
        intervalDays: newInterval,
        easeFactor: newEaseFactor,
        lastReviewedOn: today,
        dueOn: addLocalDateDays(today, newInterval),
      };
      cards.set(cardId, updated);
      catchUpCardIds.delete(cardId);
      return updated;
    },
    setStage(cardId: string, stage: ReviewCard['stage']) {
      const card = cards.get(cardId);
      if (!card) throw new Error(`Card not found: ${cardId}`);
      const updated = { ...card, stage };
      cards.set(cardId, updated);
      if (stage !== 'memorized') catchUpCardIds.delete(cardId);
      return updated;
    },
    dueCards(now: Date = new Date()) {
      const today = localDateKey(now);
      const dueCardIds: string[] = [];
      for (const card of cards.values()) {
        // New and tentative cards belong in Daily Rush until they have been
        // demonstrated as memorized. Only graduated cards enter SM-2 review.
        if (card.stage === 'memorized' && card.dueOn <= today) {
          dueCardIds.push(card.id);
          // Phase 50 catch-up rescheduler (per Beru pedagogy review Q1+Q2):
          // if overdue >= 2x intervalDays AND interval > 1, reschedule
          // in-memory. Inclusive `>=` bound (Beru Q1). Halve interval
          // via Math.round(intervalDays * 0.5) (Beru Q2). Update only dueOn;
          // do NOT touch intervalDays or lastReviewedOn (Beru Q5#1
          // analytics continuity; spec-preserving — the SM-2 math on
          // the next review() call runs over the rescheduled dueOn
          // naturally via intervalDays * easeFactor).
          const overdueDays = Math.max(0, diffDays(today, card.dueOn));
          if (overdueDays >= 2 * card.intervalDays && card.intervalDays > 1) {
            const newInterval = Math.max(1, Math.round(card.intervalDays * 0.5));
            cards.set(card.id, { ...card, dueOn: addLocalDateDays(today, newInterval) });
            catchUpCardIds.add(card.id);
          }
        }
      }
      // Catch-up scheduling mutates a card's due date above. Resolve every
      // card again from the map so callers never receive the stale pre-
      // mutation object, and omit cards that are no longer due today.
      return dueCardIds
        .map((id) => cards.get(id))
        .filter((card): card is ReviewCard => card != null && card.dueOn <= today);
    },
    overdueCatchUpCards(now: Date = new Date()): ReviewCard[] {
      const today = localDateKey(now);
      // This method is also a public scheduler entry point. Enforce the
      // catch-up transition here when callers do not invoke dueCards() first.
      for (const card of cards.values()) {
        if (card.stage !== 'memorized' || card.dueOn > today) continue;
        const overdueDays = Math.max(0, diffDays(today, card.dueOn));
        if (overdueDays >= 2 * card.intervalDays && card.intervalDays > 1) {
          const newInterval = Math.max(1, Math.round(card.intervalDays * 0.5));
          cards.set(card.id, { ...card, dueOn: addLocalDateDays(today, newInterval) });
          catchUpCardIds.add(card.id);
        }
      }
      const catchUp: ReviewCard[] = [];
      for (const cardId of catchUpCardIds) {
        const card = cards.get(cardId);
        if (!card || card.stage !== 'memorized' || card.dueOn <= today) {
          catchUpCardIds.delete(cardId);
          continue;
        }
        catchUp.push(card);
      }
      return catchUp;
    },
    getCard(cardId: string) {
      return cards.get(cardId);
    },
    clearAll() {
      cards.clear();
      cardIdByRefId.clear();
      catchUpCardIds.clear();
    },
    adoptCard(card: ReviewCard) {
      // If a card with this id already exists, leave it alone (don't clobber
      // a fresh review-in-progress). Otherwise seed the in-memory mirror
      // with the persisted state.
      if (!cards.has(card.id) && !cardIdByRefId.has(card.refId)) {
        cards.set(card.id, card);
        cardIdByRefId.set(card.refId, card.id);
      }
    },
  };
}
