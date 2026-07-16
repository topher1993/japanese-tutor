import type { KoiProviderAnswer } from './types.js';

export const KOI_GOVERNED_NOTES_LICENSE_ID = 'APP-OWNED-KOI-NOTES-1.0' as const;

export interface GovernedKoiKnowledgeFact {
  factId: string;
  text: string;
  /** Conservative lexical anchors used to verify that a cited fact is reflected in the answer. */
  answerSignals: readonly string[];
}

export interface GovernedKoiKnowledgeSource {
  sourceId: string;
  title: string;
  licenseId: typeof KOI_GOVERNED_NOTES_LICENSE_ID;
  facts: readonly GovernedKoiKnowledgeFact[];
}

interface RegistryEntry {
  source: GovernedKoiKnowledgeSource;
  matches: (normalizedQuestion: string) => boolean;
}

export type KoiGroundingSelection =
  | { kind: 'supported'; sources: readonly GovernedKoiKnowledgeSource[] }
  | { kind: 'not_grounded'; reason: 'unsupported_topic' | 'unsafe_input' }
  | { kind: 'out_of_scope'; reason: 'not_japanese_learning' };

const normalized = (value: string): string => value.normalize('NFKC').toLowerCase();

const asciiWord = (value: string, word: string): boolean => (
  new RegExp(`(?:^|[^a-z0-9])${word}(?:$|[^a-z0-9])`, 'u').test(value)
);

const hasAny = (value: string, terms: readonly string[]): boolean => (
  terms.some((term) => value.includes(term))
);

const hasQuestionCue = (value: string): boolean => hasAny(value, [
  'particle',
  'grammar',
  'mean',
  'meaning',
  'difference',
  'different',
  'compare',
  'when do',
  'when should',
  'how do',
  'how should',
  'how to',
  'mark',
  'use ',
  'used',
  '助詞',
  '文法',
  '意味',
  '違い',
  '使い',
  'trợ từ',
  'ngữ pháp',
  'nghĩa',
  'khác nhau',
  'pagkakaiba',
  'ibig sabihin',
  'gamit',
]);

const source = (
  sourceId: string,
  title: string,
  facts: readonly GovernedKoiKnowledgeFact[],
): GovernedKoiKnowledgeSource => ({
  sourceId,
  title,
  licenseId: KOI_GOVERNED_NOTES_LICENSE_ID,
  facts,
});

