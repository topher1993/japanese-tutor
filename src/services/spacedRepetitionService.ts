export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewCard {
  id: string;
  refId: string;
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  dueOn: string;
  lastReviewedOn: string | null;
}

export interface SpacedRepetitionScheduler {
  createCard(refId: string): ReviewCard;
  review(cardId: string, rating: ReviewRating): ReviewCard;
  dueCards(now?: Date): ReviewCard[];
  getCard(cardId: string): ReviewCard | undefined;
  /**
   * Seed the scheduler with a card that already has known state. Used to
   * hydrate the in-memory mirror from SQLite on cold start so that
   * subsequent `review()` calls work without re-loading the card.
   */
  adoptCard(card: ReviewCard): void;
}

function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function createSpacedRepetitionScheduler(): SpacedRepetitionScheduler {
  const cards = new Map<string, ReviewCard>();
  let counter = 0;

  function nextId(refId: string): string {
    counter += 1;
    return `card-${counter}-${refId}`;
  }

  return {
    createCard(refId: string) {
      const id = nextId(refId);
      const card: ReviewCard = {
        id,
        refId,
        intervalDays: 0,
        repetitions: 0,
        easeFactor: 2.5,
        dueOn: todayIso(),
        lastReviewedOn: null,
      };
      cards.set(id, card);
      return card;
    },
    review(cardId: string, rating: ReviewRating) {
      const card = cards.get(cardId);
      if (!card) throw new Error(`Card not found: ${cardId}`);
      let { intervalDays, repetitions, easeFactor } = card;
      if (rating === 'again') {
        repetitions = 0;
        intervalDays = 1;
        easeFactor = Math.max(1.3, easeFactor - 0.2);
      } else if (rating === 'hard') {
        repetitions += 1;
        intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
        easeFactor = Math.max(1.3, easeFactor - 0.15);
      } else if (rating === 'good') {
        repetitions += 1;
        intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round(intervalDays * easeFactor);
      } else {
        repetitions += 1;
        intervalDays = repetitions === 1 ? 2 : repetitions === 2 ? 5 : Math.round(intervalDays * easeFactor * 1.3);
        easeFactor = easeFactor + 0.15;
      }
      const today = todayIso();
      const updated: ReviewCard = {
        ...card,
        repetitions,
        intervalDays,
        easeFactor,
        lastReviewedOn: today,
        dueOn: addDaysIso(today, intervalDays),
      };
      cards.set(cardId, updated);
      return updated;
    },
    dueCards(now: Date = new Date()) {
      const today = todayIso(now);
      return Array.from(cards.values()).filter((c) => c.dueOn <= today);
    },
    getCard(cardId: string) {
      return cards.get(cardId);
    },
    adoptCard(card: ReviewCard) {
      // If a card with this id already exists, leave it alone (don't clobber
      // a fresh review-in-progress). Otherwise seed the in-memory mirror
      // with the persisted state.
      if (!cards.has(card.id)) cards.set(card.id, card);
    },
  };
}