// Phase 37b — Card-pool resolver for `flashcards` and `kanji` todos.
// Per docs/phase-37-todo-gated-progression-proposal.md §3.1 + §11.
//
// QC round-2 P1-1: getLessonCategoryCards DOES NOT EXIST. The real source
// of all flashcards is createFlashcardDeck (src/services/flashcardService.ts),
// which merges each lesson's `items` with the global `supplementalFlashcards`
// table. We filter the lessons by weekNumber, then call createFlashcardDeck
// and return the deck's card ids (in deck order).

import { getAllCourseLessons } from './lessonService';
import { createFlashcardDeck } from './flashcardService';
import type { WeekTodo } from '../types/weeklyTodo';

export interface CardPoolResolution {
  cardIds: string[];
  source: 'week' | 'level' | 'lesson-set' | 'kanji-set' | 'empty';
  /** Override target when undefined at the todo level (flashcards-only). */
  expectedTarget?: number;
}

function emptyPool(): CardPoolResolution {
  return { cardIds: [], source: 'empty' };
}

/**
 * Resolve a `WeekTodo.pool` spec to a concrete list of card ids.
 *
 * - 'week'   → cards from lessons whose `week === weekNumber` (pool includes
 *              supplemental cards because createFlashcardDeck merges them).
 * - 'level'  → cards from lessons at the JLPT level of week 1 (N5). The
 *              proposal pointed this at userProfileService which lives in a
 *              later phase; for 37b we resolve against N5-only lessons.
 * - explicit string  → treated as an already-resolved id list, passed through.
 * - undefined        → empty resolution; caller renders "no pool configured".
 */
export function resolveCardPool(
  poolSpec: WeekTodo['pool'],
  weekNumber: number,
): CardPoolResolution {
  if (poolSpec == null) return emptyPool();
  if (poolSpec === 'week') {
    const lessons = getAllCourseLessons().filter(lesson => lesson.week === weekNumber);
    const deck = createFlashcardDeck(lessons);
    const cardIds = deck.cards.map(card => card.id);
    if (cardIds.length === 0) return emptyPool();
    return { cardIds, source: 'week', expectedTarget: cardIds.length };
  }
  if (poolSpec === 'level') {
    // 37b: N5 is the only level authored. Proposal §11.4 deferred per-learner
    // JLPT target to a later phase; we conservatively resolve to N5 lessons.
    const lessons = getAllCourseLessons().filter(lesson => lesson.level === 'N5');
    const deck = createFlashcardDeck(lessons);
    const cardIds = deck.cards.map(card => card.id);
    if (cardIds.length === 0) return emptyPool();
    return { cardIds, source: 'level', expectedTarget: cardIds.length };
  }
  // Explicit pool string: treat as a passthrough id list. Validator is the
  // caller's responsibility (the proposal describes this as a passthrough).
  if (typeof poolSpec === 'string') {
    const cardIds = poolSpec.split(',').map(s => s.trim()).filter(Boolean);
    if (cardIds.length === 0) return emptyPool();
    return { cardIds, source: 'lesson-set' };
  }
  return emptyPool();
}

/**
 * Resolve a `WeekTodo.kanjiSet` spec to a list of kanji-card ids.
 *
 * Per 37d-3 deferred: kind=KanjiCard annotation hasn't shipped yet, so today
 * `kanjiSet` is just an explicit list of card ids authored in weeklyPlans.ts.
 * The resolver is the passthrough validator from the proposal §3.1.
 */
export function resolveKanjiSet(
  kanjiSetSpec: WeekTodo['kanjiSet'],
): CardPoolResolution {
  if (!kanjiSetSpec || kanjiSetSpec.length === 0) return emptyPool();
  return { cardIds: [...kanjiSetSpec], source: 'kanji-set', expectedTarget: kanjiSetSpec.length };
}
