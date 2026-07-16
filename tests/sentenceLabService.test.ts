import { describe, expect, it } from 'vitest';
import { getExampleSentencesForApp } from '../src/data/candidates/exampleSentenceCandidatePack';
import { createInMemorySrsStore } from '../src/services/persistentSrsStore';
import { buildAdaptiveLearningSnapshot } from '../src/services/adaptiveLearningService';
import {
  buildMeaningChoices,
  buildSentenceLabSession,
  buildSentenceTokens,
  getMistakeNotebookEntries,
  isSentenceLabEligible,
  isCorrectSentenceOrder,
  recordSentenceLabResult,
  sentenceLabRefId,
} from '../src/services/sentenceLabService';

function seededRandom(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('Listening & Sentence Lab learning flow', () => {
  const sentences = getExampleSentencesForApp().filter(isSentenceLabEligible);

  it('builds four distinct meaning choices and rotates consecutive correct positions', () => {
    const first = buildMeaningChoices(sentences[0], sentences, null, seededRandom(3));
    const second = buildMeaningChoices(sentences[1], sentences, first.correctIndex, seededRandom(3));

    expect(first.choices).toHaveLength(4);
    expect(new Set(first.choices.map(choice => choice.text)).size).toBe(4);
    expect(first.choices[first.correctIndex].sentenceId).toBe(sentences[0].id);
    expect(second.correctIndex).not.toBe(first.correctIndex);
  });

  it('shuffles builder tokens and validates their selected source order', () => {
    const tokens = buildSentenceTokens(sentences.find(sentence => sentence.romaji.split(' ').length >= 3)!, seededRandom(7));
    expect(tokens.length).toBeGreaterThanOrEqual(3);
    expect(isCorrectSentenceOrder(tokens)).toBe(false);
    expect(isCorrectSentenceOrder([...tokens].sort((a, b) => a.sourceIndex - b.sourceIndex))).toBe(true);
    expect(isCorrectSentenceOrder(tokens.slice(0, -1), tokens.length)).toBe(false);
    expect(isCorrectSentenceOrder([tokens[0], tokens[0], ...tokens.slice(2)], tokens.length)).toBe(false);
  });

  it('excludes draft and incomplete sentences from interactive sessions', () => {
    const invalid = {
      ...sentences[0],
      id: 'draft-short',
      reviewStatus: 'sensei-review-needed' as const,
      romaji: 'ohayou',
    };
    expect(isSentenceLabEligible(invalid)).toBe(false);
    const session = buildSentenceLabSession([invalid, ...sentences], [], 10, seededRandom(13));
    expect(session).toHaveLength(10);
    expect(session.every(item => item.sentenceId !== invalid.id)).toBe(true);
    expect(session.every(item => item.tokens?.length !== 0)).toBe(true);
  });

  it('alternates listening and sentence-building exercises', () => {
    const session = buildSentenceLabSession(sentences, [], 10, seededRandom(11));
    expect(session).toHaveLength(10);
    expect(session.map(item => item.kind)).toEqual([
      'listening', 'builder', 'listening', 'builder', 'listening',
      'builder', 'listening', 'builder', 'listening', 'builder',
    ]);
  });

  it('persists wrong answers in the Mistake Notebook and schedules them for review', async () => {
    const srs = createInMemorySrsStore();
    const sentence = sentences[0];
    await recordSentenceLabResult(srs, sentence.id, false);

    const cards = await srs.listCards();
    const notebook = getMistakeNotebookEntries(cards, sentences);
    expect(cards).toHaveLength(1);
    expect(cards[0].refId).toBe(sentenceLabRefId(sentence.id));
    expect(cards[0].stage).toBe('recognized');
    expect(cards[0].intervalDays).toBe(1);
    expect(notebook[0].sentence.id).toBe(sentence.id);
  });

  it('keeps sentence mistakes out of flashcard due and weak-card metrics', async () => {
    const srs = createInMemorySrsStore();
    await recordSentenceLabResult(srs, sentences[2].id, false);
    const cards = await srs.listCards();
    expect(await srs.dueCount()).toBe(0);
    expect(buildAdaptiveLearningSnapshot(cards)).toMatchObject({ totalCards: 0, dueCards: 0, weakCards: 0 });
  });

  it('does not add a correctly answered new sentence, but advances an existing mistake', async () => {
    const srs = createInMemorySrsStore();
    const sentence = sentences[1];
    await recordSentenceLabResult(srs, sentence.id, true);
    expect(await srs.listCards()).toHaveLength(0);

    await recordSentenceLabResult(srs, sentence.id, false);
    await recordSentenceLabResult(srs, sentence.id, true);
    const [card] = await srs.listCards();
    expect(card.repetitions).toBe(1);
    expect(card.easeFactor).toBeGreaterThan(1.3);
  });

  it('prioritizes saved sentence mistakes in the next adaptive session', async () => {
    const srs = createInMemorySrsStore();
    const target = sentences[40];
    await recordSentenceLabResult(srs, target.id, false);
    const cards = await srs.listCards();
    const session = buildSentenceLabSession(sentences, cards, 4, seededRandom(5));
    expect(session.map(item => item.sentenceId)).toContain(target.id);
  });

  it('puts the earliest-due sentence mistake first', () => {
    const later = {
      id: 'later', refId: sentenceLabRefId(sentences[8].id), intervalDays: 6,
      repetitions: 2, easeFactor: 2.3, dueOn: '2026-08-10', lastReviewedOn: '2026-07-10', stage: 'recognized' as const,
    };
    const earlier = {
      id: 'earlier', refId: sentenceLabRefId(sentences[5].id), intervalDays: 1,
      repetitions: 0, easeFactor: 2.1, dueOn: '2026-07-12', lastReviewedOn: '2026-07-11', stage: 'recognized' as const,
    };
    const session = buildSentenceLabSession(sentences, [later, earlier], 2, seededRandom(9));
    expect(session[0].sentenceId).toBe(sentences[5].id);
    expect(session[1].sentenceId).toBe(sentences[8].id);
  });
});
