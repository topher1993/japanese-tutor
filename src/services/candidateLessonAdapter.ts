import { getN5VocabularyCandidatePack } from '../data/candidates/n5VocabularyCandidatePack';
import { getN4VocabularyCandidatePack } from '../data/candidates/n4CandidatePack';
import { getN4KanjiCandidatePack } from '../data/candidates/n4CandidatePack';

/**
 * Returns counts of approved-for-beta content by category for the Lessons screen banner.
 */
export function getCandidateLessonCounts(): {
  n5Vocab: number;
  n4Vocab: number;
  n5Kanji: number;
  n4Kanji: number;
  total: number;
} {
  const n5 = getN5VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta');
  const n4v = getN4VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta');
  const n4k = getN4KanjiCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta');
  // N5 kanji not currently exposed; count from N5 vocab category count as a proxy
  const n5k = 0;
  return {
    n5Vocab: n5.length,
    n4Vocab: n4v.length,
    n5Kanji: n5k,
    n4Kanji: n4k.length,
    total: n5.length + n4v.length + n4k.length + n5k,
  };
}