const registry: readonly RegistryEntry[] = [
  {
    source: source('koi-note-particles-wa-ga-v1', 'Koi Notes: Topic and Subject Particles は and が', [
      {
        factId: 'wa-topic',
        text: 'The particle は is written with the kana ha but is normally pronounced wa when it marks the topic. It presents what the sentence is about and can add contrast.',
        answerSignals: ['は', 'topic', 'contrast', 'pronounced wa'],
      },
      {
        factId: 'ga-subject',
        text: 'The particle が marks a grammatical subject and commonly identifies or focuses who or what performs an action or satisfies a description.',
        answerSignals: ['が', 'subject', 'identify', 'focus'],
      },
      {
        factId: 'wa-ga-choice',
        text: 'A safe beginner guide is to use は to set or contrast a topic and が to identify or focus the subject; context can change the nuance.',
        answerSignals: ['は', 'が', 'topic', 'subject', 'context', 'nuance'],
      },
    ]),
    matches: (question) => {
      const wa = question.includes('は') || asciiWord(question, 'wa');
      const ga = question.includes('が') || asciiWord(question, 'ga');
      return (wa || ga) && (hasQuestionCue(question) || (wa && ga));
    },
  },
  {
    source: source('koi-note-particles-o-ni-de-v1', 'Koi Notes: Core Particles を, に, and で', [
      {
        factId: 'o-object',
        text: 'The particle を, normally pronounced o, marks the direct object of many action verbs.',
        answerSignals: ['を', 'direct object', 'object particle', 'pronounced o'],
      },
      {
        factId: 'ni-target-time',
        text: 'The particle に commonly marks a destination, a target or recipient, a point in time, or a location of existence.',
        answerSignals: ['に', 'destination', 'target', 'recipient', 'time', 'existence'],
      },
      {
        factId: 'de-action-location',
        text: 'The particle で commonly marks where an action happens or the means or tool used to perform it.',
        answerSignals: ['で', 'action happens', 'means', 'tool', 'location of an action'],
      },
      {
        factId: 'ni-de-location-choice',
        text: 'For beginner location choices, に is used with existence or a destination, while で is used for the place where an action occurs.',
        answerSignals: ['に', 'で', 'existence', 'destination', 'action occurs'],
      },
    ]),
    matches: (question) => {
      const o = question.includes('を') || asciiWord(question, 'wo');
      const ni = question.includes('に') || asciiWord(question, 'ni');
      const de = question.includes('で') || asciiWord(question, 'de');
      return (o || ni || de) && hasQuestionCue(question);
    },
  },
  {
    source: source('koi-note-polite-desu-masu-v1', 'Koi Notes: Polite です and ます Forms', [
      {
        factId: 'desu-role',
        text: 'です is a polite copula used after nouns and many adjective predicates; it is not attached directly to the dictionary form of a verb.',
        answerSignals: ['です', 'copula', 'noun', 'adjective', 'polite'],
      },
      {
        factId: 'masu-role',
        text: 'ます is the polite non-past ending attached to a verb stem. Its common forms include ません, ました, and ませんでした.',
        answerSignals: ['ます', 'ません', 'ました', 'verb stem', 'polite'],
      },
      {
        factId: 'desu-common-forms',
        text: 'Common polite copula forms are です, ではありません or じゃありません, でした, and ではありませんでした or じゃありませんでした.',
        answerSignals: ['です', 'ではありません', 'じゃありません', 'でした'],
      },
    ]),
    matches: (question) => (
      hasAny(question, ['です', 'ます', 'ません', 'でした', 'desu', 'masu'])
      && (hasQuestionCue(question) || hasAny(question, ['polite', 'formal', 'negative', 'past', 'copula']))
    ),
  },
  {
    source: source('koi-note-verb-conjugation-v1', 'Koi Notes: Beginner Japanese Verb Conjugation', [
      {
        factId: 'verb-groups',
        text: 'Beginner conjugation groups are commonly described as ichidan verbs, godan verbs, and the irregular verbs する and 来る.',
        answerSignals: ['ichidan', 'godan', '一段', '五段', 'する', '来る', 'verb group'],
      },
      {
        factId: 'ichidan-stem',
        text: 'For a typical ichidan verb, remove the final る to form the stem; for example 食べる becomes 食べ before endings such as ます and ない.',
        answerSignals: ['ichidan', '食べる', '食べ', 'remove', 'final る'],
      },
      {
        factId: 'godan-change',
        text: 'Godan verbs change the final kana row when conjugated, so their negative and polite stems cannot be formed by only removing る.',
        answerSignals: ['godan', 'final kana', 'kana row', 'removing る'],
      },
      {
        factId: 'te-form-use',
        text: 'The て-form connects actions and appears in patterns such as てください and ています; its formation depends on the verb group and final kana.',
        answerSignals: ['て-form', 'て form', 'て形', 'てください', 'ています'],
      },
    ]),
    matches: (question) => hasAny(question, [
      'ichidan',
      'godan',
      'u-verb',
      'ru-verb',
      'verb group',
      'verb conjug',
      'dictionary form',
      'て-form',
      'te-form',
      'て form',
      'te form',
      'て形',
      '一段',
      '五段',
      '動詞活用',
    ]),
  },
  {
    source: source('koi-note-adjectives-v1', 'Koi Notes: い-Adjectives and な-Adjectives', [
      {
        factId: 'i-adjective',
        text: 'An い-adjective normally conjugates its final い: 高い becomes 高くない in the negative and 高かった in the past.',
        answerSignals: ['い-adjective', 'い adjective', '高い', '高くない', '高かった', 'final い'],
      },
      {
        factId: 'na-adjective',
        text: 'A な-adjective uses な before a noun, as in 静かな町, but does not keep な before です, as in 町は静かです.',
        answerSignals: ['な-adjective', 'な adjective', '静かな', '静かです', 'before a noun'],
      },
      {
        factId: 'adjective-polite-forms',
        text: 'In polite speech, an い-adjective can end in です, while a な-adjective predicate uses forms of the copula such as です and でした.',
        answerSignals: ['い-adjective', 'な-adjective', 'です', 'でした', 'polite'],
      },
    ]),
    matches: (question) => hasAny(question, [
      'い-adjective',
      'i-adjective',
      'い adjective',
      'i adjective',
      'な-adjective',
      'na-adjective',
      'な adjective',
      'na adjective',
      '形容詞',
      '高くない',
      '静かな',
    ]),
  },
  {
    source: source('koi-note-everyday-phrases-v1', 'Koi Notes: Everyday Greetings and Courtesy Phrases', [
      {
        factId: 'greetings',
        text: 'おはようございます is a polite morning greeting, while こんにちは is a common daytime greeting.',
        answerSignals: ['おはようございます', 'こんにちは', 'morning', 'daytime', 'greeting'],
      },
      {
        factId: 'thanks',
        text: 'ありがとうございます is a polite way to say thank you; どうも can add emphasis but is context-dependent by itself.',
        answerSignals: ['ありがとうございます', 'thank you', 'thanks', 'どうも'],
      },
      {
        factId: 'sumimasen',
        text: 'すみません can be used to get attention, apologize lightly, or express thanks for someone taking trouble.',
        answerSignals: ['すみません', 'attention', 'apolog', 'thanks'],
      },
      {
        factId: 'yoroshiku',
        text: 'よろしくお願いします is a context-sensitive courtesy phrase often used when beginning a relationship, making a request, or asking for continued goodwill.',
        answerSignals: ['よろしくお願いします', 'request', 'goodwill', 'relationship', 'courtesy'],
      },
    ]),
    matches: (question) => hasAny(question, [
      'おはようございます',
      'こんにちは',
      'ありがとうございます',
      'すみません',
      'よろしくお願いします',
      'ohayou gozaimasu',
      'konnichiwa',
      'arigatou gozaimasu',
      'sumimasen',
      'yoroshiku onegaishimasu',
    ]),
  },
] as const;

