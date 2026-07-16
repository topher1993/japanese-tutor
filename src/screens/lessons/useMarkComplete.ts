// Phase 43 — useMarkComplete hook extracted from LessonsScreen.tsx
//
// Owns the mark-complete logic that was previously inlined as
// `handleMarkComplete` inside LessonsScreen. The hook:
//   - Tracks in-flight state internally (markInFlight)
//   - Surfaces errors via notifyLessonError (Phase 39 contract)
//   - Fires success toast via notifyLessonCompleted (Phase 30b)
//   - Computes the next-lesson navigation
//   - Honors the todo-gate: if next.week is locked, returns to list
//     (Phase 39 preview-but-locked strategy)
//
// Why a hook and not a plain function:
//   - We need useState for markInFlight
//   - We need useCallback to memoize the returned handler
//   - Pure functions can't own React state
//
// Inputs:
//   - selectedLesson: the lesson currently being viewed (undefined if
//     nothing selected — handler becomes a defensive no-op)
//   - store: the SQLite learning repository (null while loading — handler
//     surfaces 'store-unavailable' error per Phase 39 contract A)
//   - lessons: the full lesson list (needed for next-lesson nav)
//   - setProgress: parent's setter for refreshing progress after completion
//   - setSelected: parent's setter for navigating to next lesson or list
//
// Returns:
//   - markComplete: async handler to attach to the Mark Complete button
//   - markInFlight: boolean to disable the button while request is in flight

import { useCallback, useState } from 'react';

import { createLessonNavigator } from '../../services/lessonNavigatorService';
import { notifyLessonCompleted, notifyLessonError } from '../../components/CompletionToast';
import {
  buildAllTodoBoards,
  isWeekUnlocked,
  type TodoPayload,
} from '../../services/weeklyTodoService';
import { isTodoFeatureEnabled } from '../../services/practiceProgressStore';
import { getAllWeekPlans } from '../../services/weeklyPlansService';
import type { SenseiLesson } from '../../types/lesson';
import type { LearnerProgress } from '../../types/progress';
import type { TodoTrack } from '../../types/weeklyTodo';
// Phase 44.2: analytics — fires attempt / success / failure events so
// we can measure the mark-complete funnel. The track() call is a no-op
// in test mode, so production instrumentation can land without
// breaking existing tests.
import { track } from '../../services/analyticsService';
import { localDateKey } from '../../services/dailyTodoService';

type SqliteLearningRepositoryLike = {
  completeCurrentLesson(lessonId: string, score: number, completedAt: string): Promise<void>;
  getProgress(): Promise<LearnerProgress>;
  getExtendedProgress(): {
    todoStates: Record<string, unknown>;
    weekTodosInitialized: Record<number, boolean>;
    todoEventCounts: unknown;
  };
};

export interface UseMarkCompleteParams {
  selectedLesson: SenseiLesson | null | undefined;
  store: SqliteLearningRepositoryLike | null;
  lessons: SenseiLesson[];
  setProgress: (progress: LearnerProgress) => void;
  setSelected: (id: string | undefined) => void;
  todoTrack?: TodoTrack;
}

export interface UseMarkCompleteResult {
  markComplete: () => Promise<void>;
  markInFlight: boolean;
}

