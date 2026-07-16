import type { ExampleSentenceCandidateEntry } from '../data/candidates/exampleSentenceCandidatePack';
import { getExampleSentencesForApp } from '../data/candidates/exampleSentenceCandidatePack';
import { grammarLessons } from '../data/grammarLessons';
import type { QuizChoice, QuizContentSource, QuizPracticeMode } from '../types/quiz';
import { getQuickQuiz } from './quizService';
import { buildMeaningChoices, buildSentenceTokens, isSentenceLabEligible, type SentenceBuilderToken } from './sentenceLabService';

export type QuizPracticeQuestion =
  | ChoicePracticeQuestion
  | ListeningPracticeQuestion
  | BuilderPracticeQuestion
  | FillBlankPracticeQuestion;

interface PracticeQuestionBase {
  id: string;
  prompt: string;
  explanation: string;
  source: QuizContentSource;
}

export interface ChoicePracticeQuestion extends PracticeQuestionBase {
  kind: 'choice';
  choices: QuizChoice[];
  correctChoice: QuizChoice['id'];
}

export interface ListeningPracticeQuestion extends PracticeQuestionBase {
  kind: 'listening';
  audioText: string;
  choices: QuizChoice[];
  correctChoice: QuizChoice['id'];
}

export interface BuilderPracticeQuestion extends PracticeQuestionBase {
  kind: 'builder';
  sentenceJapanese: string;
  tokens: SentenceBuilderToken[];
  correctTokenIds: string[];
}

export interface FillBlankPracticeQuestion extends PracticeQuestionBase {
  kind: 'fillBlank';
  sentenceTemplate: string;
  correctAnswer: string;
  acceptableAnswers: string[];
  hint: string;
}

export interface QuizPracticeSession {
  mode: QuizPracticeMode;
  source: QuizContentSource;
  questions: QuizPracticeQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  complete: boolean;
}

export interface QuizPracticeFeedback {
  questionId: string;
  correct: boolean;
  answer: string | undefined;
  correctAnswer: string;
  explanation: string;
}

export interface QuizPracticeResult {
  score: number;
  total: number;
  feedback: QuizPracticeFeedback[];
}

export interface QuizPracticeModeBreakdown {
  kind: QuizPracticeQuestion['kind'];
  label: string;
  score: number;
  total: number;
}

const CHOICE_IDS: QuizChoice['id'][] = ['A', 'B', 'C', 'D'];

interface FillBlankSeed {
  id: string;
  source: 'phrases' | 'grammar';
  prompt: string;
  sentenceTemplate: string;
  correctAnswer: string;
  acceptableAnswers?: string[];
  hint: string;
  explanation: string;
}

