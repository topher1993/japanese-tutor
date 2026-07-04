import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAllWeekPlans } from '../src/services/weeklyPlansService';
import { buildAllTodoBoards, isWeekUnlocked, type TodoPayload } from '../src/services/weeklyTodoService';
import { emptyTodoEventCounts } from '../src/types/weeklyTodo';

const ROOT = join(__dirname, '..');
const LESSONS_SCREEN = join(ROOT, 'src', 'screens', 'LessonsScreen.tsx');

function loadLessonsScreen(): string {
  return readFileSync(LESSONS_SCREEN, 'utf8');
}

describe('phase 40 — Lessons tab todo-gate regression', () => {
  it('pure gate: completing all Week 1 lessons is not enough to unlock Week 2 when other todos remain', () => {
    const plans = getAllWeekPlans();
    const week1 = plans.find(plan => plan.weekNumber === 1)!;
    const lessonTodo = week1.todos.find(todo => todo.kind === 'lesson')!;
    const lessonIds = lessonTodo.lessonIds ?? [];
    expect(lessonIds.length).toBeGreaterThan(0);

    const payload: TodoPayload = {
      todoStates: {
        [lessonTodo.id]: {
          todoId: lessonTodo.id,
          weekNumber: 1,
          progress: lessonIds.length,
          target: lessonIds.length,
          completedAt: Date.now(),
        },
        // Daily Rush + flashcards intentionally omitted / incomplete.
      },
      weekTodosInitialized: { 1: true },
      todoEventCounts: emptyTodoEventCounts(),
      completedLessonIds: lessonIds,
    };

    const boards = buildAllTodoBoards(plans, payload, 'all', 1);
    expect(boards[1].completedCount).toBe(1);
    expect(boards[1].totalCount).toBeGreaterThan(1);
    expect(boards[1].allDone).toBe(false);
    expect(isWeekUnlocked(2, boards, payload)).toBe(false);
  });

  it('Lessons list keeps the blocking prior week visible while current lesson week is todo-locked', () => {
    const src = loadLessonsScreen();
    expect(src).toContain('todoGateBlocksCurrentLessonWeek');
    expect(src).toContain('!isWeekUnlocked(lessonPath.currentWeek.week, todoBoards, todoPayload)');
    expect(src).toContain('const displayLessonPathWeek = todoGateBlocksCurrentLessonWeek');
    expect(src).toContain('displayLessonPathWeek.lessons.map');
    expect(src).toContain('if (todoGateBlocksCurrentLessonWeek) return;');
    expect(src).toContain('disabled={todoGateBlocksCurrentLessonWeek}');
    expect(src).toContain("Finish Week {weekProgress.index}'s todos to unlock Week {nextWeekNumber}");
  });

  it('completion handler gates cross-week auto-advance through isWeekUnlocked', () => {
      // Phase 43: handleMarkComplete body moved to src/screens/lessons/useMarkComplete.ts.
      const hookSrc = readFileSync(join(ROOT, 'src', 'screens', 'lessons', 'useMarkComplete.ts'), 'utf8');
      const handler = hookSrc.match(
        /markComplete\s*=\s*useCallback\([\s\S]*?\}\s*,\s*\[selectedLesson\s*,\s*store[\s\S]*?\]\)/,
      );
      expect(handler, 'markComplete useCallback body not found').not.toBeNull();
      const body = handler![0];

      expect(body).toContain('const nextTodoPayload: TodoPayload');
      expect(body).toContain('const nextTodoBoards = buildAllTodoBoards');
      expect(body).toContain('const nextLessonUnlockedByTodos');
      expect(body).toContain('next.week === lesson.week');
      expect(body).toContain('isWeekUnlocked(next.week, nextTodoBoards, nextTodoPayload)');
      expect(body).toMatch(/if\s*\(\s*nextLessonUnlockedByTodos\s*\)\s*\{[\s\S]*?setSelected\(next\.id\)/);
      expect(body).toMatch(/else\s*\{[\s\S]*?setSelected\(undefined\)/);
      // Regression guard: the inline useCallback must NOT be re-added to LessonsScreen.tsx
      const screenSrc = readFileSync(LESSONS_SCREEN, 'utf8');
      expect(screenSrc).not.toMatch(/handleMarkComplete\s*=\s*React\.useCallback\(/);
    });

  it('next-week preview detail is read-only until prior-week todos unlock it', () => {
    const src = loadLessonsScreen();
    expect(src).toContain('const selectedLessonLockedByTodos');
    expect(src).toContain('isWeekUnlocked(lesson.week, todoBoards, todoPayload)');
    expect(src).toContain('Finish this week’s todos first');

    const buttonBlock = src.match(
      /<Button\b[\s\S]*?testID="lesson-mark-complete-button"[\s\S]*?\/>/,
    );
    expect(buttonBlock, 'mark-complete Button block missing').not.toBeNull();
    expect(buttonBlock![0]).toContain('!selectedLessonLockedByTodos');

    const nextButtonBlock = src.match(/label=\{`Next: \$\{nextLesson\.title\}`\}[\s\S]*?\/>/);
    expect(nextButtonBlock, 'next-lesson Button block missing').not.toBeNull();
    expect(src).toContain('selectedLessonCompleted && nextLesson && nextLessonUnlockedByTodos');
  });
});
