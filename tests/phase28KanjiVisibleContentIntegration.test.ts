import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildKanjiSection, mergeKanjiCardPool } from '../src/services/kanjiSectionService';
import { buildCandidateKanjiSection } from '../src/services/candidateKanjiAdapter';

describe('Phase 28 kanji visible content integration', () => {
  it('loaded kanji pools contain far more than the old 10-card visible window', async () => {
    const base = buildKanjiSection();
    const candidate = await buildCandidateKanjiSection();
    const cards = [...base.cards, ...candidate.cards];

    const n5 = cards.filter((card) => card.jlptLevel === 'N5');
    const n4 = cards.filter((card) => card.jlptLevel === 'N4');

    expect(n5.length).toBeGreaterThan(10);
    expect(n4.length).toBeGreaterThan(10);
  });

  it('N5 and N4 candidate kanji render source meanings and readings instead of placeholders', async () => {
    const candidate = await buildCandidateKanjiSection();
    const candidateCards = candidate.cards.filter((card) => card.id.startsWith('cand-kanji-'));
    const n5Candidates = candidateCards.filter((card) => card.id.startsWith('cand-kanji-kanji-n5-'));
    const n4Candidates = candidateCards.filter((card) => card.id.startsWith('cand-kanji-n4-kanji-'));

    expect(n5Candidates.length).toBeGreaterThan(70);
    expect(n4Candidates.length).toBeGreaterThan(800);
    for (const card of candidateCards) {
      expect(card.meanings.length).toBeGreaterThan(0);
      expect(card.readings.length).toBeGreaterThan(0);
      expect(card.meanings).not.toContain('(review needed)');
      expect(card.meanings).not.toContain('N4 kanji candidate');
      expect(card.readings).not.toContain('(pending)');
      expect(card.readings).not.toContain('(pending on/kun)');
    }
  });

  it('deduplicates visible kanji and gives every visible card example words', async () => {
    const base = buildKanjiSection();
    const candidate = await buildCandidateKanjiSection();
    const visible = mergeKanjiCardPool([...base.cards, ...candidate.cards]);
    const uniqueKanji = new Set(visible.map((card) => card.kanji));

    expect(visible.length).toBeGreaterThan(800);
    expect(uniqueKanji.size).toBe(visible.length);
    for (const card of visible) {
      expect(card.kanji.length).toBe(1);
      expect(card.exampleWords.length).toBeGreaterThan(0);
    }
  });

  it('KanjiSectionPanel navigates the flat level card pool, not a 5-card lesson window', () => {
    const source = readFileSync(join(process.cwd(), 'src/screens/KanjiSectionPanel.tsx'), 'utf8');

    expect(source).toContain('const cardsInLevel = section.cards.filter');
    expect(source).toContain('const card = cardsInLevel[safeCardIndex]');
    expect(source).not.toContain('Math.floor(cardIndex / 5)');
    expect(source).not.toContain('cardIndex % 5');
  });
});
