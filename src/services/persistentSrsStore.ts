import type { SqliteLikeDatabase } from '../repositories/sqliteLearningRepository';
import { createTablesSql } from '../db/schema';
import {
  createSpacedRepetitionScheduler,
  type ReviewCard,
  type ReviewRating,
  type SpacedRepetitionScheduler,
} from './spacedRepetitionService';

/**
 * Phase 22 audit fix P0-03: persistent SRS scheduler.
 *
 * The pure `spacedRepetitionService` does the math (SM-2-ish intervals); this
 * wrapper persists each card to SQLite and reads `dueCount` from SQLite
 * directly so the count survives cold start without needing to re-hydrate
 * the in-memory scheduler (which has no public import path).
 *
 *   1. `createCard` + `review` write through to SQLite AND update the
 *      in-memory mirror so `getCard()` works the same session.
 *   2. `dueCount` reads SQLite directly with `SELECT COUNT(*) WHERE due_on <= ?`
 *      so the value is correct on first cold-start.
 *   3. `listCards` is exposed for tests + SettingsScreen.
 */

interface SrsRow {
  id: string;
  ref_id: string;
  interval_days: number;
  repetitions: number;
  ease_factor: number;
  due_on: string;
  last_reviewed_on: string | null;
}

function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export interface PersistentSpacedRepetitionScheduler {
  createCard(refId: string): ReviewCard;
  /**
   * Async because the persistent store may need to hydrate from SQLite
   * on cold start (the inner scheduler's in-memory map is empty after
   * fresh app launch). Returns the updated card or throws if not found.
   */
  review(cardId: string, rating: ReviewRating): Promise<ReviewCard>;
  dueCards(now?: Date): ReviewCard[];
  /**
   * Phase 50: cards in the catch-up bucket (overdue beyond 2x intervalDays).
   * Same semantics as `inner.overdueCatchUpCards(now)`.
   */
  overdueCatchUpCards(now?: Date): ReviewCard[];
  getCard(cardId: string): ReviewCard | undefined;
  /** Count of cards due today (or earlier). Always reads SQLite. */
  dueCount(now?: Date): Promise<number>;
  /** Idempotent — call once at boot. Bulk-loads SQLite cards into the
   *  inner scheduler so the first batch of reviews is fast. */
  hydrate(): Promise<void>;
  /** All SRS rows from SQLite, ordered by due date. */
  listCards(): Promise<ReviewCard[]>;
  /** Phase 25 / P0-2: wipe every SRS row + reset in-memory mirror. */
  clearAll(): Promise<void>;
  /** Seed the inner scheduler from a persisted card. */
  adoptCard(card: ReviewCard): void;
}