export const KOI_GOVERNED_KNOWLEDGE_SOURCES = registry.map((entry) => entry.source);

const unsafeInputPatterns: readonly RegExp[] = [
  /\b(?:ignore|disregard|forget|override)\b.{0,50}\b(?:previous|prior|system|developer|instructions?|prompt)\b/isu,
  /\b(?:reveal|show|print|repeat|leak|expose)\b.{0,50}\b(?:system|developer|hidden)\b.{0,30}\b(?:prompt|instructions?)\b/isu,
  /<\s*\/?\s*(?:system|developer|assistant)\b/iu,
  /\b(?:system|developer)\s*:\s*/iu,
  /\b(?:password|passcode|api[ _-]?key|secret key|access token|bearer token|subscription key)\b/iu,
];

const looksLikeJapaneseLearning = (question: string): boolean => (
  /[\u3040-\u30ff\u3400-\u9fff]/u.test(question)
  || hasAny(question, [
    'japanese',
    'nihongo',
    'jlpt',
    'kana',
    'kanji',
    'particle',
    'grammar',
    'conjug',
    'adjective',
    'verb',
    'phrase',
    'translate',
    '助詞',
    '文法',
    '日本語',
    'trợ từ',
    'ngữ pháp',
  ])
);

export function selectGovernedKoiKnowledge(question: string): KoiGroundingSelection {
  const value = normalized(question.trim());
  if (!value || unsafeInputPatterns.some((pattern) => pattern.test(value))) {
    return { kind: 'not_grounded', reason: 'unsafe_input' };
  }

  const sources = registry
    .filter((entry) => entry.matches(value))
    .map((entry) => entry.source)
    .slice(0, 3);

  if (sources.length > 0) return { kind: 'supported', sources };
  if (looksLikeJapaneseLearning(value)) {
    return { kind: 'not_grounded', reason: 'unsupported_topic' };
  }
  return { kind: 'out_of_scope', reason: 'not_japanese_learning' };
}

export function createGroundingFallback(
  status: 'out_of_scope' | 'not_grounded',
): KoiProviderAnswer {
  const text = status === 'out_of_scope'
    ? 'I can only answer Japanese-learning questions covered by my reviewed Koi Notes.'
    : 'I do not have a reviewed Koi Note that safely supports an answer to that yet.';
  return {
    status,
    text,
    spokenText: text,
    expression: 'thinking',
    citations: [],
  };
}

