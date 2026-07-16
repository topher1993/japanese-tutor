import type { SqliteLikeDatabase } from '../repositories/sqliteLearningRepository';
import { createTablesSql } from '../db/schema';
import {
  createSpacedRepetitionScheduler,
  type ReviewCard,
  type ReviewRating,
} from './spacedRepetitionService';
import { localDateKey } from '../utils/localDate';

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
  /**
   * Phase 51: interactional card-stages state machine column.
   * The schema DEFAULTs to 'memorized' so existing (pre-Phase-51) rows
   * upgraded via the ALTER TABLE migration in sqliteLearningRepository
   * satisfy NOT NULL without a read-time special case (Beru Q5 Mod 2).
   */
  stage: 'seen' | 'recognized' | 'memorized';
}

export interface PersistentSpacedRepetitionScheduler {
  createCard(refId: string): ReviewCard;
  /**
   * Async because the persistent store may need to hydrate from SQLite
   * on cold start (the inner scheduler's in-memory map is empty after
   * fresh app launch). Returns the updated card or throws if not found.
   */
  review(cardId: string, rating: ReviewRating): Promise<ReviewCard>;
  /** Save an interactional learning-stage transition without altering SM-2 math. */
  setStage(cardId: string, stage: ReviewCard['stage']): Promise<ReviewCard>;
  dueCards(now?: Date): ReviewCard[];
  /**
   * Phase 50: cards in the catch-up bucket (overdue beyond 2x intervalDays).
   * Same semantics as `inner.overdueCatchUpCards(now)`.
   */
  overdueCatchUpCards(now?: Date): ReviewCard[];
  getCard(cardId: string): ReviewCard | undefined;
  /** Count of cards due today (or earlier), after catch-up rescheduling. */
  dueCount(now?: Date): Promise<number>;
  /** Idempotent — call once at boot. Bulk-loads SQLite cards into the
   *  inner scheduler so the first batch of reviews is fast. */
  hydrate(): Promise<void>;
  flush(): Promise<void>;
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
  let writeChain: Promise<void> = Promise.resolve();

  async function loadAll(): Promise<ReviewCard[]> {
    const rows = await db.getAllAsync<SrsRow>(
      'SELECT id, ref_id, interval_days, repetitions, ease_factor, due_on, last_reviewed_on, stage FROM kv_srs_cards ORDER BY due_on ASC',
    );
    const loaded = rows.map(r => ({
      id: r.id,
      refId: r.ref_id,
      intervalDays: r.interval_days,
      repetitions: r.repetitions,
      easeFactor: r.ease_factor,
      dueOn: r.due_on,
      lastReviewedOn: r.last_reviewed_on,
      // Belt-and-braces: schema DEFAULT is 'memorized' but if a future
      // migration ever leaves stage NULL for any reason, default at read.
      stage: (r.stage ?? 'memorized') as ReviewCard['stage'],
    }));
    // Older builds could create multiple SRS rows for the same refId when a
    // learner started another Daily Rush without remounting the screen.
    // Keep the most advanced row and remove duplicates so dueCount and future
    // reviews operate on exactly one scheduling record per learning item.
    const stageRank: Record<ReviewCard['stage'], number> = { seen: 0, recognized: 1, memorized: 2 };
    const canonical = new Map<string, ReviewCard>();
    const duplicateIds: string[] = [];
    for (const card of loaded) {
      const prior = canonical.get(card.refId);
      if (!prior) {
        canonical.set(card.refId, card);
        continue;
      }
      const cardScore = [stageRank[card.stage], card.repetitions, card.lastReviewedOn ?? ''];
      const priorScore = [stageRank[prior.stage], prior.repetitions, prior.lastReviewedOn ?? ''];
      const preferCard = cardScore[0] > priorScore[0]
        || (cardScore[0] === priorScore[0] && cardScore[1] > priorScore[1])
        || (cardScore[0] === priorScore[0] && cardScore[1] === priorScore[1] && cardScore[2] > priorScore[2]);
      if (preferCard) {
        duplicateIds.push(prior.id);
        canonical.set(card.refId, card);
      } else {
        duplicateIds.push(card.id);
      }
    }
    for (const id of duplicateIds) {
      await db.runAsync('DELETE FROM kv_srs_cards WHERE id = ?', id);
    }
    return Array.from(canonical.values());
  }

