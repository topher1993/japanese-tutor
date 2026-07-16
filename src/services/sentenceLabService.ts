import type { ExampleSentenceCandidateEntry } from '../data/candidates/exampleSentenceCandidatePack';
import type { PersistentSpacedRepetitionScheduler } from './persistentSrsStore';
import type { ReviewCard } from './spacedRepetitionService';

export const SENTENCE_LAB_REF_PREFIX = 'sentence-lab:';

export interface SentenceChoice {
  text: string;
  sentenceId: string;
}

export interface SentenceBuilderToken {
  id: string;
  text: string;
  sourceIndex: number;
}

export interface SentenceLabExercise {
  sentenceId: string;
  kind: 'listening' | 'builder';
  choices?: SentenceChoice[];
  correctChoiceIndex?: number;
  tokens?: SentenceBuilderToken[];
}

export interface MistakeNotebookEntry {
  sentence: ExampleSentenceCandidateEntry;
  card: ReviewCard;
  due: boolean;
}

/**
 * Sentence Lab only uses content that is safe for an interactive exercise.
 * Draft lesson examples and one-word/empty-romaji entries cannot support the
 * builder exercise, so admitting them would create an answer with no tokens.
 */
export function isSentenceLabEligible(sentence: ExampleSentenceCandidateEntry): boolean {
  const romajiTokens = sentence.romaji
    .replace(/[.!?]+$/g, '')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
  return sentence.reviewStatus === 'approved-for-beta'
    && sentence.japanese.trim().length > 0
    && sentence.english.trim().length > 0
    && romajiTokens.length >= 2;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sentenceLabRefId(sentenceId: string): string {
  return `${SENTENCE_LAB_REF_PREFIX}${sentenceId}`;
}

export function sentenceIdFromLabRef(refId: string): string | null {
  return refId.startsWith(SENTENCE_LAB_REF_PREFIX)
    ? refId.slice(SENTENCE_LAB_REF_PREFIX.length)
    : null;
}

export function buildMeaningChoices(
  sentence: ExampleSentenceCandidateEntry,
  pool: readonly ExampleSentenceCandidateEntry[],
  previousCorrectIndex: number | null = null,
  random: () => number = Math.random,
): { choices: SentenceChoice[]; correctIndex: number } {
  const distractors = pool
    .filter(isSentenceLabEligible)
    .filter(item => item.id !== sentence.id && item.english !== sentence.english)
    .sort((a, b) => {
      const aScore = Number(a.jlptLevel === sentence.jlptLevel) + Number(a.category === sentence.category);
      const bScore = Number(b.jlptLevel === sentence.jlptLevel) + Number(b.category === sentence.category);
      return bScore - aScore;
    });
  const picked = shuffle(distractors.slice(0, 24), random).slice(0, 3);
  const raw: SentenceChoice[] = [sentence, ...picked].map(item => ({
    text: item.english,
    sentenceId: item.id,
  }));
  let choices = shuffle(raw, random);
  let correctIndex = choices.findIndex(choice => choice.sentenceId === sentence.id);
  if (choices.length > 1 && previousCorrectIndex != null && correctIndex === previousCorrectIndex) {
    const swapIndex = (correctIndex + 1 + Math.floor(random() * (choices.length - 1))) % choices.length;
    [choices[correctIndex], choices[swapIndex]] = [choices[swapIndex], choices[correctIndex]];
    correctIndex = swapIndex;
  }
  return { choices, correctIndex };
}

export function buildSentenceTokens(
  sentence: ExampleSentenceCandidateEntry,
  random: () => number = Math.random,
): SentenceBuilderToken[] {
  const source = sentence.romaji
    .replace(/[.!?]+$/g, '')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
    .map((text, sourceIndex) => ({ id: `${sentence.id}-${sourceIndex}`, text, sourceIndex }));
  if (source.length < 2) return source;
  let shuffled = shuffle(source, random);
  if (shuffled.every((token, index) => token.sourceIndex === index)) {
    shuffled = [...shuffled.slice(1), shuffled[0]];
  }
  return shuffled;
}

export function isCorrectSentenceOrder(
  tokens: readonly SentenceBuilderToken[],
  expectedTokenCount = tokens.length,
): boolean {
  if (expectedTokenCount === 0 || tokens.length !== expectedTokenCount) return false;
  if (new Set(tokens.map(token => token.sourceIndex)).size !== expectedTokenCount) return false;
  return tokens.every((token, index) => token.sourceIndex === index);
}

export function buildSentenceLabSession(
  pool: readonly ExampleSentenceCandidateEntry[],
  mistakeCards: readonly ReviewCard[] = [],
  count = 10,
  random: () => number = Math.random,
): SentenceLabExercise[] {
  const eligiblePool = pool.filter(isSentenceLabEligible);
  const byId = new Map(eligiblePool.map(sentence => [sentence.id, sentence]));
  const priorityIds = [...mistakeCards]
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.easeFactor - b.easeFactor || a.repetitions - b.repetitions)
    .map(card => sentenceIdFromLabRef(card.refId))
    .filter((id): id is string => Boolean(id && byId.has(id)));
  const orderedIds = [
    ...new Set([
      ...priorityIds,
      ...shuffle(eligiblePool.map(sentence => sentence.id), random),
    ]),
  ].slice(0, Math.min(count, eligiblePool.length));

  let previousCorrectIndex: number | null = null;
  return orderedIds.map((sentenceId, index) => {
    const sentence = byId.get(sentenceId)!;
    if (index % 2 === 0) {
      const choiceSet = buildMeaningChoices(sentence, pool, previousCorrectIndex, random);
      previousCorrectIndex = choiceSet.correctIndex;
      return {
        sentenceId,
        kind: 'listening' as const,
        choices: choiceSet.choices,
        correctChoiceIndex: choiceSet.correctIndex,
      };
    }
    return {
      sentenceId,
      kind: 'builder' as const,
      tokens: buildSentenceTokens(sentence, random),
    };
  });
}

export function getMistakeNotebookEntries(
  cards: readonly ReviewCard[],
  pool: readonly ExampleSentenceCandidateEntry[],
  now = new Date(),
): MistakeNotebookEntry[] {
  const byId = new Map(pool.filter(isSentenceLabEligible).map(sentence => [sentence.id, sentence]));
  const today = localDateKey(now);
  return cards
    .map(card => {
      const id = sentenceIdFromLabRef(card.refId);
      const sentence = id ? byId.get(id) : undefined;
      return sentence ? { sentence, card, due: card.dueOn <= today } : null;
    })
    .filter((entry): entry is MistakeNotebookEntry => entry != null)
    .sort((a, b) => Number(b.due) - Number(a.due) || a.card.dueOn.localeCompare(b.card.dueOn));
}

export async function recordSentenceLabResult(
  srs: PersistentSpacedRepetitionScheduler,
  sentenceId: string,
  correct: boolean,
): Promise<void> {
  const refId = sentenceLabRefId(sentenceId);
  const cards = await srs.listCards();
  let card = cards.find(item => item.refId === refId);
  if (!card && correct) return;
  card = card ?? srs.createCard(refId);
  // Sentence mistakes use the same scheduling math but stay in the
  // recognized stage so flashcard-only due counts do not include them.
  // The Mistake Notebook reads their dueOn directly.
  if (card.stage !== 'recognized') {
    card = await srs.setStage(card.id, 'recognized');
  }
  await srs.review(card.id, correct ? 'good' : 'again');
  await srs.flush();
}
