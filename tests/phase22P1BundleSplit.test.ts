/**
 * Phase 22 audit fix P1-07 — candidate content bundle split via dynamic import.
 *
 * GPT-5.5 condition: candidate vocabulary / kanji packs should not all be in
 * the main bundle. We use Metro's dynamic `import()` to chunk them.
 *
 * Verifies:
 *   - the adapters use dynamic `import(...)` (not top-level static imports)
 *   - the FlashcardsScreen and KanjiSectionPanel call the adapter asynchronously
 *     (no synchronous invocation in render path)
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

function readSrc(relative: string): string {
  return readFileSync(join(SRC, relative), 'utf8');
}

describe('Phase 22 audit — candidate pack bundle split (P1-07 fix)', () => {
  it('candidate flashcard adapter uses dynamic import for N5 and N4 packs', () => {
    const src = readSrc('services/candidateFlashcardAdapter.ts');
    expect(src).toMatch(/import\(['"]\.\.\/data\/candidates\/n5VocabularyCandidatePack['"]\)/);
    expect(src).toMatch(/import\(['"]\.\.\/data\/candidates\/n4CandidatePack['"]\)/);
    // No top-level static imports of these packs.
    expect(src).not.toMatch(/^import \{ getN5VocabularyCandidatePack \}/m);
    expect(src).not.toMatch(/^import \{ getN4VocabularyCandidatePack \}/m);
  });

  it('candidate kanji adapter uses dynamic import for N5 and N4 packs', () => {
    const src = readSrc('services/candidateKanjiAdapter.ts');
    expect(src).toMatch(/import\(['"]\.\.\/data\/candidates\/n5KanjiCandidatePack['"]\)/);
    expect(src).toMatch(/import\(['"]\.\.\/data\/candidates\/n4CandidatePack['"]\)/);
    expect(src).not.toMatch(/^import \{ getN5KanjiCandidatePack \}/m);
    expect(src).not.toMatch(/^import \{ getN4KanjiCandidatePack \}/m);
  });

  it('FlashcardsScreen invokes the adapter asynchronously', () => {
    const src = readSrc('screens/FlashcardsScreen.tsx');
    // No synchronous `buildCandidateFlashcardCards()` invocation.
    expect(src).not.toMatch(/= buildCandidateFlashcardCards\(\)/);
    // The async form is used.
    expect(src).toMatch(/await buildCandidateFlashcardCards\(\)/);
  });

  it('KanjiSectionPanel invokes the adapter asynchronously', () => {
    const src = readSrc('screens/KanjiSectionPanel.tsx');
    expect(src).not.toMatch(/= buildCandidateKanjiSection\(\)/);
    expect(src).toMatch(/await buildCandidateKanjiSection\(\)/);
  });

  it('adapter exports are async (return Promise)', () => {
    const fcSrc = readSrc('services/candidateFlashcardAdapter.ts');
    expect(fcSrc).toMatch(/export async function buildCandidateFlashcardCards/);
    expect(fcSrc).toMatch(/export async function getCandidateCardCounts/);
    const kjSrc = readSrc('services/candidateKanjiAdapter.ts');
    expect(kjSrc).toMatch(/export async function buildCandidateKanjiSection/);
    expect(kjSrc).toMatch(/export async function getCandidateKanjiCounts/);
  });
});