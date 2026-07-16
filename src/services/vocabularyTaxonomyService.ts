import type {
  ClassificationConfidence,
  JapanesePartOfSpeech,
  JapaneseVerbGroup,
  VerbTransitivity,
  VocabularyLearningGroup,
  VocabularyTaxonomy,
  VocabularyTaxonomyInput,
} from '../types/vocabulary';

export type {
  ClassificationConfidence,
  JapanesePartOfSpeech,
  JapaneseVerbGroup,
  VerbTransitivity,
  VocabularyLearningGroup,
  VocabularyTaxonomy,
  VocabularyTaxonomyInput,
} from '../types/vocabulary';

const N5_ADVERBS = new Set([
  'ちょっと', 'すぐ', 'また', 'まだ', 'もう', '全然', 'とても', '少し', 'たくさん',
  '多分', '少少',
]);

const INTERROGATIVE_ADVERBS = new Set(['いつ', 'どうして', 'なぜ', 'どうやって']);

const GODAN_RU_EXCEPTIONS = new Set([
  '帰る', '走る', '入る', '要る', '知る', '切る', '売る', '作る', '取る', '撮る',
  '送る', '終わる', '変わる', '分かる', '困る', '怒る', '踊る', '受け取る', '座る',
  '止まる', '渡る', '始まる', '下がる', '上がる', '残る', '守る', '直る', '治る',
]);

const TRANSITIVE_VERBS = new Set([
  '食べる', '飲む', '見る', '聞く', '話す', '言う', '書く', '読む', '買う', '売る',
  '作る', '使う', '閉じる', '始める', '待つ', '渡す', '受け取る', '送る', '届ける',
  '知る', '教える', '習う', '探す', '見つける', '失くす', '忘れる', '覚える',
  '考える', '決める', '選ぶ', '開ける',
]);

const INTRANSITIVE_VERBS = new Set([
  '行く', '来る', '帰る', '働く', '休む', '寝る', '起きる', '走る', '歩く', '泳ぐ',
  '住む', '遊ぶ', '笑う', '泣く', '怒る', '驚く', '困る', '終わる', '分かる',
  '変わる', '開く', '始まる',
]);

const I_ROW = 'いきぎしじちぢにひびぴみり';
const E_ROW = 'えけげせぜてでねへべぺめれ';

export const VOCABULARY_LEARNING_GROUPS: VocabularyLearningGroup[] = [
  'noun', 'verb', 'adjective', 'expression',
];

export function learningGroupFor(partOfSpeech: JapanesePartOfSpeech): VocabularyLearningGroup {
  if (partOfSpeech === 'verb') return 'verb';
  if (partOfSpeech === 'i-adjective' || partOfSpeech === 'na-adjective' || partOfSpeech === 'adjectival-expression') return 'adjective';
  if (partOfSpeech === 'noun' || partOfSpeech === 'pronoun' || partOfSpeech === 'determiner' || partOfSpeech === 'counter') return 'noun';
  return 'expression';
}

export function learningGroupLabel(group: VocabularyLearningGroup): string {
  return group === 'noun' ? 'Noun' : group === 'verb' ? 'Verb' : group === 'adjective' ? 'Adjective' : 'Expression';
}

export function partOfSpeechLabel(partOfSpeech: JapanesePartOfSpeech): string {
  const labels: Record<JapanesePartOfSpeech, string> = {
    noun: 'Noun', verb: 'Verb', 'i-adjective': 'い-adjective', 'na-adjective': 'な-adjective',
    'adjectival-expression': 'Adjectival expression', adverb: 'Adverb', particle: 'Particle',
    pronoun: 'Pronoun', determiner: 'Determiner', counter: 'Counter', conjunction: 'Conjunction',
    expression: 'Expression',
  };
  return labels[partOfSpeech];
}

function adjectivePart(input: VocabularyTaxonomyInput): JapanesePartOfSpeech {
  const hasMultipleWords = input.romaji.trim().split(/\s+/).length > 1;
  if (hasMultipleWords || input.japanese === '同じ' || input.japanese.endsWith('の') || input.japanese.endsWith('がち')) return 'adjectival-expression';
  if (input.japanese.endsWith('い') && !input.japanese.endsWith('きれい') && input.japanese !== '嫌い' && input.japanese !== '綺麗') {
    return 'i-adjective';
  }
  return 'na-adjective';
}

function inferVerbGroup(input: VocabularyTaxonomyInput): JapaneseVerbGroup | undefined {
  const word = input.japanese.trim();
  const reading = (input.reading ?? '').split(/[\/／]/)[0].trim();
  const source = input.sourcePartOfSpeech?.trim().toLowerCase() ?? '';
  if (/&(?:vk|vs(?:-c|-i|-s)?|vz);/.test(source)) return 'irregular';
  if (/&v1(?:-s)?;/.test(source)) return 'ichidan';
  if (/&v(?:2[^;]*|4[^;]*|5[^;]*|n|r);/.test(source)) return 'godan';
  if (word.endsWith('する') || word === '来る' || reading === 'くる') return 'irregular';
  if (GODAN_RU_EXCEPTIONS.has(word)) return 'godan';
  if (!word.endsWith('る')) return 'godan';
  const beforeRu = (reading || word).slice(-2, -1);
  if (I_ROW.includes(beforeRu) || E_ROW.includes(beforeRu)) return 'ichidan';
  return 'godan';
}

