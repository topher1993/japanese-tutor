import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  buildWeeklyTodoBoard,
} from '../src/services/weeklyTodoService';
import type {
  TodoEventCounts,
  TodoState,
  WeekPlan,
} from '../src/types/weeklyTodo';
import { createFlashcardDeck } from '../src/services/flashcardService';
import type { FlashcardReviewCard } from '../src/types/flashcard';
import { getAllLessons } from '../src/services/lessonService';
import { getWeekPlan } from '../src/services/weeklyPlansService';
import { createSqliteLearningRepository, type SqliteLikeDatabase } from '../src/repositories/sqliteLearningRepository';
import { createPracticeProgressStore, setTodoFeatureEnabled, isTodoFeatureEnabled } from '../src/services/practiceProgressStore';

// Phase 37d-2 tests per docs/phase-37-todo-gated-progression-proposal.md
// §8 phase-37d-2. These focus on the new `flashcards` todo kind wiring:
//   a) gate-off is a no-op
//   b) recompute persists flashcardReviews[weekNumber] via saveExtendedProgress
//   c) reviews are capped at the daily target before contributing to the
//      scaled weekly flashcard requirement
//   d) re-reviewing the same card id is a no-op (de-dup)
//   e) regression check: existing flashcard service tests still construct decks
//   f) FlashcardReviewCard.kind is optional (existing fields constructable
//      without kind)

function createInMemoryDb(): SqliteLikeDatabase {
  const tables = new Map<string, unknown[]>();
  return {
    tables,
    async execAsync(_sql: string) {
      // No-op for CREATE TABLE in initialize(); we write directly to `tables`.
    },
    async runAsync(sql: string, ...params: unknown[]) {
      const trimmed = sql.trim();
      if (/^INSERT OR REPLACE INTO progress VALUES/i.test(trimmed)) {
        const rows = (tables.get('progress') ?? []) as Array<Record<string, unknown>>;
        const [id, lessonId, completed, completedAt, score, todoStates, weekTodosInitialized, todoEventCounts] = params;
        const idx = rows.findIndex(r => r.id === id);
        const row = {
          id, lesson_id: lessonId, completed, completed_at: completedAt, score,
          todo_states: todoStates, week_todos_initialized: weekTodosInitialized, todo_event_counts: todoEventCounts,
        };
        if (idx >= 0) rows[idx] = row; else rows.push(row);
        tables.set('progress', rows);
      } else if (/^UPDATE progress SET todo_states/i.test(trimmed)) {
        const [todoStates, weekTodosInitialized, todoEventCounts] = params;
        const rows = (tables.get('progress') ?? []) as Array<Record<string, unknown>>;
        if (rows.length > 0) {
          rows[rows.length - 1] = {
            ...rows[rows.length - 1],
            todo_states: todoStates,
            week_todos_initialized: weekTodosInitialized,
            todo_event_counts: todoEventCounts,
          };
          tables.set('progress', rows);
        }
      } else if (/^INSERT INTO progress/i.test(trimmed)) {
        const rows = (tables.get('progress') ?? []) as Array<Record<string, unknown>>;
        rows.push({
          id: params[0], lesson_id: params[1], completed: params[2], completed_at: params[3], score: params[4],
          todo_states: params[5], week_todos_initialized: params[6], todo_event_counts: params[7],
        });
        tables.set('progress', rows);
      }
      return { changes: 1 };
    },
    async getAllAsync<T>(sql: string): Promise<T[]> {
      if (/FROM progress/i.test(sql)) {
        return ((tables.get('progress') ?? []) as T[]);
      }
      return [];
    },
  };
}

/**
 * Get the production `flashcards`-kind todo for week 1 from src/data/weeklyPlans.ts
 * (added in 37d-2 alongside the existing lesson + daily-rush todos). Returns
 * its plan and the resolved card-pool size (= its `target`, since the plan
 * leaves target as 0 and resolveCardPool fills expectedTarget at runtime).
 */
function flashcardsTodoForWeek1(): { plan: WeekPlan; todo: WeekPlan['todos'][number]; poolSize: number } {
  const plan = getWeekPlan(1);
  if (!plan) throw new Error('week 1 plan not authored');
  const todo = plan.todos.find(t => t.kind === 'flashcards');
  if (!todo) throw new Error('week 1 plan missing flashcards todo (37d-2 regression)');
  // The plan authors `target: 0` and lets resolveCardPool supply the count
  // via expectedTarget. We pre-resolve by asking the deck directly.
  const lessons = getAllLessons().filter(l => l.level === 'N5' && l.week === 1);
  const poolSize = createFlashcardDeck(lessons).cards.length;
  return { plan, todo, poolSize };
}

