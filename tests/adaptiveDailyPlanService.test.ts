import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FlashcardReviewCard } from '../src/types/flashcard';
import type { ReviewCard } from '../src/services/spacedRepetitionService';
import { buildAdaptiveDailyPlan } from '../src/services/adaptiveDailyPlanService';
import { buildMasteryMap } from '../src/services/masteryService';

function row(overrides: Partial<ReviewCard> & Pick<ReviewCard, 'id' | 'refId'>): ReviewCard {
  return {
    intervalDays: 1, repetitions: 0, easeFactor: 2.5, dueOn: '2026-07-11',
    lastReviewedOn: null, stage: 'memorized', ...overrides,
  };
}

function flashcard(id: string, learningGroup: FlashcardReviewCard['learningGroup']): FlashcardReviewCard {
  return {
    id, lessonId: 'lesson', category: 'test', japanese: id, romaji: id, english: id,
    vietnamese: '', filipino: '', reviewCount: 0, nextReviewDate: '2026-07-11',
    translationReviewStatus: 'approved', kind: 'vocab', learningGroup,
  };
}

describe('Adaptive Daily Plan 2.0', () => {
  it('never exceeds the learner time budget and puts due retrieval first', () => {
    const srsCards = [
      row({ id: '1', refId: 'noun-1' }),
      row({ id: '2', refId: 'verb-1' }),
      row({ id: '3', refId: 'sentence-lab:one' }),
    ];
    const plan = buildAdaptiveDailyPlan({
      date: '2026-07-11', budgetMinutes: 10, srsCards,
      flashcards: [flashcard('noun-1', 'noun'), flashcard('verb-1', 'verb')],
      lessonTitle: 'Greetings',
    });
    expect(plan.plannedMinutes).toBeLessThanOrEqual(10);
    expect(plan.tasks[0].route).toBe('flashcards-due');
    expect(plan.tasks[1].route).toBe('sentence-lab');
    expect(plan.tasks.every(task => task.reason.length > 15)).toBe(true);
  });

  it('adapts to 2, 5, 10, 15, and 30 minute profile targets', () => {
    for (const budgetMinutes of [2, 5, 10, 15, 30] as const) {
      const plan = buildAdaptiveDailyPlan({ date: '2026-07-11', budgetMinutes, srsCards: [], flashcards: [] });
      expect(plan.budgetMinutes).toBe(budgetMinutes);
      expect(plan.plannedMinutes).toBe(budgetMinutes);
      expect(plan.tasks.length).toBeGreaterThan(0);
    }
  });

  it('identifies the weakest word type from live SRS and routes directly to it', () => {
    const cards = [flashcard('v1', 'verb'), flashcard('v2', 'verb'), flashcard('n1', 'noun')];
    const srsCards = [
      row({ id: '1', refId: 'v1', stage: 'recognized' }),
      row({ id: '2', refId: 'v2', easeFactor: 1.9 }),
      row({ id: '3', refId: 'n1', stage: 'recognized' }),
    ];
    const plan = buildAdaptiveDailyPlan({ date: '2026-07-11', budgetMinutes: 10, srsCards, flashcards: cards });
    expect(plan.weakestGroup).toBe('verb');
    expect(plan.tasks.find(task => task.route === 'flashcards-weak')).toMatchObject({ learningGroup: 'verb' });
  });

  it('uses multidimensional mastery as the stronger weak-group signal', () => {
    const cards = [flashcard('v1', 'verb'), flashcard('a1', 'adjective')];
    const srsCards = [
      row({ id: '1', refId: 'v1', repetitions: 4, intervalDays: 20 }),
      row({ id: '2', refId: 'a1', repetitions: 4, intervalDays: 20 }),
    ];
    const masteryMap = buildMasteryMap({
      flashcards: cards,
      srsCards,
      evidence: [
        { id: 'v', refId: 'v1', modality: 'listening', score: 1, source: 'listening', occurredAt: '2026-07-11T10:00:00Z' },
        { id: 'a', refId: 'a1', modality: 'listening', score: 0.1, source: 'listening', occurredAt: '2026-07-11T10:00:00Z' },
      ],
      now: new Date('2026-07-11T12:00:00Z'),
    });
    const plan = buildAdaptiveDailyPlan({ date: '2026-07-11', budgetMinutes: 10, srsCards, flashcards: cards, masteryMap });
    expect(plan.weakestGroup).toBe('adjective');
    expect(plan.tasks.find(task => task.route === 'flashcards-weak')?.reason).toContain('weakest skill dimension');
  });

  it('removes activities already completed today and replaces them with useful work', () => {
    const incomplete = buildAdaptiveDailyPlan({
      date: '2026-07-11', budgetMinutes: 15, srsCards: [], flashcards: [], lessonTitle: 'Lesson A',
    });
    const completed = buildAdaptiveDailyPlan({
      date: '2026-07-11', budgetMinutes: 15, srsCards: [], flashcards: [], lessonTitle: 'Lesson A',
      dailyActivity: {
        lessonIds: ['lesson-a'], dailyRushCompleted: true,
        flashcardReviewIds: ['1', '2', '3', '4', '5'], quizCompleted: true,
      },
    });
    expect(incomplete.tasks.some(task => task.route === 'lesson')).toBe(true);
    expect(incomplete.tasks.some(task => task.route === 'daily-rush')).toBe(true);
    expect(completed.tasks.some(task => task.route === 'lesson')).toBe(false);
    expect(completed.tasks.some(task => task.route === 'daily-rush')).toBe(false);
    expect(completed.tasks.some(task => task.route === 'quiz')).toBe(false);
    expect(completed.tasks.some(task => task.route === 'new-vocabulary')).toBe(true);
  });

  it('keeps Sentence Lab mistakes separate from flashcard due and weakness counts', () => {
    const plan = buildAdaptiveDailyPlan({
      date: '2026-07-11', budgetMinutes: 5,
      srsCards: [row({ id: 's1', refId: 'sentence-lab:one', stage: 'recognized' })],
      flashcards: [],
    });
    expect(plan.dueFlashcards).toBe(0);
    expect(plan.dueSentenceMistakes).toBe(1);
    expect(plan.tasks[0].route).toBe('sentence-lab');
  });

  it('introduces new vocabulary only after required review tasks', () => {
    const plan = buildAdaptiveDailyPlan({
      date: '2026-07-11', budgetMinutes: 30,
      srsCards: [row({ id: 'd1', refId: 'n1' })], flashcards: [flashcard('n1', 'noun')],
    });
    const dueIndex = plan.tasks.findIndex(task => task.route === 'flashcards-due');
    const newIndex = plan.tasks.findIndex(task => task.route === 'new-vocabulary');
    expect(dueIndex).toBeGreaterThanOrEqual(0);
    expect(newIndex).toBeGreaterThan(dueIndex);
  });

  it('wires explainable tasks, direct routing, and live recalculation into Home', () => {
    const home = readFileSync('src/screens/HomeScreen.tsx', 'utf8');
    const card = readFileSync('src/components/AdaptiveDailyPlanCard.tsx', 'utf8');
    const navigation = readFileSync('src/app/useAppNavigation.ts', 'utf8');
    expect(home).toContain('buildAdaptiveDailyPlan');
    expect(home).toContain('handleAdaptiveTask');
    expect(home).toContain('AdaptiveDailyPlanCard');
    expect(home).toContain("track('adaptive_plan_task_opened'");
    expect(card).toContain('The plan recalculates from current progress whenever you return Home.');
    expect(card).toContain('adaptive-plan-cta-');
    expect(navigation).toContain('onPracticeWordGroup');
  });
});