const FILL_BLANKS: FillBlankSeed[] = [
  { id: 'phrase-starts', source: 'phrases', prompt: 'Complete the workplace sentence.', sentenceTemplate: '仕事は八時に___。', correctAnswer: '始まります', hint: 'Use the polite form of 始まる.', explanation: '始まります means starts or begins.' },
  { id: 'phrase-repeat', source: 'phrases', prompt: 'Ask politely for something one more time.', sentenceTemplate: 'もう一度___。', correctAnswer: 'お願いします', hint: 'Use the polite request phrase.', explanation: 'もう一度お願いします means one more time, please.' },
  { id: 'phrase-slow', source: 'phrases', prompt: 'Ask someone to speak slowly.', sentenceTemplate: 'ゆっくり___ください。', correctAnswer: '話して', hint: 'Use the て-form of 話す.', explanation: 'ゆっくり話してください means please speak slowly.' },
  { id: 'phrase-location', source: 'phrases', prompt: 'Ask where to put something.', sentenceTemplate: 'これはどこに___ますか。', correctAnswer: '置き', hint: 'Use the verb stem before ますか.', explanation: 'これはどこに置きますか means where should I put this?' },
  { id: 'grammar-i-negative', source: 'grammar', prompt: 'Make the adjective negative.', sentenceTemplate: '今日は暑___です。', correctAnswer: 'くない', hint: 'Change final い to くない.', explanation: 'い-adjectives use くない for the negative form.' },
  { id: 'grammar-i-past', source: 'grammar', prompt: 'Use the polite past form.', sentenceTemplate: '昨日は忙し___です。', correctAnswer: 'かった', hint: 'Change final い to かった.', explanation: 'い-adjectives use かった for the polite past.' },
  { id: 'grammar-na-before-noun', source: 'grammar', prompt: 'Connect the な-adjective to the noun.', sentenceTemplate: '___部屋で勉強します。', correctAnswer: '静かな', hint: 'Use な before a noun.', explanation: 'な-adjectives take な before the noun they modify.' },
  { id: 'grammar-particle-destination', source: 'grammar', prompt: 'Choose the destination particle.', sentenceTemplate: '会社___行きます。', correctAnswer: 'に', acceptableAnswers: ['へ'], hint: 'Use に for a destination.', explanation: 'に marks a destination; へ can also mark direction.' },
  { id: 'grammar-te-request', source: 'grammar', prompt: 'Complete the polite request.', sentenceTemplate: '名前を書い___ください。', correctAnswer: 'て', hint: 'Attach ください to the て-form.', explanation: '書いてください means please write.' },
  { id: 'grammar-obligation', source: 'grammar', prompt: 'Express an obligation.', sentenceTemplate: '安全ルールを守らなけれ___なりません。', correctAnswer: 'ば', hint: 'Use なければなりません.', explanation: 'なければなりません means must do.' },
  { id: 'grammar-experience', source: 'grammar', prompt: 'Complete the experience pattern.', sentenceTemplate: '日本へ行っ___ことがあります。', correctAnswer: 'た', hint: 'Use the plain past before ことがあります.', explanation: '行ったことがあります means have been to Japan.' },
  { id: 'grammar-potential', source: 'grammar', prompt: 'Complete the potential form.', sentenceTemplate: '日本語が話せ___。', correctAnswer: 'ます', hint: 'Use the polite ending after the potential form.', explanation: '話せます means can speak.' },
];

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function take<T>(items: readonly T[], count: number, random: () => number): T[] {
  return shuffle(items, random).slice(0, count);
}

function sourceMatches(source: QuizContentSource, itemSource: 'phrases' | 'grammar'): boolean {
  return source === 'mixed' || source === itemSource;
}

function buildGrammarChoiceQuestions(random: () => number): ChoicePracticeQuestion[] {
  const items = grammarLessons.flatMap(lesson => lesson.items);
  return items.map((item, index) => {
    const vocabulary = item.vocabulary;
    const japanese = vocabulary?.japanese ?? item.japanese;
    const english = vocabulary?.meanings.en.join('; ') ?? item.english;
    const alternatives = take(items.filter(candidate => candidate.id !== item.id), 3, random);
    const raw = [item, ...alternatives];
    const choices = shuffle(raw, random).map((choice, choiceIndex) => ({
      id: CHOICE_IDS[choiceIndex],
      text: choice.vocabulary?.japanese ?? choice.japanese,
    }));
    return {
      id: `grammar-choice-${index}-${item.id}`,
      kind: 'choice' as const,
      prompt: `Which pattern matches this rule? ${english}`,
      choices,
      correctChoice: choices.find(choice => choice.text === japanese)?.id ?? 'A',
      explanation: `${english} Formation: ${item.formation ?? vocabulary?.romaji ?? item.romaji}`,
      source: 'grammar' as const,
    };
  });
}

function buildChoiceQuestions(source: QuizContentSource, random: () => number): ChoicePracticeQuestion[] {
  const authored = getQuickQuiz().questions.map(question => ({
    id: question.id,
    kind: 'choice' as const,
    prompt: question.prompt,
    choices: question.choices,
    correctChoice: question.correctChoice,
    explanation: question.explanation,
    source: 'phrases' as const,
  }));
  const grammar = buildGrammarChoiceQuestions(random);
  return [...(sourceMatches(source, 'phrases') ? authored : []), ...(sourceMatches(source, 'grammar') ? grammar : [])];
}