  async function persist(card: ReviewCard): Promise<void> {
    await db.runAsync(
      `INSERT OR REPLACE INTO kv_srs_cards (id, ref_id, interval_days, repetitions, ease_factor, due_on, last_reviewed_on, stage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      card.id, card.refId, card.intervalDays, card.repetitions, card.easeFactor, card.dueOn, card.lastReviewedOn, card.stage,
    );
  }

  function queuePersist(card: ReviewCard): Promise<void> {
    const write = writeChain.then(async () => {
      try {
        await persist(card);
      } catch {
        await persist(card);
      }
    });
    writeChain = write.catch(() => undefined);
    return write;
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

  /**
   * Load the same durable card set used by screen-facing `listCards()` and
   * `dueCount()`, apply overdue catch-up scheduling, and persist every changed
   * due date before returning. Previously only the synchronous `dueCards()`
   * method performed this transition, but the app's screens never called it;
   * the behavior therefore existed only in unit tests.
   */
  async function refreshCatchUpState(now: Date): Promise<ReviewCard[]> {
    // createCard() is synchronous by contract and queues its SQLite INSERT.
    // Wait for those writes before querying, otherwise an immediate
    // listCards()/dueCount() can deterministically read the pre-create rows.
    await writeChain;
    const persisted = await loadAll();
    for (const card of persisted) {
      if (!inner.getCard(card.id)) inner.adoptCard(card);
      hydratedIds.add(card.id);
      hydratedIds.add(card.refId);
    }

    // SQLite is the durable baseline, while the inner mirror can contain a
    // fresher card whose write exhausted both retry attempts. Keep that card
    // visible for the current session instead of making screen-facing reads
    // lie until another review happens to persist it.
    const activeById = new Map(persisted.map(card => [card.id, card]));
    for (const key of hydratedIds) {
      const card = inner.getCard(key);
      if (card) activeById.set(card.id, card);
    }
    const active = Array.from(activeById.values());
    const beforeDueOn = new Map(active.map(card => [card.id, card.dueOn]));

    inner.dueCards(now);
    const changed: ReviewCard[] = [];
    const current = active.map(card => {
      const refreshed = inner.getCard(card.id) ?? card;
      if (refreshed.dueOn !== beforeDueOn.get(card.id)) changed.push(refreshed);
      return refreshed;
    });
    await Promise.all(changed.map(card => queuePersist(card)));
    return current.sort((left, right) => left.dueOn.localeCompare(right.dueOn));
  }

  return {
    createCard(refId) {
      const card = inner.createCard(refId);
      void queuePersist(card).catch(() => undefined);
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
      await queuePersist(updated);
      return updated;
    },
    async setStage(cardId, stage) {
      const card = await ensureHydrated(cardId);
      if (!card) throw new Error(`Card not found: ${cardId}`);
      const updated = inner.setStage(card.id, stage);
      await queuePersist(updated);
      return updated;
    },
    dueCards(now) {
      // Phase 50: inline rescheduler in inner.dueCards() now mutates the
      // in-memory mirror (Beru pedagogy review Q5#4). Persist any card
      // that crossed the catch-up threshold so SQLite's dueCount stays
      // consistent on cold start. Compare pre/post dueOn via inner.getCard.
      // Snapshot every hydrated card before the pure scheduler applies its
      // catch-up mutations. The scheduler now returns only cards that remain
      // due, so the old return-value-based comparison could no longer see a
      // card whose due date was pushed into the future.
      const beforeDueOn = new Map<string, string>();
      for (const key of hydratedIds) {
        const card = inner.getCard(key);
        if (card) beforeDueOn.set(card.id, card.dueOn);
      }
      const result = inner.dueCards(now);
      // For each due card, check whether dueOn is now further than today
      // (which means it was rescheduled — its original dueOn was <= today
      // and the rescheduler pushed it out to today + half-interval).
      const todayStr = localDateKey(now ?? new Date());
      for (const [id, previousDueOn] of beforeDueOn) {
        const card = inner.getCard(id);
        if (card && card.dueOn !== previousDueOn) {
          void queuePersist(card).catch(() => undefined);
        }
      }
      // Re-derive the actual dueCards subset (cards whose dueOn <= today
      // AFTER the reschedule). After the inline reschedule, the inner
      // map has been mutated; cards that were pushed out no longer have
      // dueOn <= today. Filter again to be honest.
      return result.filter((c) => c.dueOn <= todayStr);
    },
    overdueCatchUpCards(now) {
      // Calling this API directly must enforce the same rescheduling rule as
      // dueCards(). Otherwise a caller can see a catch-up candidate without
      // moving its due date or persisting the move.
      const catchUp = inner.overdueCatchUpCards(now);
      for (const card of catchUp) {
        void queuePersist(card).catch(() => undefined);
      }
      return catchUp;
    },
    async dueCount(now = new Date()) {
      const today = localDateKey(now);
      const cards = await refreshCatchUpState(now);
      return cards.filter(card => card.stage === 'memorized' && card.dueOn <= today).length;
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
    async flush() {
      await writeChain;
    },
    async listCards() {
      return refreshCatchUpState(new Date());
    },
    async clearAll() {
      await writeChain;
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
      inner.clearAll();
    },
  };
}

/**
 * In-memory fallback (web, tests, first-launch fallback when DB can't open).
 * Same surface so screens don't need to branch.
 */
export function createInMemorySrsStore(): PersistentSpacedRepetitionScheduler {
  const inner = createSpacedRepetitionScheduler();
  // Track identities, not card snapshots. The scheduler replaces card objects
  // after reviews, stage changes, and catch-up rescheduling; resolving by id
  // keeps the web fallback from returning stale pre-mutation rows.
  const cardIds = new Set<string>();
  return {
    createCard(refId) {
      const card = inner.createCard(refId);
      cardIds.add(card.id);
      return card;
    },
    async review(cardId, rating) {
      return inner.review(cardId, rating);
    },
    async setStage(cardId, stage) {
      return inner.setStage(cardId, stage);
    },
    dueCards(now?: Date) { return inner.dueCards(now); },
    overdueCatchUpCards(now?: Date) { return inner.overdueCatchUpCards(now); },
    async dueCount(now = new Date()) { return inner.dueCards(now).length; },
    getCard(cardId) { return inner.getCard(cardId); },
    async hydrate() { /* in-memory already has everything */ },
    async flush() { /* in-memory writes are synchronous */ },
    async listCards() {
      return Array.from(cardIds)
        .map(id => inner.getCard(id))
        .filter((card): card is ReviewCard => card != null);
    },
    async clearAll() { cardIds.clear(); inner.clearAll(); },
    adoptCard(card) {
      inner.adoptCard(card);
      // Keep the in-memory fallback's listCards() mirror in parity with the
      // SQLite-backed store. Adopted cards are persisted state, not just a
      // lookup optimization, so they must appear in subsequent hydration and
      // UI due-card calculations.
      if (inner.getCard(card.id)?.id === card.id) {
        cardIds.add(card.id);
      }
    },
  };
}

export const WEB_SRS_STORAGE_KEY = 'japanese-tutor:srs:v1';

export interface SrsKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface WebSrsSnapshotV1 {
  schemaVersion: 1;
  cards: ReviewCard[];
}

function isReviewCard(value: unknown): value is ReviewCard {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const card = value as Partial<ReviewCard>;
  return typeof card.id === 'string'
    && typeof card.refId === 'string'
    && typeof card.intervalDays === 'number'
    && typeof card.repetitions === 'number'
    && typeof card.easeFactor === 'number'
    && typeof card.dueOn === 'string'
    && (card.lastReviewedOn === null || typeof card.lastReviewedOn === 'string')
    && (card.stage === 'seen' || card.stage === 'recognized' || card.stage === 'memorized');
}

/** Durable browser scheduler backed by localStorage's async adapter. */
export function createKeyValueSrsStore(
  storage: SrsKeyValueStorage,
): PersistentSpacedRepetitionScheduler {
  const inner = createSpacedRepetitionScheduler();
  const cardIds = new Set<string>();
  let hydration: Promise<void> | null = null;
  let writeChain: Promise<void> = Promise.resolve();

  function cards(): ReviewCard[] {
    return Array.from(cardIds)
      .map(id => inner.getCard(id))
      .filter((card): card is ReviewCard => card != null)
      .sort((left, right) => left.dueOn.localeCompare(right.dueOn));
  }

  function queuePersist(): Promise<void> {
    const snapshot: WebSrsSnapshotV1 = { schemaVersion: 1, cards: cards() };
    const serialized = JSON.stringify(snapshot);
    const write = writeChain
      .catch(() => undefined)
      .then(() => storage.setItem(WEB_SRS_STORAGE_KEY, serialized));
    writeChain = write.catch(() => undefined);
    return write;
  }

  function hydrate(): Promise<void> {
    if (!hydration) {
      hydration = storage.getItem(WEB_SRS_STORAGE_KEY).then(raw => {
        if (!raw) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return;
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
        const snapshot = parsed as Partial<WebSrsSnapshotV1>;
        if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.cards)) return;
        const adoptedRefs = new Set<string>();
        for (const card of snapshot.cards) {
          if (!isReviewCard(card) || adoptedRefs.has(card.refId)) continue;
          inner.adoptCard(card);
          cardIds.add(card.id);
          adoptedRefs.add(card.refId);
        }
      });
    }
    return hydration;
  }

  function rescheduleCatchUp(now: Date): ReviewCard[] {
    const before = new Map(cards().map(card => [card.id, card.dueOn]));
    inner.dueCards(now);
    const current = cards();
    if (current.some(card => card.dueOn !== before.get(card.id))) {
      void queuePersist().catch(() => undefined);
    }
    return current;
  }

  return {
    createCard(refId) {
      const card = inner.createCard(refId);
      cardIds.add(card.id);
      void queuePersist().catch(() => undefined);
      return card;
    },
    async review(cardId, rating) {
      await hydrate();
      const updated = inner.review(cardId, rating);
      await queuePersist();
      return updated;
    },
    async setStage(cardId, stage) {
      await hydrate();
      const updated = inner.setStage(cardId, stage);
      await queuePersist();
      return updated;
    },
    dueCards(now = new Date()) {
      return rescheduleCatchUp(now)
        .filter(card => card.stage === 'memorized' && card.dueOn <= localDateKey(now));
    },
    overdueCatchUpCards(now = new Date()) {
      const before = new Map(cards().map(card => [card.id, card.dueOn]));
      const result = inner.overdueCatchUpCards(now);
      if (cards().some(card => card.dueOn !== before.get(card.id))) {
        void queuePersist().catch(() => undefined);
      }
      return result;
    },
    getCard(cardId) {
      return inner.getCard(cardId);
    },
    async dueCount(now = new Date()) {
      await hydrate();
      const count = this.dueCards(now).length;
      await writeChain;
      return count;
    },
    hydrate,
    async flush() {
      await writeChain;
    },
    async listCards() {
      await hydrate();
      const current = rescheduleCatchUp(new Date());
      await writeChain;
      return current;
    },
    async clearAll() {
      await hydrate();
      await writeChain;
      inner.clearAll();
      cardIds.clear();
      await storage.removeItem(WEB_SRS_STORAGE_KEY);
    },
    adoptCard(card) {
      inner.adoptCard(card);
      if (inner.getCard(card.id)?.id === card.id) cardIds.add(card.id);
      void queuePersist().catch(() => undefined);
    },
  };
}
