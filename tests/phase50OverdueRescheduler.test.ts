import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSpacedRepetitionScheduler } from '../src/services/spacedRepetitionService';

const srcPath = resolve(__dirname, '..', 'src', 'services', 'spacedRepetitionService.ts');
const persistentPath = resolve(__dirname, '..', 'src', 'services', 'persistentSrsStore.ts');
const source = readFileSync(srcPath, 'utf8');

describe('phase50 overdue rescheduler', () => {
  it('overdueCatchUpCards exists as a method on the interface', () => {
    expect(source).toMatch(/overdueCatchUpCards\s*\(\s*now\?\s*:\s*Date\s*\)/);
  });
  it('Math.round(card.intervalDays * 0.5) is the halving rule', () => {
    expect(source).toMatch(/Math\.round\(\s*card\.intervalDays\s*\*\s*0\.5\s*\)/);
  });
  it('overdueDays >= 2 * card.intervalDays is the inclusive threshold', () => {
    expect(source).toMatch(/>=\s*2\s*\*\s*card\.intervalDays/);
  });
  it('dueCards() applies the rescheduler inline', () => {
    expect(source).toMatch(/Math\.max\(\s*1\s*,\s*Math\.round\(\s*card\.intervalDays\s*\*\s*0\.5\s*\)\s*\)/);
  });
  it('diffDays helper exists and returns integer day difference', () => {
    const today = '2026-07-08';
    const earlier = '2026-07-01';
    const later = '2026-07-15';
    const ms = new Date(today + 'T00:00:00Z').getTime() - new Date(earlier + 'T00:00:00Z').getTime();
    const expected = Math.round(ms / 86400000);
    const match = source.match(/function diffDays[\s\S]*?return\s+Math\.round\([^)]*\)[\s\S]*?\}/);
    if (!match) {
      expect(source).toMatch(/function diffDays/);
      return;
    }
    // The captured slice is TypeScript — contains `: string` / `: number`
    // annotations that `new Function` (plain JS) can't parse. Strip those
    // before evaluating so we can call the function reference.
    const stripped = match[0]
      .replace(/:\s*string\b/g, '')
      .replace(/:\s*number\b/g, '');
    const expr = '(' + stripped + ')';
    const fn = new Function('return ' + expr)();
    expect(fn(today, earlier)).toBe(expected);
    expect(fn(today, later)).toBe(-expected);
  });
  it('in-memory mirror is updated after dueCards() runs', () => {
    // adoptCard is a no-op when the card already exists in the mirror
    // (L181-186: "If a card with this id already exists, leave it alone").
    // So we use a unique refId per test, then adoptCard seeds the mirror
    // from a synthetic overdue state (intervalDays=12, dueOn 30 days past
    // today=2026-07-08). Expected: reschedule halves 12 -> 6, so dueOn
    // becomes 2026-07-14.
    const srs = createSpacedRepetitionScheduler();
    const synthetic = {
      id: 'synth-mirror-1',
      refId: 'mirror-test-1',
      intervalDays: 12,
      repetitions: 3,
      easeFactor: 2.5,
      dueOn: '2026-06-08',
      lastReviewedOn: '2026-06-08',
    };
    srs.adoptCard(synthetic);
    srs.dueCards(new Date('2026-07-08T00:00:00Z'));
    const after = srs.getCard(synthetic.id)!;
    expect(after.intervalDays).toBe(12); // intervalDays is NOT touched (Beru Q5#1)
    expect(after.dueOn).toBe('2026-07-14'); // today + round(12*0.5) = 6 days
  });
  it('lastReviewedOn is NOT cleared after reschedule', () => {
    // Use a synthetic card (unique id so adoptCard takes effect) with
    // intervalDays=12, dueOn 30 days past today. lastReviewedOn=2026-06-08.
    // The rescheduler must NOT clear lastReviewedOn (Beru Q5#1).
    const srs = createSpacedRepetitionScheduler();
    const synthetic = {
      id: 'synth-keep-lastReviewed',
      refId: 'keep-lastReviewedOn-test',
      intervalDays: 12,
      repetitions: 3,
      easeFactor: 2.5,
      dueOn: '2026-06-08',
      lastReviewedOn: '2026-06-08',
    };
    srs.adoptCard(synthetic);
    srs.dueCards(new Date('2026-07-08T00:00:00Z'));
    const after = srs.getCard(synthetic.id)!;
    expect(after.lastReviewedOn).toBe('2026-06-08'); // Beru Q5#1: preserved across reschedule
  });
  it('overdueCatchUpCards() returns the rescheduled subset', () => {
    // Synthetic card with intervalDays=12, dueOn=2026-06-08. After the
    // rescheduler halves 12 -> 6 and sets dueOn=2026-07-14, the card
    // sits in the catch-up bucket (post-reschedule days-until-due=6,
    // which is < intervalDays=12). overdueCatchUpCards() must surface it.
    const srs = createSpacedRepetitionScheduler();
    const synthetic = {
      id: 'synth-catchup-target',
      refId: 'catchup-target-test',
      intervalDays: 12,
      repetitions: 3,
      easeFactor: 2.5,
      dueOn: '2026-06-08',
      lastReviewedOn: '2026-06-08',
    };
    srs.adoptCard(synthetic);
    srs.dueCards(new Date('2026-07-08T00:00:00Z'));
    const catchUp = srs.overdueCatchUpCards(new Date('2026-07-08T00:00:00Z'));
    expect(catchUp.find(x => x.id === synthetic.id)).toBeDefined();
  });
});