function sentencePool(source: QuizContentSource): ExampleSentenceCandidateEntry[] {
  const phraseSentences = getExampleSentencesForApp()
    .filter(isSentenceLabEligible)
    .filter(sentence => sentence.category !== 'grammar');
  const grammarSentences = grammarLessons.flatMap(lesson => lesson.items.map(item => {
    const example = item.vocabulary?.examples?.[0];
    return {
      id: `quiz-grammar-example-${item.id}`,
      japanese: example?.japanese ?? item.exampleJapanese,
      romaji: example?.romaji ?? item.exampleRomaji ?? '',
      english: example?.en ?? item.exampleEnglish,
      category: 'grammar',
      jlptLevel: lesson.level === 'N4' ? 'N4' as const : 'N5' as const,
      source: { id: lesson.id, license: 'In-app grammar curriculum' },
      reviewStatus: 'approved-for-beta' as const,
      connectedToApp: true,
    };
  })).filter(isSentenceLabEligible);
  if (source === 'grammar') return grammarSentences;
  if (source === 'phrases') return phraseSentences;
  return [...phraseSentences, ...grammarSentences];
}

function buildListeningQuestions(source: QuizContentSource, count: number, random: () => number): ListeningPracticeQuestion[] {
  const pool = sentencePool(source);
  return take(pool, count, random).map((sentence, index) => {
    const choiceSet = buildMeaningChoices(sentence, pool, null, random);
    const choices = choiceSet.choices.map((choice, choiceIndex) => ({ id: CHOICE_IDS[choiceIndex], text: choice.text }));
    return {
      id: `listening-${source}-${index}-${sentence.id}`,
      kind: 'listening' as const,
      prompt: 'Listen to the Japanese sentence and choose its meaning.',
      audioText: sentence.japanese,
      choices,
      correctChoice: CHOICE_IDS[choiceSet.correctIndex],
      explanation: `${sentence.japanese} means: ${sentence.english}`,
      source: source === 'grammar' ? 'grammar' : 'phrases',
    };
  });
}

function buildBuilderQuestions(source: QuizContentSource, count: number, random: () => number): BuilderPracticeQuestion[] {
  const pool = sentencePool(source);
  return take(pool, count, random).map((sentence, index) => {
    const tokens = buildSentenceTokens(sentence, random);
    return {
      id: `builder-${source}-${index}-${sentence.id}`,
      kind: 'builder' as const,
      prompt: `Build the Japanese sentence for: ${sentence.english}`,
      sentenceJapanese: sentence.japanese,
      tokens,
      correctTokenIds: [...tokens].sort((left, right) => left.sourceIndex - right.sourceIndex).map(token => token.id),
      explanation: `${sentence.japanese} means: ${sentence.english}`,
      source: source === 'grammar' ? 'grammar' : 'phrases',
    };
  });
}

function buildFillBlankQuestions(source: QuizContentSource, count: number, random: () => number): FillBlankPracticeQuestion[] {
  return take(FILL_BLANKS.filter(item => sourceMatches(source, item.source)), count, random).map(item => ({
    id: `fill-${item.id}`,
    kind: 'fillBlank' as const,
    prompt: item.prompt,
    sentenceTemplate: item.sentenceTemplate,
    correctAnswer: item.correctAnswer,
    acceptableAnswers: [item.correctAnswer, ...(item.acceptableAnswers ?? [])],
    hint: item.hint,
    explanation: item.explanation,
    source: item.source,
  }));
}

