import { describe, expect, it } from 'vitest';

import {
  KOI_TTS_BUDGET_WINDOW_MS,
  getTtsRemainingCharacters,
  reserveTtsCharacters,
  type KoiTtsReservation,
} from '../src/ttsBudget.js';

const reservation = (id: string, characterCount: number, createdAtMs: number): KoiTtsReservation => ({
  id,
  characterCount,
  createdAtMs,
});

describe('global MiniMax TTS budget', () => {
  it('never reserves more than 4,000 characters in a rolling 24-hour window', () => {
    const nowMs = KOI_TTS_BUDGET_WINDOW_MS + 1_000;
    const first = reserveTtsCharacters([], reservation('first', 3_900, nowMs), nowMs);
    const blocked = reserveTtsCharacters(first.reservations, reservation('blocked', 101, nowMs), nowMs);
    const exact = reserveTtsCharacters(first.reservations, reservation('exact', 100, nowMs), nowMs);
    expect(first.allowed).toBe(true);
    expect(blocked).toMatchObject({ allowed: false, remainingCharacters: 100 });
    expect(exact).toMatchObject({ allowed: true, remainingCharacters: 0 });
  });

  it('releases capacity only after a reservation is older than 24 hours', () => {
    const nowMs = KOI_TTS_BUDGET_WINDOW_MS + 10_000;
    const old = reservation('old', 4_000, nowMs - KOI_TTS_BUDGET_WINDOW_MS - 1);
    expect(getTtsRemainingCharacters([old], nowMs)).toBe(4_000);
  });

  it('fails closed for zero, negative, or over-budget requests', () => {
    const nowMs = 10_000;
    expect(reserveTtsCharacters([], reservation('zero', 0, nowMs), nowMs).allowed).toBe(false);
    expect(reserveTtsCharacters([], reservation('negative', -1, nowMs), nowMs).allowed).toBe(false);
    expect(reserveTtsCharacters([], reservation('large', 4_001, nowMs), nowMs).allowed).toBe(false);
  });
});

