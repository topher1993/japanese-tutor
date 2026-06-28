import { getN5VocabularyCandidatePack } from '../data/candidates/n5VocabularyCandidatePack';
import { getN4VocabularyCandidatePack } from '../data/candidates/n4CandidatePack';

/**
 * Counts of approved-for-beta vocabulary available to the Review Mode pool.
 */
export function getCandidateReviewCounts(): { n5: number; n4: number; total: number } {
  const n5 = getN5VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta').length;
  const n4 = getN4VocabularyCandidatePack().filter(e => e.reviewStatus === 'approved-for-beta').length;
  return { n5, n4, total: n5 + n4 };
}