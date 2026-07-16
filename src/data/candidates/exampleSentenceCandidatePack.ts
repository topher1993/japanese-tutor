export type SentenceReviewStatus = 'candidate' | 'sensei-review-needed' | 'approved-for-beta' | 'rejected';

export interface SentenceSource {
  id: string;
  license: string;
}

export interface ExampleSentenceCandidateEntry {
  id: string;
  japanese: string;
  romaji: string;
  english: string;
  category: string;
  jlptLevel: 'N5' | 'N4' | 'N3';
  source: SentenceSource;
  reviewStatus: SentenceReviewStatus;
  connectedToApp: boolean;
}

import { mockSenseiLessons } from '../mockSenseiLessons';
import { exampleSentenceCandidatePack } from './exampleSentenceCandidateData';

export function getExampleSentenceCandidatePack(): ExampleSentenceCandidateEntry[] {
  return exampleSentenceCandidatePack;
}

export function getLessonExampleSentencePack(): ExampleSentenceCandidateEntry[] {
  return mockSenseiLessons.flatMap(lesson => lesson.items.map(item => {
    const example = item.vocabulary?.examples?.[0];
    return {
    id: `lesson-example-${item.id}`,
    japanese: example?.japanese ?? item.exampleJapanese,
    romaji: example?.romaji ?? item.exampleRomaji ?? '',
    english: example?.en ?? item.exampleEnglish,
    category: item.category,
    jlptLevel: lesson.level === 'N3' ? 'N3' : lesson.level === 'N4' ? 'N4' : 'N5',
    source: {
      id: lesson.id,
      license: 'In-app Sensei lesson content',
    },
    reviewStatus: item.translationReviewStatus === 'approved' ? 'approved-for-beta' : 'sensei-review-needed',
    connectedToApp: true,
    };
  }));
}

export function getExampleSentencesForApp(): ExampleSentenceCandidateEntry[] {
  const connectedCandidates = getExampleSentenceCandidatePack().filter(sentence => sentence.connectedToApp);
  return [...connectedCandidates, ...getLessonExampleSentencePack()];
}
