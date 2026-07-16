/**
 * Phase 51 — interactional card stages (seen → recognized → memorized).
 *
 * Two-pass write: this file ships skeleton + describe; the runtime it()
 * blocks land in the second pass below. The first pass asserts the
 * SOURCE CONTRACTS that Phase 51 introduced: schema column, migration,
 * createCard default, persistence widening. Runtime lifecycle tests
 * (synthetic-card adoption) round out the suite.
 *
 * Lock-in contract: any future phase that touches kv_srs_cards,
 * ReviewCard, persistentSrsStore, or createCard must keep
 *   1. createCard defaulting to stage='seen'
 *   2. adoptCard being a no-op when the card already exists in
 *      memory (synthetic-card idiom required for tests)
 *   3. backwards-compat default stage='memorized' on read for any
 *      pre-Phase-51 row that gets migrated
 *
 * See skill file: devops/jt-interactional-card-stages/SKILL.md
 *   §Schema change
 *   §Implementation plan (tasks 2, 3)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const SCHEMA = 'src/db/schema.ts';
const REPO = 'src/repositories/sqliteLearningRepository.ts';
const SRS = 'src/services/spacedRepetitionService.ts';
const STORE = 'src/services/persistentSrsStore.ts';

describe('Phase 51 — interactional card stages (source contracts)', () => {
  it('A1 — kv_srs_cards schema has the stage column with NOT NULL DEFAULT memorized', () => {
    const sql = readFileSync(SCHEMA, 'utf8');
    expect(sql).toMatch(
      /kv_srs_cards[\s\S]*?stage\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'memorized'/i,
    );
  });

  it('A2 — migrateSrsStageColumn helper is defined in the repository', () => {
    const text = readFileSync(REPO, 'utf8');
    expect(text).toMatch(/async\s+function\s+migrateSrsStageColumn\s*\(/);
  });

  it('A3 — initialize() invokes migrateSrsStageColumn alongside the existing progress migration', () => {
    const text = readFileSync(REPO, 'utf8');
    expect(text).toMatch(/await\s+migrateSrsStageColumn\s*\(\s*\)/);
  });

  it('A4 — ReviewCard interface declares stage as a typed union of three literals', () => {
    const text = readFileSync(SRS, 'utf8');
    // The skill-shaped declaration:   stage: 'seen' | 'recognized' | 'memorized';
    expect(text).toMatch(/stage:\s*'seen'\s*\|\s*'recognized'\s*\|\s*'memorized'/);
  });

  it('A5 — createCard() initializes new cards with stage="seen"', () => {
    const text = readFileSync(SRS, 'utf8');
    // Inside createCard the freshly-built card must carry stage:'seen'.
    expect(text).toMatch(/stage:\s*'seen'/);
  });

  it('A6 — review() math is locked (no new params added beyond what Phase 50 had)', () => {
    const text = readFileSync(SRS, 'utf8');
    // The signature should still be `review(cardId: string, rating: ReviewRating)`.
    expect(text).toMatch(/review\s*\(\s*cardId\s*:\s*string\s*,\s*rating\s*:\s*ReviewRating/);
  });

  it('A7 — persistentSrsStore SrsRow includes stage', () => {
    const text = readFileSync(STORE, 'utf8');
    expect(text).toMatch(/interface\s+SrsRow\s*\{[\s\S]*?stage\s*:/);
  });

  it('A8 — persistentSrsStore loadAll() SELECTs stage', () => {
    const text = readFileSync(STORE, 'utf8');
    expect(text).toMatch(/SELECT[\s\S]*?stage[\s\S]*?FROM\s+kv_srs_cards/);
  });

  it('A9 — persistentSrsStore persist() INSERTs stage', () => {
    const text = readFileSync(STORE, 'utf8');
    expect(text).toMatch(/INSERT\s+OR\s+REPLACE\s+INTO\s+kv_srs_cards[\s\S]*?stage\s*\)/);
  });
});

describe('Phase 51 — createCard default runtime', () => {
  it('B1 — newly-created card has stage="seen" by default', async () => {
    const { createSpacedRepetitionScheduler } = await import('../src/services/spacedRepetitionService');
    const srs = createSpacedRepetitionScheduler();
    const card = srs.createCard('phase51-runtime-default-test');
    expect(card.stage).toBe('seen');
    expect(card.refId).toBe('phase51-runtime-default-test');
    // Also locks the SM-2 initial state hasn't shifted (Phase 50 invariant).
    expect(card.easeFactor).toBe(2.5);
    expect(card.repetitions).toBe(0);
  });

  it('B2 — review() (q=5, easy) on a "seen" card sets the canonical SM-2 state but stage is left to the screen layer', async () => {
    const { createSpacedRepetitionScheduler } = await import('../src/services/spacedRepetitionService');
    const srs = createSpacedRepetitionScheduler();
    const card = srs.createCard('phase51-runtime-review-easy');
    const updated = srs.review(card.id, 'easy');
    // SM-2 invariant from canonical-sm2-spec
    expect(updated.easeFactor).toBeCloseTo(2.60, 2);
    expect(updated.repetitions).toBe(1);
    expect(updated.intervalDays).toBe(1);
    // Stage is unchanged by review() itself — Daily Rush / FlashcardsScreen
    // are responsible for transitioning stage. This is deliberate (Q5c).
    expect(updated.stage).toBe('seen');
  });
});

describe('Phase 51 — synthetic-card adoption (idempotent adoptCard path)', () => {
  it('C1 — adoptCard with a unique id sets the in-memory card to the prescribed stage', async () => {
    const { createSpacedRepetitionScheduler } = await import('../src/services/spacedRepetitionService');
    const srs = createSpacedRepetitionScheduler();
    srs.adoptCard({
      id: 'synth-phase51-adopt-mem',
      refId: 'phase51-adopt-mem',
      intervalDays: 5,
      repetitions: 2,
      easeFactor: 2.5,
      dueOn: '2026-07-09',
      lastReviewedOn: '2026-07-04',
      stage: 'memorized',
    });
    const fetched = srs.getCard('synth-phase51-adopt-mem');
    expect(fetched).toBeDefined();
    expect(fetched!.stage).toBe('memorized');
    expect(fetched!.intervalDays).toBe(5);
    expect(fetched!.repetitions).toBe(2);
  });

  it('C2 — adoptCard is a no-op when the card id already exists in memory (Phase 50 lesson)', async () => {
    const { createSpacedRepetitionScheduler } = await import('../src/services/spacedRepetitionService');
    const srs = createSpacedRepetitionScheduler();
    srs.adoptCard({
      id: 'synth-phase51-noop-target',
      refId: 'phase51-noop',
      intervalDays: 1,
      repetitions: 0,
      easeFactor: 2.5,
      dueOn: '2026-07-09',
      lastReviewedOn: null,
      stage: 'seen',
    });
    // Second adopt with the SAME id but different stage — adopt must be a no-op.
    srs.adoptCard({
      id: 'synth-phase51-noop-target',
      refId: 'phase51-noop',
      intervalDays: 99,
      repetitions: 99,
      easeFactor: 2.99,
      dueOn: '2026-08-01',
      lastReviewedOn: '2026-07-09',
      stage: 'memorized',
    });
    const fetched = srs.getCard('synth-phase51-noop-target');
    expect(fetched!.stage).toBe('seen');           // unchanged
    expect(fetched!.intervalDays).toBe(1);         // unchanged
    expect(fetched!.easeFactor).toBe(2.5);          // unchanged
  });
});
