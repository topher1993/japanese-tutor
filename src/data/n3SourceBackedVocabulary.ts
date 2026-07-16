import { getN3VocabularyCandidatePack } from './candidates/n3VocabularyCandidatePack';
import type { LessonCategory, LessonItem } from '../types/lesson';
import { createVocabularyEntry } from '../services/vocabularyEntryService';

type SourceBackedItemInput = {
  candidateId: string;
  id: string;
  vietnamese: string;
  filipino: string;
  category: LessonCategory;
  exampleJapanese: string;
  exampleRomaji: string;
  exampleEnglish: string;
};

const candidates = new Map(
  getN3VocabularyCandidatePack().map(candidate => [candidate.id, candidate]),
);

function buildSourceBackedItem(input: SourceBackedItemInput): LessonItem {
  const candidate = candidates.get(input.candidateId);
  if (!candidate) {
    throw new Error(`Missing JMdict-backed N3 candidate: ${input.candidateId}`);
  }

  const vocabulary = createVocabularyEntry({
    id: candidate.id,
    japanese: candidate.japanese,
    kana: candidate.kana,
    romaji: candidate.romaji,
    english: candidate.english,
    vietnamese: input.vietnamese,
    filipino: input.filipino,
    jlptLevel: 'N3',
    category: input.category,
    topics: [input.category],
    sourcePartOfSpeech: candidate.partOfSpeech,
    sourceKind: 'candidate-n3',
    sourceRefs: [{
      source: candidate.source.id,
      sourceId: candidate.id,
      license: candidate.source.license,
      usage: 'vocabulary',
    }],
    reviewStatus: candidate.reviewStatus,
  });

  return {
    id: input.id,
    vocabularyId: vocabulary.id,
    vocabulary,
    japanese: vocabulary.japanese,
    romaji: vocabulary.romaji,
    english: vocabulary.meanings.en.join('; '),
    vietnamese: vocabulary.meanings.vi.join('; '),
    filipino: vocabulary.meanings.tl.join('; '),
    category: input.category,
    exampleJapanese: input.exampleJapanese,
    exampleRomaji: input.exampleRomaji,
    exampleEnglish: input.exampleEnglish,
    translationReviewStatus: 'approved',
    contentReviewStatus: 'source-backed-candidate',
    sourceRefs: vocabulary.sourceRefs,
  };
}

/**
 * JMdict-backed vocabulary references added to the N3 starter lessons.
 * Grammar explanations and example sentences remain authored in-app; these
 * records provide dictionary-level evidence for the featured N3 terms.
 */
export const n3SourceBackedLessonItems: Record<string, LessonItem> = {
  'lesson-n3-connectors': buildSourceBackedItem({
    candidateId: 'jmdict-adj-0004',
    id: 'item-n3-source-juubun',
    vietnamese: 'Sự chuẩn bị đầy đủ.',
    filipino: 'Sapat ang paghahanda.',
    category: 'grammar',
    exampleJapanese: '準備は十分です。',
    exampleRomaji: 'junbi wa juubun desu.',
    exampleEnglish: 'The preparation is sufficient.',
  }),
  'lesson-n3-relative-clauses': buildSourceBackedItem({
    candidateId: 'jmdict-adj-0005',
    id: 'item-n3-source-tekikaku',
    vietnamese: 'người đưa ra lời giải thích chính xác',
    filipino: 'taong nagbibigay ng tumpak na paliwanag',
    category: 'daily-life',
    exampleJapanese: '的確な説明をする人',
    exampleRomaji: 'tekikaku na setsumei o suru hito',
    exampleEnglish: 'a person who gives an accurate explanation',
  }),
  'lesson-n3-workplace-explanations': buildSourceBackedItem({
    candidateId: 'jmdict-adj-0034',
    id: 'item-n3-source-fujuubun',
    vietnamese: 'Vì lời giải thích chưa đầy đủ, tôi sẽ kiểm tra lại.',
    filipino: 'Dahil kulang ang paliwanag, susuriin ko itong muli.',
    category: 'workplace',
    exampleJapanese: '説明が不十分なため、もう一度確認します。',
    exampleRomaji: 'setsumei ga fujuubun na tame, mou ichido kakunin shimasu.',
    exampleEnglish: 'Because the explanation is insufficient, I will check again.',
  }),
  'lesson-n3-reading-details': buildSourceBackedItem({
    candidateId: 'jmdict-adj-0083',
    id: 'item-n3-source-issai',
    vietnamese: 'Vui lòng tuyệt đối không thay đổi gì.',
    filipino: 'Huwag na huwag baguhin ang anuman.',
    category: 'daily-life',
    exampleJapanese: '一切変更しないでください。',
    exampleRomaji: 'issai henkou shinaide kudasai.',
    exampleEnglish: 'Please do not change anything at all.',
  }),
  'lesson-n3-review-and-plans': buildSourceBackedItem({
    candidateId: 'jmdict-adj-0109',
    id: 'item-n3-source-fuan',
    vietnamese: 'Tôi hơi lo lắng về công việc mới.',
    filipino: 'Medyo nag-aalala ako sa bagong trabaho.',
    category: 'workplace',
    exampleJapanese: '新しい仕事が少し不安です。',
    exampleRomaji: 'atarashii shigoto ga sukoshi fuan desu.',
    exampleEnglish: 'I feel a little anxious about the new job.',
  }),
};