export function buildQuizPracticeSession(
  mode: QuizPracticeMode = 'mixed',
  source: QuizContentSource = 'mixed',
  count = 10,
  random: () => number = Math.random,
): QuizPracticeSession {
  const choices = buildChoiceQuestions(source, random);
  const listening = buildListeningQuestions(source, count, random);
  const builders = buildBuilderQuestions(source, count, random);
  const fillBlanks = buildFillBlankQuestions(source, count, random);
  let questions: QuizPracticeQuestion[];

  if (mode === 'listening') questions = listening;
  else if (mode === 'builder') questions = builders;
  else if (mode === 'fillBlank') questions = fillBlanks;
  else {
    questions = [
      ...take(choices, 3, random),
      ...take(listening, 3, random),
      ...take(builders, 2, random),
      ...take(fillBlanks, 2, random),
    ];
  }

  return { mode, source, questions: take(questions, count, random), currentIndex: 0, answers: {}, complete: questions.length === 0 };
}

export function getCurrentPracticeQuestion(session: QuizPracticeSession): QuizPracticeQuestion | undefined {
  return session.questions[session.currentIndex];
}

export function getQuizPracticeProgress(session: QuizPracticeSession) {
  return {
    current: Math.min(session.currentIndex + 1, session.questions.length),
    total: session.questions.length,
    answered: Object.keys(session.answers).length,
    complete: session.complete,
  };
}

function normalizeAnswer(answer: string): string {
  return answer.toLowerCase().replace(/[。、.!?？]/g, '').replace(/\s+/g, '').trim();
}

export function gradeQuizPracticeAnswer(question: QuizPracticeQuestion, answer: string): boolean {
  if (question.kind === 'choice' || question.kind === 'listening') return answer === question.correctChoice;
  if (question.kind === 'builder') return answer.split('|').filter(Boolean).join('|') === question.correctTokenIds.join('|');
  const normalized = normalizeAnswer(answer);
  return question.acceptableAnswers.some(candidate => normalizeAnswer(candidate) === normalized);
}

export function answerQuizPracticeQuestion(session: QuizPracticeSession, answer: string): QuizPracticeSession {
  const question = getCurrentPracticeQuestion(session);
  if (!question) return { ...session, complete: true };
  const nextIndex = session.currentIndex + 1;
  return {
    ...session,
    answers: { ...session.answers, [question.id]: answer },
    currentIndex: nextIndex,
    complete: nextIndex >= session.questions.length,
  };
}

export function finishQuizPracticeSession(session: QuizPracticeSession): QuizPracticeResult {
  const feedback = session.questions.map(question => {
    const answer = session.answers[question.id];
    const correct = answer !== undefined && gradeQuizPracticeAnswer(question, answer);
    const correctAnswer = question.kind === 'choice' || question.kind === 'listening'
      ? question.correctChoice
      : question.kind === 'builder'
        ? question.correctTokenIds.join('|')
        : question.correctAnswer;
    return { questionId: question.id, correct, answer, correctAnswer, explanation: question.explanation };
  });
  return { score: feedback.filter(item => item.correct).length, total: feedback.length, feedback };
}

export function getQuizPracticeModeBreakdown(
  session: QuizPracticeSession,
  result: QuizPracticeResult = finishQuizPracticeSession(session),
): QuizPracticeModeBreakdown[] {
  const byKind = new Map<QuizPracticeQuestion['kind'], { score: number; total: number }>();
  session.questions.forEach((question, index) => {
    const current = byKind.get(question.kind) ?? { score: 0, total: 0 };
    current.total += 1;
    if (result.feedback[index]?.correct) current.score += 1;
    byKind.set(question.kind, current);
  });
  const labels: Record<QuizPracticeQuestion['kind'], string> = {
    choice: 'Multiple choice',
    listening: 'Listening',
    builder: 'Sentence building',
    fillBlank: 'Fill in the blank',
  };
  return Array.from(byKind.entries()).map(([kind, counts]) => ({
    kind,
    label: labels[kind],
    ...counts,
  }));
}

export function buildRetryMissedQuizSession(session: QuizPracticeSession): QuizPracticeSession {
  const result = finishQuizPracticeSession(session);
  const missedIds = new Set(result.feedback.filter(item => !item.correct).map(item => item.questionId));
  const questions = session.questions.filter(question => missedIds.has(question.id));
  return {
    ...session,
    questions,
    currentIndex: 0,
    answers: {},
    complete: questions.length === 0,
  };
}
