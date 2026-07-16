import { describe, expect, it } from 'vitest';

import {
  verbVocabularyCandidateData,
  verbVocabularySourceSnapshot,
} from '../src/data/candidates/verbVocabularyCandidateData';
import { getN5VocabularyCandidatePack } from '../src/data/candidates/n5VocabularyCandidatePack';
import { getN4VocabularyCandidatePack } from '../src/data/candidates/n4CandidatePack';
import { getN3VocabularyCandidatePack } from '../src/data/candidates/n3VocabularyCandidatePack';
import { buildCandidateFlashcardCards } from '../src/services/candidateFlashcardAdapter';
import { createVocabularyEntryFromCandidate } from '../src/services/vocabularyEntryService';

describe('JMdict verb candidate expansion', () => {
  it('contains the reviewed N5, N4, and N3 snapshot without duplicates', () => {
    const counts = Object.fromEntries(['N5', 'N4', 'N3'].map(level => [
      level,
      verbVocabularyCandidateData.filter(entry => entry.level === level).length,
    ]));

    expect(counts).toEqual({ N5: 55, N4: 130, N3: 500 });
    expect(verbVocabularyCandidateData).toHaveLength(685);
    expect(new Set(verbVocabularyCandidateData.map(entry => entry.id)).size).toBe(685);
    expect(new Set(verbVocabularyCandidateData.map(entry => entry.japanese)).size).toBe(685);

    const legacyJapanese = new Set([
      ...getN5VocabularyCandidatePack(),
      ...getN4VocabularyCandidatePack(),
      ...getN3VocabularyCandidatePack(),
    ].filter(entry => !entry.id.startsWith('jmdict-verb-')).map(entry => entry.japanese));
    expect(verbVocabularyCandidateData.some(entry => legacyJapanese.has(entry.japanese))).toBe(false);
  });

  it('preserves exact JMdict provenance and learner-facing verb fields', () => {
    expect(verbVocabularySourceSnapshot).toEqual(expect.objectContaining({
      source: 'jmdict-edrdg',
      sourceArchiveUrl: 'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz',
      sourceGeneratedAt: '2026-07-14',
      archiveSha256: 'F78BBA9D1ADE4D7327BCA7CFC9E9BA5B5F796F69EB7868358B98307F453C3989',
    }));

    for (const entry of verbVocabularyCandidateData) {
      expect(entry.japanese).toBeTruthy();
      expect(entry.kana).toMatch(/[ぁ-ゖァ-ヺー]/u);
      expect(entry.romaji).toBeTruthy();
      expect(entry.english).toMatch(/^to\b/i);
      expect(entry.partOfSpeech).toMatch(/&v(?:1|2|4|5|k|n|r|s|z)/);
      expect(entry.source).toEqual(expect.objectContaining({
        id: 'jmdict-edrdg',
        license: 'CC BY-SA 4.0',
      }));
      expect(entry.source.sourceId).toMatch(/^JMdict:\d+$/);
      expect(entry.levelSource).toBe('japanese-tutor-curation');
      expect(entry.placementEvidence).toMatch(/^(curated-n[45]-verb-list|jmdict-priority-n3-candidate)$/);
      expect(entry.reviewStatus).toBe('approved-for-beta');
    }
  });

  it('locks reviewed readings for ambiguous beginner verbs', () => {
    const byJapanese = new Map(verbVocabularyCandidateData.map(entry => [entry.japanese, entry]));

    expect(byJapanese.get('入る')).toMatchObject({ level: 'N5', kana: 'はいる', romaji: 'hairu' });
    expect(byJapanese.get('弾く')).toMatchObject({ level: 'N5', kana: 'ひく', romaji: 'hiku', english: 'to play (a stringed instrument)' });
    expect(byJapanese.get('被る')).toMatchObject({ level: 'N5', kana: 'かぶる', romaji: 'kaburu' });
    expect(byJapanese.get('くれる')).toMatchObject({ level: 'N5', kana: 'くれる', romaji: 'kureru' });
    expect(byJapanese.get('もらう')).toMatchObject({ level: 'N5', kana: 'もらう', romaji: 'morau' });
    expect(byJapanese.get('回る')).toMatchObject({ level: 'N4', kana: 'まわる', romaji: 'mawaru' });
    expect(byJapanese.get('汚れる')).toMatchObject({ level: 'N4', kana: 'よごれる', romaji: 'yogoreru' });
    expect(byJapanese.get('思う')).toMatchObject({ level: 'N4', kana: 'おもう', romaji: 'omou' });
    expect(byJapanese.get('生きる')).toMatchObject({ level: 'N4', kana: 'いきる', romaji: 'ikiru' });
    expect(byJapanese.get('要る')).toMatchObject({ level: 'N4', kana: 'いる', romaji: 'iru' });
  });

  it('flows every generated verb into the appropriate course pack and flashcards', async () => {
    expect(getN5VocabularyCandidatePack().filter(entry => entry.id.startsWith('jmdict-verb-n5-'))).toHaveLength(55);
    expect(getN4VocabularyCandidatePack().filter(entry => entry.id.startsWith('jmdict-verb-n4-'))).toHaveLength(130);
    expect(getN3VocabularyCandidatePack().filter(entry => entry.id.startsWith('jmdict-verb-n3-'))).toHaveLength(500);

    const cards = await buildCandidateFlashcardCards('N3');
    const verbCards = cards.filter(card => card.vocabularyId?.startsWith('jmdict-verb-'));
    expect(verbCards).toHaveLength(685);
    expect(verbCards.every(card => card.partOfSpeech === 'verb')).toBe(true);
    expect(verbCards.every(card => card.learningGroup === 'verb')).toBe(true);
    expect(verbCards.every(card => card.verbGroup)).toBe(true);
    expect(verbCards.every(card => card.classificationConfidence === 'source')).toBe(true);
  });

  it('uses the JMdict sequence ID in shared vocabulary provenance', () => {
    const source = verbVocabularyCandidateData[0];
    const vocabulary = createVocabularyEntryFromCandidate({
      id: source.id,
      japanese: source.japanese,
      kana: source.kana,
      romaji: source.romaji,
      english: source.english,
      jlptLevel: source.level,
      category: 'verbs',
      sourcePartOfSpeech: source.partOfSpeech,
      sourceKind: `candidate-${source.level.toLowerCase()}` as 'candidate-n5' | 'candidate-n4' | 'candidate-n3',
      source: source.source.id,
      sourceId: source.source.sourceId,
      license: source.source.license,
      reviewStatus: source.reviewStatus,
    });

    expect(vocabulary.sourceRefs?.[0].sourceId).toBe(source.source.sourceId);
  });
});
