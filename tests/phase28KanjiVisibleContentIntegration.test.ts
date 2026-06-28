import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildKanjiSection } from '../src/services/kanjiSectionService';
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

  it('KanjiSectionPanel navigates the flat level card pool, not a 5-card lesson window', () => {
    const source = readFileSync(join(process.cwd(), 'src/screens/KanjiSectionPanel.tsx'), 'utf8');

    expect(source).toContain('const cardsInLevel = section.cards.filter');
    expect(source).toContain('const card = cardsInLevel[safeCardIndex]');
    expect(source).not.toContain('Math.floor(cardIndex / 5)');
    expect(source).not.toContain('cardIndex % 5');
  });
});
