import { describe, expect, it } from 'vitest';

import { buildKanjiSection } from '../src/services/kanjiSectionService';

describe('Phase 20E kanji section', () => {
  it('builds a section with cards per kanji', () => {
    const section = buildKanjiSection();
    expect(section.cards.length).toBeGreaterThan(0);
  });

  it('every card has the required fields', () => {
    const section = buildKanjiSection();
    for (const card of section.cards) {
      expect(card.kanji.trim().length).toBeGreaterThan(0);
      expect(card.meanings.length).toBeGreaterThan(0);
      expect(card.readings.length).toBeGreaterThan(0);
      expect(['N5', 'N4'].includes(card.jlptLevel)).toBe(true);
    }
  });

  it('groups cards into lessons with metadata', () => {
    const section = buildKanjiSection();
    expect(section.lessons.length).toBeGreaterThan(0);
    for (const lesson of section.lessons) {
      expect(lesson.title.trim().length).toBeGreaterThan(0);
      expect(lesson.cards.length).toBeGreaterThan(0);
    }
  });

  it('can filter by JLPT level', () => {
    const section = buildKanjiSection('N5');
    for (const card of section.cards) {
      expect(card.jlptLevel).toBe('N5');
    }
  });
});