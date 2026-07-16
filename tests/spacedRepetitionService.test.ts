// Phase 49 — Real SM-2 algorithm spec test for the spaced repetition
// scheduler. Locks down (a) the source-contract pieces (quality mapping,
// canonical EF formula, untouched ReviewCard shape) and (b) the numeric
// outputs on every transition in the SM-2 state machine. Cross-checked
// against Wozniak 1990 (https://super-memory.com/english/ol/sm2.htm).
//
// Pattern mirrors tests/phase47WeeklyTodoBoardWiring.test.ts and
// tests/phase48WeeklyPlanExtension.test.ts: source-contract assertions
// read the file as a string via readFileSync + toMatch / toContain,
// and runtime assertions call the scheduler directly.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createSpacedRepetitionScheduler } from '../src/services/spacedRepetitionService';

const ROOT = join(__dirname, '..');
const SVC_PATH = join(ROOT, 'src', 'services', 'spacedRepetitionService.ts');

function readSrc(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * Numeric known-fixture values pinned from Wozniak 1990 SM-2 spec.
 * If any test in section B–F fails, the EF formula or interval
 * progression in review() is wrong.
 */
const KNOWN_EF_TABLE = {
  // Starting easeFactor = 2.5; delta = 0.1 - (5-q) * (0.08 + (5-q) * 0.02)
  easy: 2.6, // q=5, delta +0.10
  good: 2.5, // q=4, delta  0.00 (spec: no change)
  hard: 2.36, // q=3, delta -0.14
  again: 2.18, // q=2, delta -0.32
} as const;

describe('Phase 49 — Real SM-2 algorithm (spacedRepetitionService)', () => {
  // ────────────────────────────────────────────────────────────────────
  // A. Source-contract (3)
  // ────────────────────────────────────────────────────────────────────
  describe('A. Source-contract', () => {
    it('A1 — declares the SM-2 quality mapping (4-button rating → 2/3/4/5)', () => {
      const src = readSrc(SVC_PATH);
      // The mapping: again=2, hard=3, good=4, easy=5.
      // We check each arm of the ternary is present so a future edit
      // that drops, say, the `'again' ? 2` arm will fail this test.
      expect(src).toMatch(/['"]again['"]\s*\?\s*2/);
      expect(src).toMatch(/['"]hard['"]\s*\?\s*3/);
      expect(src).toMatch(/['"]good['"]\s*\?\s*4/);
      // The easy arm falls through a 5 default — assert the type
      // annotation `2 | 3 | 4 | 5` is declared and the easy mapping
      // resolves to 5 implicitly.
      expect(src).toMatch(/:\s*2\s*\|\s*3\s*\|\s*4\s*\|\s*5/);
    });

    it('A2 — uses the canonical EF formula (0.1 - (5-q) * (0.08 + (5-q) * 0.02))', () => {
      const src = readSrc(SVC_PATH);
      // Match the formula exactly. Tolerant of whitespace and identifier
      // names — the brief calls it `quality`, the spec calls it `q`.
      expect(src).toMatch(
        /0\.1\s*-\s*\(5\s*-\s*quality\)\s*\*\s*\(0\.08\s*\+\s*\(5\s*-\s*quality\)\s*\*\s*0\.02\)/,
      );
      // Floor at 1.3 must also be present.
      expect(src).toMatch(/Math\.max\(\s*1\.3\s*,/);
    });

    it('A3 — ReviewCard shape unchanged (id, refId, intervalDays, repetitions, easeFactor, dueOn, lastReviewedOn)', () => {
      const src = readSrc(SVC_PATH);
      // The interface declaration must contain all 7 fields. We anchor
      // on the interface block so we do not match other declarations.
      const iface = src.match(/export\s+interface\s+ReviewCard\s*\{[\s\S]*?\n\}/);
      expect(iface, 'ReviewCard interface not found').toBeTruthy();
      const body = iface![0];
      expect(body).toMatch(/\bid:\s*string\s*;/);
      expect(body).toMatch(/\brefId:\s*string\s*;/);
      expect(body).toMatch(/\bintervalDays:\s*number\s*;/);
      expect(body).toMatch(/\brepetitions:\s*number\s*;/);
      expect(body).toMatch(/\beaseFactor:\s*number\s*;/);
      expect(body).toMatch(/\bdueOn:\s*string\s*;/);
      expect(body).toMatch(/\blastReviewedOn:\s*string\s*\|\s*null\s*;/);
      // Phase 51 widening — ReviewCard now carries an 8th field
      // `stage: 'seen' | 'recognized' | 'memorized'` typed as a literal
      // union. Lock down the field name + the typed union shape so a
      // future edit that broadens the type (e.g. to `string`) fails.
      expect(body).toMatch(/\bstage:\s*'seen'\s*\|\s*'recognized'\s*\|\s*'memorized'\s*;/);
    });

    // Phase 51 follow-up: Gate 1a — A3 above asserts the *interface*
    // declares the field, but the brief calls for an explicit runtime
    // assertion that `createCard()` actually returns `stage: 'seen'`.
    // The other 12 tests in this file all use unique synthetic card
    // ids (pitfall #1 from the skill — adoptCard is no-op on
    // duplicates) so adding a fresh assertion here is safe and does
    // not perturb any other test's input set.
    it('A3b — createCard() returns a card with stage: "seen" by default', () => {
      const scheduler = createSpacedRepetitionScheduler();
      const card = scheduler.createCard('phase51-stage-default');
      expect(card.stage).toBe('seen');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // B. First-review spec (1)
  // ────────────────────────────────────────────────────────────────────
  describe('B. First review (n=1)', () => {
    it('B4 — first review at any pass-rating yields repetitions=1, intervalDays=1', () => {
      const scheduler = createSpacedRepetitionScheduler();

      // We exercise 'good', 'easy', and 'hard' (all pass). 'again' would
      // reset to n=0 per the lapse rule and is covered in section D.
      for (const rating of ['good', 'easy', 'hard'] as const) {
        const card = scheduler.createCard(`first-${rating}`);
        const reviewed = scheduler.review(card.id, rating);
        expect(reviewed.repetitions, `first review with ${rating}`).toBe(1);
        expect(reviewed.intervalDays, `first review with ${rating}`).toBe(1);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // C. Second-review spec (1)
  // ────────────────────────────────────────────────────────────────────
  describe('C. Second review (n=2)', () => {
    it('C5 — second pass-rating review yields repetitions=2, intervalDays=6', () => {
      const scheduler = createSpacedRepetitionScheduler();
      const card = scheduler.createCard('vocab-second');
      const first = scheduler.review(card.id, 'good');
      const second = scheduler.review(first.id, 'good');
      expect(second.repetitions).toBe(2);
      expect(second.intervalDays).toBe(6);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // D. Third+ review (multipliers) (4)
  // ────────────────────────────────────────────────────────────────────
  describe('D. Third+ review (multipliers)', () => {
    it('D6 — third good review at EF=2.5 → interval = round(6 * 2.5) = 15', () => {
      const scheduler = createSpacedRepetitionScheduler();
      const card = scheduler.createCard('vocab-good3');
      const r1 = scheduler.review(card.id, 'good'); // n=1, interval=1, EF=2.5
      const r2 = scheduler.review(r1.id, 'good'); // n=2, interval=6, EF=2.5
      const r3 = scheduler.review(r2.id, 'good'); // n=3, interval=round(6*2.5)=15
      expect(r3.repetitions).toBe(3);
      expect(r3.intervalDays).toBe(15);
      // EF should be unchanged on `good` (delta=0 by spec).
      expect(r3.easeFactor).toBeCloseTo(KNOWN_EF_TABLE.good, 6);
    });

    it('D7 — third easy review at EF=2.5 → EF bumps to 2.6, interval = round(6 * 2.6) = 16', () => {
      const scheduler = createSpacedRepetitionScheduler();
      const card = scheduler.createCard('vocab-easy3');
      const r1 = scheduler.review(card.id, 'good'); // n=1, EF=2.5
      const r2 = scheduler.review(r1.id, 'good'); // n=2, interval=6
      const r3 = scheduler.review(r2.id, 'easy'); // EF=2.6, interval=round(6*2.6)=16
      expect(r3.repetitions).toBe(3);
      expect(r3.intervalDays).toBe(16);
      expect(r3.easeFactor).toBeCloseTo(KNOWN_EF_TABLE.easy, 6);
    });

    it('D8 — third hard review at EF=2.5 → EF drops to 2.36, interval = round(6 * 2.36) = 14', () => {
      const scheduler = createSpacedRepetitionScheduler();
      const card = scheduler.createCard('vocab-hard3');
      const r1 = scheduler.review(card.id, 'good'); // n=1, EF=2.5
      const r2 = scheduler.review(r1.id, 'good'); // n=2, interval=6
      const r3 = scheduler.review(r2.id, 'hard'); // EF=2.36, interval=round(6*2.36)=14
      expect(r3.repetitions).toBe(3);
      expect(r3.intervalDays).toBe(14);
      expect(r3.easeFactor).toBeCloseTo(KNOWN_EF_TABLE.hard, 6);
    });

    it('D9 — again (q<3) resets n=0, interval=1, EF drops to 2.18', () => {
      const scheduler = createSpacedRepetitionScheduler();
      const card = scheduler.createCard('vocab-lapse');
      const r1 = scheduler.review(card.id, 'good'); // n=1, EF=2.5
      const r2 = scheduler.review(r1.id, 'good'); // n=2, interval=6
      const r3 = scheduler.review(r2.id, 'again'); // n=0 (lapse), interval=1, EF=2.18
      expect(r3.repetitions).toBe(0);
      expect(r3.intervalDays).toBe(1);
      expect(r3.easeFactor).toBeCloseTo(KNOWN_EF_TABLE.again, 6);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // E. EF floor (1)
  // ────────────────────────────────────────────────────────────────────
  describe('E. EF floor', () => {
    it('E10 — easeFactor never drops below 1.3 under repeated `again`', () => {
      const scheduler = createSpacedRepetitionScheduler();
      const card = scheduler.createCard('vocab-floor');
      let current = card;
      // 10 consecutive `again` ratings on a fresh card. Each `again`
      // on an n=0 card still applies the EF delta (q=2 → −0.32), so
      // naive EF would sink well below 1.3.
      for (let i = 0; i < 10; i += 1) {
        current = scheduler.review(current.id, 'again');
        expect(current.easeFactor).toBeGreaterThanOrEqual(1.3);
      }
      // And the final easeFactor should sit exactly on the floor.
      expect(current.easeFactor).toBeCloseTo(1.3, 6);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // F. Lapse-and-recover (1)
  // ────────────────────────────────────────────────────────────────────
  describe('F. Lapse-and-recover', () => {
    it('F11 — after a lapse, the next good review starts the streak over (n=1, interval=1)', () => {
      const scheduler = createSpacedRepetitionScheduler();
      const card = scheduler.createCard('vocab-recover');
      const r1 = scheduler.review(card.id, 'good'); // n=1
      const r2 = scheduler.review(r1.id, 'good'); // n=2, interval=6
      const r3 = scheduler.review(r2.id, 'again'); // n=0 (lapse), interval=1
      const r4 = scheduler.review(r3.id, 'good'); // n=1, interval=1, EF=2.18 (post-again)
      expect(r4.repetitions).toBe(1);
      expect(r4.intervalDays).toBe(1);
      // EF starts from 2.18 (post-again) and `good` is delta=0, so it
      // should still be ≈2.18.
      expect(r4.easeFactor).toBeCloseTo(KNOWN_EF_TABLE.again, 6);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // G. Regression (1)
  // ────────────────────────────────────────────────────────────────────
  describe('G. Regression — FlashcardsScreen contract', () => {
    it('G12 — dueCards() excludes a card after reviewing, until dueOn is reached', () => {
      // This guards the public-API contract that FlashcardsScreen
      // depends on: `dueCards(today)` should not return a card whose
      // dueOn is in the future. We assert the counting behavior on a
      // fresh scheduler and after one short review.
      const scheduler = createSpacedRepetitionScheduler();

      const c1 = scheduler.createCard('c1');
      const c2 = scheduler.createCard('c2');
      const c3 = scheduler.createCard('c3');
      scheduler.setStage(c1.id, 'memorized');
      scheduler.setStage(c2.id, 'memorized');
      scheduler.setStage(c3.id, 'memorized');
      // All three graduated cards are due today initially.
      expect(scheduler.dueCards().length).toBe(3);

      // First review on c1 → dueOn = today + 1d, so c1 should drop off
      // today's due list.
      scheduler.review(c1.id, 'good');
      const dueTomorrow = scheduler.dueCards();
      expect(dueTomorrow.length).toBe(2);
      expect(dueTomorrow.some((c) => c.id === c1.id)).toBe(false);
    });
  });
});
