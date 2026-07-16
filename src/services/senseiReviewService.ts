/**
 * Sensei Translation Review Service
 *
 * Aggregates phrases from every content source so a native speaker can
 * review AI-authored translations on-device. Review decisions are persisted
 * to KV storage as overrides — the static data files stay unchanged so
 * the source of truth remains git-tracked.
 */

import { getAllCourseLessons } from './lessonService';
import { getSurvivalCategories, getSurvivalTopicDetail } from './workplaceSurvivalService';
import { getAllAdditionalLessonCategoryContent } from './additionalLessonContentService';
import { supplementalFlashcards } from '../data/supplementalFlashcards';
import type { LessonItem } from '../types/lesson';
import type { SurvivalPhrase } from '../types/workplaceSurvival';
import type { AdditionalLessonPhrase } from '../types/additionalLessonContent';
import type { SupplementalFlashcardSource } from '../data/supplementalFlashcards';
import type { TranslationReviewStatus } from '../types/lesson';

export type PhraseSource = 'sensei-lesson' | 'workplace-survival' | 'topic-category' | 'supplemental-flashcard';

export interface ReviewablePhrase {
  /** Globally-unique key (source:sourceId) so KV overrides are unambiguous. */
  key: string;
  source: PhraseSource;
  sourceId: string;
  /** Pretty source label, e.g. "Lessons > Workplace Greetings" */
  sourceLabel: string;
  japanese: string;
  romaji: string;
  english: string;
  vietnamese: string;
  filipino: string;
  /** Static status from the data file. */
  baseStatus: TranslationReviewStatus;
  /** Effective status = override ?? baseStatus. */
  effectiveStatus: TranslationReviewStatus;
  /** Whether an override exists. */
  hasOverride: boolean;
  /** Optional edited translations. */
  overrides: Partial<Pick<ReviewablePhrase, 'vietnamese' | 'filipino' | 'english'>>;
}

export interface ReviewDecision {
  status?: TranslationReviewStatus;
  /** Edited translations — only present if reviewer changed them. */
  editedEnglish?: string;
  editedVietnamese?: string;
  editedFilipino?: string;
  /** ISO timestamp of the decision. */
  decidedAt: string;
}

export type ReviewDecisions = Record<string, ReviewDecision>;

const STORAGE_KEY = 'sensei.review.v1';

let inMemoryDecisions: ReviewDecisions = {};

function getKvStore(): { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> } | null {
  // Lazy import to avoid circular dependency with learningContext.
  try {
    const localStorage = (globalThis as { localStorage?: Storage }).localStorage;
    if (localStorage && typeof localStorage.getItem === 'function') {
      return {
        async getItem(key: string) { return localStorage.getItem(key); },
        async setItem(key: string, value: string) { localStorage.setItem(key, value); },
      };
    }
  } catch { /* ignore SSR */ }
  return null;
}

export async function loadReviewDecisions(): Promise<ReviewDecisions> {
  const store = getKvStore();
  if (store) {
    try {
      const raw = await store.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ReviewDecisions;
        inMemoryDecisions = parsed;
        return parsed;
      }
    } catch { /* corrupt JSON — ignore and start fresh */ }
  }
  return inMemoryDecisions;
}

export async function persistReviewDecisions(decisions: ReviewDecisions): Promise<void> {
  inMemoryDecisions = decisions;
  const store = getKvStore();
  if (store) {
    try {
      await store.setItem(STORAGE_KEY, JSON.stringify(decisions));
    } catch { /* best-effort persistence */ }
  }
}

export async function recordReviewDecision(key: string, decision: ReviewDecision): Promise<ReviewDecisions> {
  const current = await loadReviewDecisions();
  const next = { ...current, [key]: { ...current[key], ...decision, decidedAt: decision.decidedAt || new Date().toISOString() } };
  await persistReviewDecisions(next);
  return next;
}

export async function clearReviewDecision(key: string): Promise<ReviewDecisions> {
  const current = await loadReviewDecisions();
  const next = { ...current };
  delete next[key];
  await persistReviewDecisions(next);
  return next;
}

export async function clearAllReviewDecisions(): Promise<ReviewDecisions> {
  await persistReviewDecisions({});
  return {};
}

function makeKey(source: PhraseSource, sourceId: string): string {
  return `${source}:${sourceId}`;
}

