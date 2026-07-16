import { describe, expect, it } from 'vitest';
import { adjectiveVocabularyCandidateData } from '../src/data/candidates/adjectiveVocabularyCandidateData';
import { buildCandidateFlashcardCards } from '../src/services/candidateFlashcardAdapter';

describe('JMdict adjective candidate expansion', () => {
  it('contains a 500-entry, deduplicated adjective pack with readings', () => {
    expect(adjectiveVocabularyCandidateData).toHaveLength(500);
    expect(new Set(adjectiveVocabularyCandidateData.map(entry => entry.japanese)).size).toBe(500);
    expect(adjectiveVocabularyCandidateData.every(entry => entry.partOfSpeech.includes('adj-'))).toBe(true);
    expect(adjectiveVocabularyCandidateData.every(entry => entry.kana.length > 0 && entry.romaji.length > 0 && entry.english.length > 0)).toBe(true);
    expect(adjectiveVocabularyCandidateData.every(entry => entry.source.id === 'jmdict-edrdg')).toBe(true);
  });

  it('keeps small-tsu consonant gemination in approved romaji', () => {
    const romajiByKana = new Map(adjectiveVocabularyCandidateData.map(entry => [entry.kana, entry.romaji]));

    expect(romajiByKana.get('おおざっぱ')).toBe('oozappa');
    expect(romajiByKana.get('いっしょ')).toBe('issho');
    expect(romajiByKana.get('きゃっかん')).toBe('kyakkan');
    expect(romajiByKana.get('せっちゅう')).toBe('secchuu');
  });

  it('flows the expanded pack into the adjective learning group', async () => {
    const candidates = await buildCandidateFlashcardCards('N3');
    expect(candidates.filter(card => card.learningGroup === 'adjective').length).toBeGreaterThanOrEqual(500);
  });
});