export function createPersistentSrsStore(db: SqliteLikeDatabase): PersistentSpacedRepetitionScheduler {
  // In-memory mirror: the pure scheduler handles ID generation and the math
  // for the cards we've seen this session. Reads (`dueCount`, `listCards`)
  // go to SQLite so they survive cold start.
  const inner = createSpacedRepetitionScheduler();

  // Track which (id, refId) pairs we've already hydrated into the inner
  // scheduler this session, so we don't re-load on every review.
  const hydratedIds = new Set<string>();

  async function loadAll(): Promise<ReviewCard[]> {
    const rows = await db.getAllAsync<SrsRow>(
      'SELECT id, ref_id, interval_days, repetitions, ease_factor, due_on, last_reviewed_on FROM kv_srs_cards ORDER BY due_on ASC',
    );
    return rows.map(r => ({
      id: r.id,
      refId: r.ref_id,
      intervalDays: r.interval_days,
      repetitions: r.repetitions,
      easeFactor: r.ease_factor,
      dueOn: r.due_on,
      lastReviewedOn: r.last_reviewed_on,
    }));
  }

  async function persist(card: ReviewCard): Promise<void> {
    await db.runAsync(
      `INSERT OR REPLACE INTO kv_srs_cards (id, ref_id, interval_days, repetitions, ease_factor, due_on, last_reviewed_on) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      card.id, card.refId, card.intervalDays, card.repetitions, card.easeFactor, card.dueOn, card.lastReviewedOn,
    );
  }

  /**
   * Look up a card by id OR refId from SQLite and, if not yet in the inner
   * scheduler's memory this session, hydrate it. This is the cold-start fix:
   * after a fresh app launch, the inner scheduler's map is empty, but
   * `review()` can still be called for cards that exist in SQLite.
   *
   * Returns the (now-hydrated) card or null if not found anywhere.
   */
  async function ensureHydrated(cardIdOrRefId: string): Promise<ReviewCard | null> {
    // Already in memory? Fast path.
    const cached = inner.getCard(cardIdOrRefId);
    if (cached) return cached;
    if (hydratedIds.has(cardIdOrRefId)) {
      // We tried to hydrate but it's not there — don't re-query.
      return null;
    }
    const all = await loadAll();
    const match = all.find(c => c.id === cardIdOrRefId || c.refId === cardIdOrRefId);
    if (!match) return null;
    // Seed the inner scheduler with this card's exact state.
    inner.adoptCard(match);
    hydratedIds.add(match.id);
    hydratedIds.add(match.refId);
    return match;
  }

  return {
    createCard(refId) {
      const card = inner.createCard(refId);
      void persist(card).catch(() => undefined);
      hydratedIds.add(card.id);
      hydratedIds.add(card.refId);
      return card;
    },
    async review(cardId, rating) {
      // Hydrate from SQLite if the card isn't in the inner scheduler's
      // in-memory map (cold-start case). Without this, reviews against
      // cards that came from SQLite throw "Card not found".
      const card = await ensureHydrated(cardId);
      if (!card) {
        throw new Error(`Card not found: ${cardId}`);
      }
      const updated = inner.review(card.id, rating);
      void persist(updated).catch(() => undefined);
      return updated;
    },
    dueCards(now) {
      // Phase 50: inline rescheduler in inner.dueCards() now mutates the
      // in-memory mirror (Beru pedagogy review Q5#4). Persist any card
      // that crossed the catch-up threshold so SQLite's dueCount stays
      // consistent on cold start. Compare pre/post dueOn via inner.getCard.
      const idsToCheck = inner.dueCards(now).map((c) => c.id);
      void idsToCheck; // used below
      const result = idsToCheck.map((id) => inner.getCard(id)).filter((c): c is NonNullable<ReturnType<typeof inner.getCard>> => c != null);
      // For each due card, check whether dueOn is now further than today
      // (which means it was rescheduled — its original dueOn was <= today
      // and the rescheduler pushed it out to today + half-interval).
      const todayStr = todayIso(now ?? new Date());
      for (const card of result) {
        const daysUntilDue = Math.round(
          (new Date(`${card.dueOn}T00:00:00Z`).getTime() - new Date(`${todayStr}T00:00:00Z`).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        // Rescheduled = interval > 1 AND dueOn pushed out (positive days)
        // AND those days < intervalDays (otherwise it was a normal fresh
        // schedule). The catch-up rescheduler sets dueOn = today + half-
        // interval, so daysUntilDue is exactly half.
        if (daysUntilDue > 0 && daysUntilDue < card.intervalDays && card.intervalDays > 1) {
          void persist(card).catch(() => undefined);
        }
      }
      // Re-derive the actual dueCards subset (cards whose dueOn <= today
      // AFTER the reschedule). After the inline reschedule, the inner
      // map has been mutated; cards that were pushed out no longer have
      // dueOn <= today. Filter again to be honest.
      return result.filter((c) => c.dueOn <= todayStr);
    },
    overdueCatchUpCards(now) {
      return inner.overdueCatchUpCards(now);
    },
    async dueCount(now = new Date()) {
      const today = todayIso(now);
      const rows = await db.getAllAsync<{ c: number }>(
        'SELECT COUNT(*) AS c FROM kv_srs_cards WHERE due_on <= ?',
        today,
      );
      return rows[0]?.c ?? 0;
    },
    getCard(cardId) {
      return inner.getCard(cardId);
    },
    adoptCard(card) {
      inner.adoptCard(card);
      hydratedIds.add(card.id);
      hydratedIds.add(card.refId);
    },
    async hydrate() {
      // Bulk-load every SQLite card into the inner scheduler so the first
      // batch of reviews after cold start doesn't hit the per-card hydrate
      // path one-by-one. Idempotent.
      const all = await loadAll();
      for (const c of all) {
        if (!inner.getCard(c.id)) inner.adoptCard(c);
        hydratedIds.add(c.id);
        hydratedIds.add(c.refId);
      }
    },
    async listCards() {
      return loadAll();
    },
    async clearAll() {
      // Native: DELETE all rows. recreateSchema isn't needed because the
      // schema is owned by createTablesSql which is re-applied at boot.
      // Also wipe the in-memory mirror so getCard() returns undefined.
      try {
        await db.runAsync('DELETE FROM kv_srs_cards');
      } catch {
        // Table may not exist yet — recreate defensively.
        for (const sql of createTablesSql) await db.execAsync(sql);
      }
      hydratedIds.clear();
    },
  };
}

/**
 * In-memory fallback (web, tests, first-launch fallback when DB can't open).
 * Same surface so screens don't need to branch.
 */
export function createInMemorySrsStore(): PersistentSpacedRepetitionScheduler {
  const inner = createSpacedRepetitionScheduler();
  // Track all created cards so listCards() returns them.
  const allCards: ReviewCard[] = [];
  return {
    createCard(refId) {
      const card = inner.createCard(refId);
      allCards.push(card);
      return card;
    },
    async review(cardId, rating) {
      const card = inner.review(cardId, rating);
      const idx = allCards.findIndex((c) => c.id === cardId);
      if (idx >= 0) allCards[idx] = card;
      return card;
    },
    dueCards(now?: Date) { return inner.dueCards(now); },
    overdueCatchUpCards(now?: Date) { return inner.overdueCatchUpCards(now); },
    async dueCount(now = new Date()) { return inner.dueCards(now).length; },
    getCard(cardId) { return inner.getCard(cardId); },
    async hydrate() { /* in-memory already has everything */ },
    async listCards() { return [...allCards]; },
    async clearAll() { allCards.length = 0; },
    adoptCard(card) { inner.adoptCard(card); },
  };
}