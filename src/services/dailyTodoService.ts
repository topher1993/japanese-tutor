import type { DailyTodoActivity } from '../types/weeklyTodo';
import { localDateKey, localDayNumber } from '../utils/localDate';
export { localDateKey } from '../utils/localDate';

export type DailyTodoKind = 'lesson' | 'daily-rush' | 'flashcards' | 'quiz';

export interface DailyTodo {
  id: string;
  kind: DailyTodoKind;
  title: string;
  target: number;
  unit: string;
}

export interface DailyTodoStatus {
  todo: DailyTodo;
  progress: number;
  target: number;
  completed: boolean;
  helperText: string;
}

export interface DailyTodoBoard {
  date: string;
  todos: DailyTodoStatus[];
  completedCount: number;
  totalCount: number;
  allDone: boolean;
}

/** Keep the daily plan small enough to finish in one focused session. */
export const DAILY_TODO_DEFINITIONS: DailyTodo[] = [
  { id: 'daily-lesson', kind: 'lesson', title: "Complete today's lesson", target: 1, unit: 'lesson' },
  { id: 'daily-rush', kind: 'daily-rush', title: 'Complete one Daily Flashcard Rush', target: 1, unit: 'rush' },
  { id: 'daily-flashcards', kind: 'flashcards', title: 'Review 5 flashcards', target: 5, unit: 'cards' },
];

/** A finished course should offer repeatable practice, not an impossible lesson task. */
export const COURSE_COMPLETE_DAILY_TODO_DEFINITIONS: DailyTodo[] = [
  { id: 'daily-quiz', kind: 'quiz', title: 'Complete one practice quiz', target: 1, unit: 'quiz' },
  DAILY_TODO_DEFINITIONS[1],
  DAILY_TODO_DEFINITIONS[2],
];

/** Number of daily cycles represented by one weekly Todo requirement. */
export const DAILY_TODO_DAYS_PER_WEEK = 7;

export function dailyTodoTarget(kind: DailyTodoKind): number {
  if (kind === 'quiz') return 1;
  return DAILY_TODO_DEFINITIONS.find(todo => todo.kind === kind)?.target ?? 0;
}

/**
 * Keep weekly requirements coupled to the daily plan. If content is smaller
 * than the scaled goal (for example, only five lessons exist in a week), the
 * available content becomes the safe upper bound instead of an impossible
 * requirement.
 */
export function scaleDailyTodoTarget(
  kind: DailyTodoKind,
  availableTarget?: number,
): number {
  const dailyTarget = dailyTodoTarget(kind);
  const scaledTarget = dailyTarget * DAILY_TODO_DAYS_PER_WEEK;
  return availableTarget == null ? scaledTarget : Math.min(scaledTarget, Math.max(0, availableTarget));
}

function statusForTodo(
  todo: DailyTodo,
  activity: DailyTodoActivity,
): DailyTodoStatus {
  let progress = 0;
  if (todo.kind === 'lesson') {
    progress = (activity.lessonIds?.length ?? 0) > 0 ? 1 : 0;
  } else if (todo.kind === 'daily-rush') {
    progress = activity.dailyRushCompleted ? 1 : 0;
  } else if (todo.kind === 'flashcards') {
    progress = Math.min(activity.flashcardReviewIds?.length ?? 0, todo.target);
  } else {
    progress = activity.quizCompleted ? 1 : 0;
  }
  const completed = progress >= todo.target;
  return {
    todo,
    progress,
    target: todo.target,
    completed,
    helperText: completed ? `Done — ${progress} / ${todo.target} ${todo.unit}` : `${progress} / ${todo.target} ${todo.unit}`,
  };
}

export interface StudyStreak {
  currentStreak: number;
  longestStreak: number;
}

function hasStudyActivity(activity: DailyTodoActivity | undefined): boolean {
  return Boolean(
    activity?.dailyRushCompleted
    || activity?.quizCompleted
    || activity?.lessonIds?.length
    || activity?.flashcardReviewIds?.length
    || activity?.sentenceLabReviewIds?.length,
  );
}

/** Count any intentional study activity, using the learner's local calendar. */
export function calculateStudyStreak(
  activities: Record<string, DailyTodoActivity> | undefined,
  today: Date = new Date(),
): StudyStreak {
  const activeDays = Array.from(new Set(
    Object.entries(activities ?? {})
      .filter(([, activity]) => hasStudyActivity(activity))
      .map(([dateKey]) => localDayNumber(dateKey))
      .filter((day): day is number => day != null),
  )).sort((a, b) => a - b);
  if (activeDays.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let longestStreak = 1;
  let run = 1;
  for (let index = 1; index < activeDays.length; index += 1) {
    run = activeDays[index] === activeDays[index - 1] + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  const todayDay = localDayNumber(localDateKey(today));
  const latestDay = activeDays[activeDays.length - 1];
  if (todayDay == null || latestDay < todayDay - 1 || latestDay > todayDay) {
    return { currentStreak: 0, longestStreak };
  }
  let currentStreak = 1;
  for (let index = activeDays.length - 1; index > 0; index -= 1) {
    if (activeDays[index - 1] !== activeDays[index] - 1) break;
    currentStreak += 1;
  }
  return { currentStreak, longestStreak };
}

export function buildDailyTodoBoard(
  date: string,
  activity: DailyTodoActivity | undefined,
  definitions: DailyTodo[] = DAILY_TODO_DEFINITIONS,
): DailyTodoBoard {
  const statuses = definitions.map(todo => statusForTodo(todo, activity ?? {}));
  const completedCount = statuses.filter(status => status.completed).length;
  return {
    date,
    todos: statuses,
    completedCount,
    totalCount: statuses.length,
    allDone: completedCount === statuses.length,
  };
}