function applyDecision(phrase: Omit<ReviewablePhrase, 'effectiveStatus' | 'hasOverride' | 'overrides' | 'key'>, decisions: ReviewDecisions): ReviewablePhrase {
  const key = makeKey(phrase.source, phrase.sourceId);
  const decision = decisions[key];
  const overrides: ReviewablePhrase['overrides'] = {};
  if (decision?.editedEnglish !== undefined && decision.editedEnglish !== phrase.english) overrides.english = decision.editedEnglish;
  if (decision?.editedVietnamese !== undefined && decision.editedVietnamese !== phrase.vietnamese) overrides.vietnamese = decision.editedVietnamese;
  if (decision?.editedFilipino !== undefined && decision.editedFilipino !== phrase.filipino) overrides.filipino = decision.editedFilipino;
  return {
    ...phrase,
    key,
    effectiveStatus: decision?.status ?? phrase.baseStatus,
    hasOverride: !!decision,
    overrides,
  };
}

export async function getAllReviewablePhrases(): Promise<ReviewablePhrase[]> {
  const decisions = await loadReviewDecisions();
  const phrases: Omit<ReviewablePhrase, 'effectiveStatus' | 'hasOverride' | 'overrides' | 'key'>[] = [];

  // Sensei lessons
  for (const lesson of getAllCourseLessons()) {
    for (const item of lesson.items) {
      const vocabulary = item.vocabulary;
      phrases.push({
        source: 'sensei-lesson',
        sourceId: item.id,
        sourceLabel: `Lessons > ${lesson.title}`,
        japanese: vocabulary?.japanese ?? item.japanese,
        romaji: vocabulary?.romaji ?? item.romaji,
        english: vocabulary?.meanings.en.join('; ') ?? item.english,
        vietnamese: vocabulary?.meanings.vi.join('; ') ?? item.vietnamese,
        filipino: vocabulary?.meanings.tl.join('; ') ?? item.filipino,
        baseStatus: item.translationReviewStatus,
      });
    }
  }

  // Workplace survival
  for (const category of getSurvivalCategories()) {
    const detail = getSurvivalTopicDetail(category.id);
    for (const phrase of detail.phrases) {
      phrases.push({
        source: 'workplace-survival',
        sourceId: phrase.id,
        sourceLabel: `Workplace > ${detail.title}`,
        japanese: phrase.japanese,
        romaji: phrase.romaji,
        english: phrase.english,
        vietnamese: phrase.vietnamese,
        filipino: phrase.filipino,
        baseStatus: phrase.translationReviewStatus,
      });
    }
  }

  // Topic categories (Daily, Shopping, etc.)
  for (const category of getAllAdditionalLessonCategoryContent()) {
    for (const phrase of category.phrases) {
      phrases.push({
        source: 'topic-category',
        sourceId: phrase.id,
        sourceLabel: `Topics > ${category.title}`,
        japanese: phrase.japanese,
        romaji: phrase.romaji,
        english: phrase.english,
        vietnamese: phrase.vietnamese,
        filipino: phrase.filipino,
        baseStatus: phrase.translationReviewStatus,
      });
    }
  }

  // Supplemental flashcards
  for (const card of supplementalFlashcards) {
    phrases.push({
      source: 'supplemental-flashcard',
      sourceId: card.id,
      sourceLabel: `Flashcards > ${card.category}`,
      japanese: card.japanese,
      romaji: card.romaji,
      english: card.english,
      vietnamese: card.vietnamese,
      filipino: card.filipino,
      baseStatus: card.translationReviewStatus,
    });
  }

  return phrases.map(p => applyDecision(p, decisions));
}

export async function getReviewProgress(): Promise<{ total: number; draft: number; approved: number; overrides: number }> {
  const all = await getAllReviewablePhrases();
  return {
    total: all.length,
    draft: all.filter(p => p.effectiveStatus === 'draft').length,
    approved: all.filter(p => p.effectiveStatus === 'approved').length,
    overrides: all.filter(p => p.hasOverride).length,
  };
}

/** Apply decision overrides to a static phrase object (used by screens that render phrases). */
export async function withEffectiveStatus<T extends { translationReviewStatus: TranslationReviewStatus; id: string }>(
  source: PhraseSource,
  phrase: T,
): Promise<T & { translationReviewStatus: TranslationReviewStatus }> {
  const decisions = await loadReviewDecisions();
  const key = makeKey(source, phrase.id);
  const decision = decisions[key];
  if (decision?.status) {
    return { ...phrase, translationReviewStatus: decision.status };
  }
  return phrase;
}

/** Bulk export for merging back into data files. */
export async function exportReviewDecisions(): Promise<string> {
  const decisions = await loadReviewDecisions();
  return JSON.stringify(decisions, null, 2);
}

// Type re-exports for screens that need them.
export type { LessonItem, SurvivalPhrase, AdditionalLessonPhrase, SupplementalFlashcardSource };
