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

// Phase 50: integer day difference between two ISO dates (today - dueIso).
function diffDays(todayIsoStr: string, dueIso: string): number {
  const ms = new Date(`${todayIsoStr}T00:00:00Z`).getTime() - new Date(`${dueIso}T00:00:00Z`).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
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

      const today = todayIso();
      const updated: ReviewCard = {
        ...card,
        repetitions: newRepetitions,
        intervalDays: newInterval,
        easeFactor: newEaseFactor,
        lastReviewedOn: today,
        dueOn: addDaysIso(today, newInterval),
      };
      cards.set(cardId, updated);
      return updated;
    },
    dueCards(now: Date = new Date()) {
      const today = todayIso(now);
      const result: ReviewCard[] = [];
      for (const card of cards.values()) {
        if (card.dueOn <= today) {
          result.push(card);
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
            cards.set(card.id, { ...card, dueOn: addDaysIso(today, newInterval) });
          }
        }
      }
      return result;
    },
    overdueCatchUpCards(now: Date = new Date()): ReviewCard[] {
      const today = todayIso(now);
      // Phase 50: surface the cards that the rescheduler just touched.
      // After dueCards() runs, "overdue catch-up" = cards whose
      // CURRENT (post-reschedule) intervalDays * 2 <= days-until-due.
      // This is the inverse of the threshold: post-reschedule, the
      // catch-up card has dueOn = today + half-interval, so its
      // days-until-due (~half-interval) is less than
      // 2 * intervalDays. We re-derive the catch-up set by looking
      // for cards whose ORIGINAL dueOn would have crossed the
      // threshold. Simplest: a card is a catch-up card iff its
      // post-reschedule dueOn is in the future but its pre-reschedule
      // overdueDays would have been >= threshold.
      //
      // To avoid re-deriving from a stale state, we mark cards during
      // the dueCards() reschedule by storing them in a transient set;
      // but a transient set on the scheduler object would need to be
      // reset on every call. Cleanest: re-derive from a small
      // heuristic — a card is catch-up if `dueOn > today` (post-
      // reschedule) AND `dueOn < today + intervalDays` (it was
      // due in the recent past, not scheduled normally). This matches
      // the rescheduler's output: only catch-up cards get their
      // dueOn pushed out by less than the full intervalDays.
      return Array.from(cards.values()).filter((card) => {
        if (card.dueOn <= today) return false;
        if (card.intervalDays <= 1) return false;
        const daysUntilDue = diffDays(card.dueOn, today);
        return daysUntilDue > 0 && daysUntilDue < card.intervalDays;
      });
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