function transitivityFor(input: VocabularyTaxonomyInput): VerbTransitivity | undefined {
  const source = input.sourcePartOfSpeech?.trim().toLowerCase() ?? '';
  const sourceTransitive = source.includes('&vt;');
  const sourceIntransitive = source.includes('&vi;');
  if (sourceTransitive !== sourceIntransitive) return sourceTransitive ? 'transitive' : 'intransitive';
  if (TRANSITIVE_VERBS.has(input.japanese)) return 'transitive';
  if (INTRANSITIVE_VERBS.has(input.japanese)) return 'intransitive';
  return undefined;
}

function normalizeSourcePart(input: VocabularyTaxonomyInput): JapanesePartOfSpeech | null {
  const source = input.sourcePartOfSpeech?.trim().toLowerCase();
  if (!source) return null;
  if (source.includes('phrase') || source.includes('expression')) return 'expression';
  if (source.includes('adverb')) return 'adverb';
  if (source.includes('particle')) return 'particle';
  if (source.includes('pronoun')) return 'pronoun';
  if (source.includes('counter')) return 'counter';
  if (source.includes('conjunction')) return 'conjunction';
  if (source.includes('adjective') || source.includes('adj-')) return adjectivePart(input);
  if (/&(?:v1(?:-s)?|v2[^;]*|v4[^;]*|v5[^;]*|vk|vn|vr|vs(?:-c|-i|-s)?|vz);/.test(source)) return 'verb';
  if (source.includes('verb')) return 'verb';
  if (source.includes('noun')) return 'noun';
  return null;
}

function classifyPart(input: VocabularyTaxonomyInput): { part: JapanesePartOfSpeech; confidence: ClassificationConfidence } {
  const sourcePart = normalizeSourcePart(input);
  if (sourcePart) return { part: sourcePart, confidence: 'source' };

  if (input.sourceKind === 'lesson') {
    if (/^to\s+/i.test(input.english.trim())) return { part: 'verb', confidence: 'inferred' };
    const multiword = input.romaji.trim().split(/\s+/).length > 1;
    const politeOrInflected = /(ます|ません|ました|です|でした|ください|ましょう|でしょう|たい)$/.test(input.japanese.trim());
    if (multiword || politeOrInflected) return { part: 'expression', confidence: 'inferred' };
    if (input.japanese.endsWith('い') && input.japanese !== '嫌い' && input.japanese !== '綺麗') {
      return { part: 'i-adjective', confidence: 'inferred' };
    }
    return { part: 'noun', confidence: 'inferred' };
  }

  const category = input.category?.trim().toLowerCase();
  if (category === 'verbs') return { part: 'verb', confidence: 'rule' };
  if (category === 'adjectives') return { part: adjectivePart(input), confidence: 'rule' };
  if (category === 'counters') return { part: 'counter', confidence: 'rule' };
  if (category === 'grammar') return { part: 'particle', confidence: 'rule' };
  if (category === 'demonstratives') {
    if (INTERROGATIVE_ADVERBS.has(input.japanese)) return { part: 'adverb', confidence: 'rule' };
    return { part: input.japanese.endsWith('の') ? 'determiner' : 'pronoun', confidence: 'rule' };
  }
  if (category === 'greetings') return { part: 'expression', confidence: 'rule' };
  if (category === 'expressions') {
    return { part: N5_ADVERBS.has(input.japanese) ? 'adverb' : 'expression', confidence: 'rule' };
  }
  if (/^to\s+/i.test(input.english.trim())) return { part: 'verb', confidence: 'inferred' };
  // Supplemental and topic-organized N5 packs are overwhelmingly lexical
  // nouns. The explicit rules above capture their verbs, adjectives,
  // counters, particles, demonstratives, greetings, and adverbs first.
  return { part: 'noun', confidence: input.sourceKind === 'supplemental' ? 'source' : 'inferred' };
}

export function classifyVocabulary(input: VocabularyTaxonomyInput): VocabularyTaxonomy {
  const { part, confidence } = classifyPart(input);
  const taxonomy: VocabularyTaxonomy = {
    partOfSpeech: part,
    learningGroup: learningGroupFor(part),
    classificationConfidence: confidence,
  };
  if (part === 'verb') {
    taxonomy.dictionaryForm = input.japanese;
    taxonomy.verbGroup = inferVerbGroup(input);
    taxonomy.transitivity = transitivityFor(input);
  } else if (part === 'i-adjective' || part === 'na-adjective') {
    taxonomy.dictionaryForm = input.japanese;
  }
  return taxonomy;
}

export function taxonomyDetailLabel(taxonomy: Pick<VocabularyTaxonomy, 'partOfSpeech' | 'verbGroup'>): string {
  const part = partOfSpeechLabel(taxonomy.partOfSpeech);
  if (!taxonomy.verbGroup) return part;
  const group = taxonomy.verbGroup === 'godan' ? 'Godan' : taxonomy.verbGroup === 'ichidan' ? 'Ichidan' : 'Irregular';
  return `${part} · ${group}`;
}