export function useMarkComplete({
  selectedLesson,
  store,
  lessons,
  setProgress,
  setSelected,
  todoTrack = 'all',
}: UseMarkCompleteParams): UseMarkCompleteResult {
  const [markInFlight, setMarkInFlight] = useState(false);

  // Phase 39 (Igris mark-complete fix) — explicit, named handler so the
  // failure surfaces reach the user instead of being eaten by a silent
  // catch. Defends against BOTH root-cause candidates:
  //
  //   (A) ready===true but store===null on first paint → handler bails
  //       early and calls notifyLessonError('store-unavailable'). The
  //       button stays tappable so this path actually reaches the
  //       user-facing error toast instead of looking like a dead CTA.
  //
  //   (B) completeCurrentLesson throws (e.g. inside the
  //       saveExtendedProgress cast on cold-start repo shapes) →
  //       catch block now re-raises by emitting a structured error
  //       toast rather than swallowing.
  const markComplete = useCallback(async () => {
    const lesson = selectedLesson;
    if (!lesson) return;
    if (!store) {
      // Defensive: the Button is disabled when !store, but keep this
      // branch so a synchronous tap during a hot reload still surfaces.
      notifyLessonError({ kind: 'store-unavailable', lessonId: lesson.id });
      // Phase 44.2: record this as a failure (the store being missing
      // is a real failure mode the user can hit, even though the
      // button is disabled in normal flow).
      track('lesson_mark_complete_failure', {
        lessonId: lesson.id,
        reason: 'store-unavailable',
      });
      return;
    }
    // Phase 44.2: record the attempt so we can measure the funnel
    // (attempts vs successes vs failures). track() is a no-op in test
    // mode and in dev without an analytics key, so this is zero-cost
    // until a backend is wired.
    track('lesson_mark_complete_attempt', { lessonId: lesson.id });
    setMarkInFlight(true);
    try {
      await store.completeCurrentLesson(
        lesson.id,
        100,
        localDateKey(),
      );
      // Phase 30b: always re-read progress and fire the completion toast,
      // even when there is no next lesson. The previous shape
      // `if (next) setSelected(next.id)` silently did nothing on the
      // last lesson, leaving the user staring at the same screen with
      // no signal that anything happened.
      const refreshed = await store.getProgress();
      setProgress(refreshed);
      // Phase 44.2: success event. Include the lesson id + week so we
      // can break down completion rate by week in the dashboard later.
      const lessonWeek = (lesson as { week?: number }).week;
      track('lesson_mark_complete_success', {
        lessonId: lesson.id,
        week: lessonWeek,
      });
      const visibleLessonIds = new Set(lessons.map(item => item.id));
      const completedInTrack = new Set(
        refreshed.completedLessonIds.filter(id => visibleLessonIds.has(id)),
      ).size;
      notifyLessonCompleted({
        message: `✓ ${lesson.title}`,
        detail: `${completedInTrack} of ${lessons.length} lessons done in this track.`,
      });
      // Use a fresh navigator closure over the freshly-set `selected`
      // to avoid capturing a stale snapshot.
      const freshNav = createLessonNavigator(lessons, lesson.id);
      const next = freshNav.nextLesson();
      if (next) {
        const nextExtended = store.getExtendedProgress();
        const nextTodoPayload: TodoPayload = {
          todoStates: nextExtended.todoStates as TodoPayload['todoStates'],
          weekTodosInitialized: nextExtended.weekTodosInitialized,
          todoEventCounts: nextExtended.todoEventCounts as TodoPayload['todoEventCounts'],
          completedLessonIds: refreshed.completedLessonIds,
        };
        const nextTodoBoards = buildAllTodoBoards(getAllWeekPlans(todoTrack), nextTodoPayload, 'all', next.week, todoTrack);
        const nextLessonUnlockedByTodos = todoTrack === 'grammar'
          || !isTodoFeatureEnabled()
          || next.week === lesson.week
          || isWeekUnlocked(next.week, nextTodoBoards, nextTodoPayload);
        if (nextLessonUnlockedByTodos) {
          setSelected(next.id);
        } else {
          // Preview-but-locked strategy: finishing the last lesson in a week
          // must NOT auto-jump into the next week's completion flow while
          // prior-week todos are still unfinished. Return to the list so the
          // learner sees the blocking WeeklyTodoBoard instead.
          setSelected(undefined);
        }
      } else {
        // Course complete — bounce back to the lessons list so the
        // user sees the celebration state instead of being stuck on
        // this detail view.
        setSelected(undefined);
      }
    } catch (err) {
      // Phase 39: never swallow. Emit a structured error so
      // LessonErrorToast (and any other subscriber) can show the
      // user what went wrong. The toast fires for both code paths
      // (cold-start race + repo.cast throw) without further work.
      // Phase 44.2: also fire an analytics event so we can measure
      // failure rate over time.
      notifyLessonError({
        kind: 'completion-failed',
        lessonId: lesson.id,
        error: err instanceof Error ? err.message : String(err),
      });
      track('lesson_mark_complete_failure', {
        lessonId: lesson.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setMarkInFlight(false);
    }
    // Phase 39: deps tracked for selectedLesson + store so the handler
    // sees fresh values; other closures (`lessons`, `setProgress`,
    // `setSelected`) are stable or derived inside the closure body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLesson, store, lessons, setProgress, setSelected, todoTrack]);

  return { markComplete, markInFlight };
}