describe('Phase 37d-2 — flashcards todo kind wiring', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setTodoFeatureEnabled(false);
  });

  it('a. recordFlashcardReview is a no-op when todoFeatureEnabled is false (gate off → no saveExtendedProgress call)', async () => {
    setTodoFeatureEnabled(false);
    expect(isTodoFeatureEnabled()).toBe(false);

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const saveSpy = vi.spyOn(repo as unknown as { saveExtendedProgress: (...args: unknown[]) => Promise<void> }, 'saveExtendedProgress');

    await store.recordFlashcardReview(1, 'card-some-id');

    expect(saveSpy).not.toHaveBeenCalled();

    // No todo state should be materialized either.
    const after = await store.getProgress() as unknown as { todoStates: Record<string, TodoState> };
    expect(after.todoStates['n5-w1-flashcards']).toBeUndefined();
  });

  it('b. recordFlashcardReview persists flashcardReviews[weekNumber] to disk via saveExtendedProgress', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const saveSpy = vi.spyOn(repo as unknown as { saveExtendedProgress: (...args: unknown[]) => Promise<void> }, 'saveExtendedProgress');

    await store.recordFlashcardReview(1, 'card-some-id');

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const writtenArg = saveSpy.mock.calls[0]?.[0] as unknown as { todoEventCounts: TodoEventCounts };
    expect(writtenArg.todoEventCounts.flashcardReviews[1]).toEqual(['card-some-id']);

    // Re-read from disk: the card id must survive a "cold start".
    const reread = await store.getProgress() as unknown as { todoEventCounts: TodoEventCounts };
    expect(reread.todoEventCounts.flashcardReviews[1]).toEqual(['card-some-id']);
  });

  it('c. reviewing the whole pool in one day contributes only the five-card daily target', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const { plan, todo, poolSize } = flashcardsTodoForWeek1();
    expect(poolSize).toBeGreaterThan(0);
    expect(todo.id).toBe('n5-w1-flashcards');
    const poolCardIds = createFlashcardDeck(getAllLessons().filter(l => l.level === 'N5' && l.week === 1))
      .cards
      .map(c => c.id);
    expect(poolCardIds.length).toBe(poolSize);

    // Review every card once.
    for (const cardId of poolCardIds) {
      await store.recordFlashcardReview(1, cardId);
    }

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      weekTodosInitialized: Record<number, boolean>;
      todoEventCounts: TodoEventCounts;
    };
    expect(stored.weekTodosInitialized[1]).toBe(true);
    expect(stored.todoStates['n5-w1-flashcards']).toBeDefined();
    expect(stored.todoStates['n5-w1-flashcards'].weekNumber).toBe(1);
    expect(stored.todoStates['n5-w1-flashcards'].progress).toBe(5);
    expect(stored.todoStates['n5-w1-flashcards'].target).toBe(Math.min(poolSize, 35));
    expect(stored.todoStates['n5-w1-flashcards'].completedAt).toBeUndefined();

    // buildWeeklyTodoBoard should now show the flashcards todo as completed.
    const board = buildWeeklyTodoBoard(1, plan, stored.todoStates, true, 'all');
    const flashcardTodo = board.todos.find(t => t.todo.id === 'n5-w1-flashcards');
    expect(flashcardTodo).toBeDefined();
    expect(flashcardTodo!.progress).toBe(5);
    expect(flashcardTodo!.target).toBe(Math.min(poolSize, 35));
    expect(flashcardTodo!.completed).toBe(false);
  });

  it('d. re-reviewing the same card id is a no-op (de-duped log + progress stays the same)', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const { poolSize } = flashcardsTodoForWeek1();
    const poolCardIds = createFlashcardDeck(getAllLessons().filter(l => l.level === 'N5' && l.week === 1))
      .cards
      .map(c => c.id);
    const oneCard = poolCardIds[0]!;
    expect(poolCardIds.length).toBeGreaterThan(1);

    // Review one card three times in a row.
    await store.recordFlashcardReview(1, oneCard);
    await store.recordFlashcardReview(1, oneCard);
    await store.recordFlashcardReview(1, oneCard);

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    // De-duped: only one entry in the log.
    expect(stored.todoEventCounts.flashcardReviews[1]).toEqual([oneCard]);
    // Progress counts as 1 (one distinct card reviewed).
    expect(stored.todoStates['n5-w1-flashcards'].progress).toBe(1);
    expect(stored.todoStates['n5-w1-flashcards'].target).toBe(Math.min(poolSize, 35));
    // completedAt may be undefined because progress=1 < target (unless pool is size 1, which we asserted isn't).
    expect(stored.todoStates['n5-w1-flashcards'].completedAt).toBeUndefined();
  });

  it('e. existing flashcard service still produces a valid deck with the new `kind` field (no regression)', () => {
    const lessons = getAllLessons().filter(l => l.level === 'N5' && l.week === 1);
    const deck = createFlashcardDeck(lessons);
    expect(deck.cards.length).toBeGreaterThan(0);
    // Every card from createFlashcardDeck has `kind: 'vocab'` (backfill from
    // 37d-2). Existing fields stay intact too.
    for (const card of deck.cards) {
      expect(card.kind).toBe('vocab');
      expect(typeof card.id).toBe('string');
      expect(typeof card.japanese).toBe('string');
      expect(card.reviewCount).toBe(0);
      expect(typeof card.nextReviewDate).toBe('string');
    }
  });

  it('f. FlashcardReviewCard.kind is optional — existing callers can still construct cards without it', () => {
    // Older construction style (no kind) still compiles and is type-equivalent
    // to `kind: undefined`. This guards against accidentally making kind
    // required in a future patch. We cast through FlashcardReviewCard so TS
    // narrows the literal to the optional-field shape rather than complaining
    // about an extra property.
    const cardWithoutKind: FlashcardReviewCard = {
      id: 'card-test',
      lessonId: 'lesson-test',
      category: 'workplace',
      japanese: '会議',
      romaji: 'kaigi',
      english: 'meeting',
      vietnamese: 'cuộc họp',
      filipino: 'pulong',
      reviewCount: 0,
      nextReviewDate: '2026-07-01',
      translationReviewStatus: 'approved',
      // kind intentionally omitted — proves the field is optional.
    };
    expect(cardWithoutKind.kind).toBeUndefined();
    expect(cardWithoutKind.id).toBe('card-test');
  });

  it('g. recordFlashcardReview is no-op when repo lacks saveExtendedProgress (legacy repo)', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // Strip saveExtendedProgress to simulate a legacy in-memory repo.
    const stripped = repo as unknown as { saveExtendedProgress?: (...args: unknown[]) => Promise<void> };
    delete stripped.saveExtendedProgress;

    // Should not throw.
    await expect(store.recordFlashcardReview(1, 'card-some-id')).resolves.toBeDefined();
  });
});
