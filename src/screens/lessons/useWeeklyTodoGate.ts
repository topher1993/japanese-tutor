// Phase 43 — useWeeklyTodoGate hook extracted from LessonsScreen.tsx
//
// Owns the Phase 37c/37g weekly-todo gate logic that was previously
// inlined as `let` reassignments in the LessonsScreen function body:
//   - todoPayload (derived from store + progress)
//   - todoBoards (derived from todoPayload + weekProgress.index)
//   - todoBoard / nextWeekNumber / nextWeekUnlocked
//   - displayLessonPathWeek (effective week for the path list)
//   - todoGateBlocksCurrentLessonWeek (whether the gate is active)
//
// If the gate is active and the user is on a week whose todos are
// incomplete, the hook re-derives `progression`, `currentWeek`, and
// `weekProgress` to point at the PRIOR week (the blocking week) —
// the UI then shows the prior week's lessons + a "Finish Week N's
// todos to unlock Week N+1" CTA. This is the preview-but-locked
// strategy from §11.1 of the phase 37c proposal.
//
// Inputs (all reactive — hook re-runs when any input changes):
//   - store: SQLite learning repository (may be null while loading)
//   - lessonPath: output of buildLessonInteractionPath()
//   - weekProgress: derived from lessonPath + progression
//   - currentWeek: derived from progression.currentWeekDetails()
//   - progression: derived from buildLessonProgression(week)
//   - progress: persisted learner progress (or null while loading)
//
// Returns: the same set of values the caller previously got from the
// inline let-blocks, plus the re-derived progression/currentWeek/weekProgress
// when the gate is active.

import { useMemo } from 'react';

import { isTodoFeatureEnabled } from '../../services/practiceProgressStore';
import { getAllWeekPlans } from '../../services/weeklyPlansService';
import {
  buildAllTodoBoards,
  isWeekUnlocked,
  type TodoPayload,
} from '../../services/weeklyTodoService';
import { buildLessonProgression } from '../../services/lessonProgressionService';
import { emptyTodoEventCounts } from '../../types/weeklyTodo';
import type { LearnerProgress } from '../../types/progress';
import type {
  LessonInteractionPath,
} from '../../services/lessonInteractionPathService';

// Type shapes mirror what LessonsScreen uses inline. We don't import the
// concrete return types of buildLessonProgression / buildLessonInteractionPath
// here because those services expose helpers like currentWeekDetails() that
// the caller needs to keep accessible.
export interface WeekProgressView {
  index: number;
  total: number;
  minutes: number;
}

export interface UseWeeklyTodoGateParams {
  store: { getExtendedProgress(): unknown } | null;
  lessonPath: LessonInteractionPath;
  weekProgress: WeekProgressView;
  // The caller passes the current progression + currentWeek so the hook can
  // re-derive them if the gate is active.
  progression: { currentWeekDetails(): unknown; weeks: { length: number } };
  currentWeek: unknown;
  progress: LearnerProgress | null;
}

export interface UseWeeklyTodoGateResult {
  todoPayload: TodoPayload;
  todoBoards: Record<number, unknown>;
  todoBoard: unknown;
  nextWeekNumber: number;
  nextWeekUnlocked: boolean;
  displayLessonPathWeek: unknown; // LessonPathWeek from caller — kept loose to avoid pulling types
  todoGateBlocksCurrentLessonWeek: boolean;
  // Re-derived values when the gate is active:
  progression: UseWeeklyTodoGateParams['progression'];
  currentWeek: unknown;
  weekProgress: WeekProgressView;
}

export function useWeeklyTodoGate({
  store,
  lessonPath,
  weekProgress,
  progression,
  currentWeek,
  progress,
}: UseWeeklyTodoGateParams): UseWeeklyTodoGateResult {
  // todoPayload: derived from store + progress.
  const todoPayload = useMemo<TodoPayload>(() => {
    const extended = (store?.getExtendedProgress() as
      | {
          todoStates: Record<string, unknown>;
          weekTodosInitialized: Record<number, boolean>;
          todoEventCounts: unknown;
        }
      | undefined) ?? {
      todoStates: {},
      weekTodosInitialized: {},
      todoEventCounts: emptyTodoEventCounts(),
    };
    return {
      todoStates: extended.todoStates as TodoPayload['todoStates'],
      weekTodosInitialized: extended.weekTodosInitialized,
      todoEventCounts: extended.todoEventCounts as TodoPayload['todoEventCounts'],
      completedLessonIds: progress?.completedLessonIds ?? [],
    };
  }, [progress?.completedLessonIds, store]);

  // todoBoards: derived from todoPayload + weekProgress.index.
  const todoBoards = useMemo(
    () => buildAllTodoBoards(getAllWeekPlans(), todoPayload, 'all', weekProgress.index),
    [todoPayload, weekProgress.index],
  );

  const todoBoard = todoBoards[weekProgress.index];
  const nextWeekNumber = weekProgress.index + 1;
  const nextWeekUnlocked = isWeekUnlocked(nextWeekNumber, todoBoards, todoPayload);

  const todoGateBlocksCurrentLessonWeek = isTodoFeatureEnabled()
    && lessonPath.currentWeek.week > 1
    && !isWeekUnlocked(lessonPath.currentWeek.week, todoBoards, todoPayload);

  const displayLessonPathWeek = todoGateBlocksCurrentLessonWeek
    ? (lessonPath.weeks.find(week => week.week === lessonPath.currentWeek.week - 1) ?? lessonPath.currentWeek)
    : lessonPath.currentWeek;

  // If the gate is active, re-derive progression/currentWeek/weekProgress/todoBoard
  // to point at the prior (blocking) week. The UI then shows the prior week's
  // lessons instead of the locked-current week.
  if (todoGateBlocksCurrentLessonWeek) {
    const blockingWeek = lessonPath.currentWeek.week - 1;
    const reProgression = buildLessonProgression(blockingWeek);
    const reCurrentWeek = reProgression.currentWeekDetails();
    const reWeekProgress: WeekProgressView = {
      index: blockingWeek,
      total: reProgression.weeks.length,
      minutes: (reCurrentWeek as { recommendedMinutes?: number }).recommendedMinutes ?? 0,
    };
    const reTodoBoard = todoBoards[blockingWeek];
    const reNextWeekNumber = lessonPath.currentWeek.week;

    return {
      todoPayload,
      todoBoards,
      todoBoard: reTodoBoard,
      nextWeekNumber: reNextWeekNumber,
      nextWeekUnlocked: false,
      displayLessonPathWeek,
      todoGateBlocksCurrentLessonWeek,
      progression: reProgression,
      currentWeek: reCurrentWeek,
      weekProgress: reWeekProgress,
    };
  }

  return {
    todoPayload,
    todoBoards,
    todoBoard,
    nextWeekNumber,
    nextWeekUnlocked,
    displayLessonPathWeek,
    todoGateBlocksCurrentLessonWeek,
    progression,
    currentWeek,
    weekProgress,
  };
}