import type { SenseiLesson } from '../types/lesson';
import type { LearnerProgress } from '../types/progress';
import type { PlacementLevel } from './placementTestService';
import { lessonsForPlacementLevel } from './placementPathService';

export type LessonPathState = 'completed' | 'current' | 'locked';

export interface LessonPathItem {
  lesson: SenseiLesson;
  state: LessonPathState;
  primaryActionLabel: string;
  helperText: string;
  completed: boolean;
  lockedByLessonId?: string;
}

export interface LessonPathWeek {
  week: number;
  label: string;
  theme: string;
  totalCount: number;
  completedCount: number;
  lessons: LessonPathItem[];
}

export interface LessonInteractionPath {
  currentLesson?: SenseiLesson;
  currentWeek: LessonPathWeek;
  weeks: LessonPathWeek[];
  courseComplete: boolean;
  previousWeekComplete: boolean;
}

function lessonSort(a: SenseiLesson, b: SenseiLesson): number {
  // Foundation and N5 both use learner-facing Week 1 labels. Keep every
  // foundation lesson ahead of N5 before applying the normal week/day order,
  // otherwise an absolute-beginner path interleaves the two curricula.
  const aFoundation = a.level === 'Absolute Beginner' ? 0 : 1;
  const bFoundation = b.level === 'Absolute Beginner' ? 0 : 1;
  return aFoundation - bFoundation || a.week - b.week || a.day - b.day || a.id.localeCompare(b.id);
}

function weekLabel(lesson: SenseiLesson): string {
  return `Week ${lesson.week}`;
}

export function buildLessonInteractionPath(
  lessons: SenseiLesson[],
  progress: LearnerProgress,
  placementLevel?: PlacementLevel | null,
): LessonInteractionPath {
  const ordered = [...lessonsForPlacementLevel(lessons, placementLevel)].sort(lessonSort);
  const validIds = new Set(ordered.map(lesson => lesson.id));
  const completedIds = new Set(progress.completedLessonIds.filter(id => validIds.has(id)));
  const firstUncompleted = ordered.find(lesson => !completedIds.has(lesson.id));
  const courseComplete = ordered.length > 0 && !firstUncompleted;
  const currentLesson = firstUncompleted ?? ordered[ordered.length - 1];
  const currentWeekNumber = currentLesson?.week ?? ordered[0]?.week ?? 1;
  const previousWeekLessons = ordered.filter(lesson => lesson.week === currentWeekNumber - 1);
  const previousWeekComplete = previousWeekLessons.length > 0 && previousWeekLessons.every(lesson => completedIds.has(lesson.id));

  const weekNumbers = Array.from(new Set(ordered.map(lesson => lesson.week)));
  const weeks = weekNumbers.map(week => {
    const weekLessons = ordered.filter(lesson => lesson.week === week);
    const completedCount = weekLessons.filter(lesson => completedIds.has(lesson.id)).length;
    const lessonsForWeek = weekLessons.map(lesson => {
      const lessonIndex = ordered.findIndex(candidate => candidate.id === lesson.id);
      const completed = completedIds.has(lesson.id);
      const isCurrent = !courseComplete && lesson.id === currentLesson?.id;
      const priorLesson = lessonIndex > 0 ? ordered[lessonIndex - 1] : undefined;
      const state: LessonPathState = completed ? 'completed' : isCurrent ? 'current' : 'locked';
      return {
        lesson,
        state,
        completed,
        lockedByLessonId: state === 'locked' ? (currentLesson?.id ?? priorLesson?.id) : undefined,
        primaryActionLabel: state === 'completed'
          ? 'Review again'
          : state === 'current'
            ? (completedIds.size === 0 ? 'Start lesson' : 'Resume lesson')
            : `Unlocks after ${currentLesson?.title ?? priorLesson?.title ?? 'the previous lesson'}`,
        helperText: state === 'completed'
          ? 'Completed — available for review any time.'
          : state === 'current'
            ? 'Current lesson — study this next.'
            : `Locked until you finish ${currentLesson?.title ?? priorLesson?.title ?? 'the previous lesson'}.`,
      } satisfies LessonPathItem;
    });
    return {
      week,
      label: weekLabel(weekLessons[0]),
      theme: weekLessons[0]?.category ?? 'lessons',
      totalCount: weekLessons.length,
      completedCount,
      lessons: lessonsForWeek,
    };
  });

  return {
    currentLesson,
    currentWeek: weeks.find(week => week.week === currentWeekNumber) ?? weeks[0] ?? {
      week: 1,
      label: 'Week 1',
      theme: 'lessons',
      totalCount: 0,
      completedCount: 0,
      lessons: [],
    },
    weeks,
    courseComplete,
    previousWeekComplete,
  };
}
