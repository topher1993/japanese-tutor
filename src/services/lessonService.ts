import { dailySenseiLesson, mockSenseiLessons, workplaceSurvivalTopics } from '../data/mockSenseiLessons';
import type { LessonCategory, LessonItem, SenseiLesson, SupportLanguage, WorkplaceSurvivalTopic } from '../types/lesson';
import type { LearnerProgress } from '../types/progress';

export interface WeeklyLessonSummary { week: number; objectives: string[]; lessons: SenseiLesson[]; reviewContent: string[]; }

/**
 * Phase 30 — Daily lesson view object.
 *
 * Wraps a `SenseiLesson` with the surrounding weekly context the screens
 * need to show progress ("3 of 5 done this week") and the next-week
 * preview ("Week 1 is finished! Tap to start Week 2.").
 */
export interface DailyLessonView {
  /** The lesson the learner should study next. */
  lesson: SenseiLesson;
  /** Human-friendly label like "Week 1 — Day 2". */
  weekLabel: string;
  /** How many lessons in the lesson's week are already in `completedLessonIds`. */
  lessonsDoneThisWeek: number;
  /** Total lessons in the lesson's week. */
  lessonsTotalThisWeek: number;
  /** True when the previous week is fully complete and we are previewing the next one. */
  isWeekPreview: boolean;
  /** True when every lesson in `mockSenseiLessons` is complete (course finished). */
  isCourseComplete: boolean;
}

/**
 * Pick the next uncompleted lesson for the learner, with weekly context.
 *
 * Phase 30 (was: always returned `mockSenseiLessons[0]`). Now:
 *   1. If progress exists and the learner has completed some lessons, the
 *      daily lesson is the first one in `mockSenseiLessons` whose id is NOT
 *      in `progress.completedLessonIds`.
 *   2. If the learner has finished every lesson in the PREVIOUS week, we
 *      hand back a lesson from the NEXT week and flag `isWeekPreview: true`
 *      so the screen can render "Week 1 done — tap to start Week 2".
 *   3. If everything is finished, we return the last lesson and flag
 *      `isCourseComplete: true`.
 *   4. With no progress yet, we still start at `mockSenseiLessons[0]` so
 *      a brand-new install shows Week 1 Day 1.
 *
 * Lessons are returned in the canonical `mockSenseiLessons` order (week
 * ascending, then day ascending) so "next" always means "the one right
 * after what you just finished".
 */
export function getDailyLesson(progress?: LearnerProgress | null): DailyLessonView {
  const completed = new Set(progress?.completedLessonIds ?? []);

  // Find the first lesson that is NOT yet completed.
  const nextUncompleted = mockSenseiLessons.find((lesson) => !completed.has(lesson.id));

  if (!nextUncompleted) {
    // Everything is done — keep returning the last lesson but flag course complete.
    const lastLesson = mockSenseiLessons[mockSenseiLessons.length - 1];
    const lastWeekNumber = lastLesson.week;
    const lastWeekLessons = mockSenseiLessons.filter((l) => l.week === lastWeekNumber);
    return {
      lesson: lastLesson,
      weekLabel: `Week ${lastLesson.week} — Day ${lastLesson.day}`,
      lessonsDoneThisWeek: lastWeekLessons.length,
      lessonsTotalThisWeek: lastWeekLessons.length,
      isWeekPreview: false,
      isCourseComplete: true,
    };
  }

  const weekNumber = nextUncompleted.week;
  const lessonsThisWeek = mockSenseiLessons.filter((l) => l.week === weekNumber);
  const lessonsDoneThisWeek = lessonsThisWeek.filter((l) => completed.has(l.id)).length;

  // isWeekPreview: the learner has just finished every lesson in the
  // PREVIOUS week and is seeing the first lesson of a NEW week as a
  // preview. Trigger conditions:
  //   - the lesson is at the start of its week (day === 1), and
  //   - every lesson in the previous week is complete.
  // Without the previous-week check, a learner mid-week (e.g. day 3 of 5)
  // would see isWeekPreview=true even though they have not finished the
  // week yet.
  const isFirstOfWeek = nextUncompleted.day === 1;
  const previousWeekFullyDone = weekNumber === 1
    ? false
    : mockSenseiLessons
        .filter((l) => l.week === weekNumber - 1)
        .every((l) => completed.has(l.id));
  const isWeekPreview = isFirstOfWeek && previousWeekFullyDone;

  return {
    lesson: nextUncompleted,
    weekLabel: `Week ${weekNumber} — Day ${nextUncompleted.day}`,
    lessonsDoneThisWeek,
    lessonsTotalThisWeek: lessonsThisWeek.length,
    isWeekPreview,
    isCourseComplete: false,
  };
}

export function getAllLessons(): SenseiLesson[] { return mockSenseiLessons; }
export function getLessonsByCategory(category: LessonCategory): SenseiLesson[] { return mockSenseiLessons.filter(lesson => lesson.category === category); }
export function getWeeklyLessonSummary(week: number): WeeklyLessonSummary {
  const lessons = mockSenseiLessons.filter(lesson => lesson.week === week);
  return { week, objectives: ['workplace greetings', 'safety commands', 'asking for help', 'schedule/time language', 'emergency phrases'], lessons, reviewContent: lessons.flatMap(lesson => lesson.items.slice(0, 2).map(item => item.japanese)) };
}
export function getWorkplaceSurvivalTopics(): WorkplaceSurvivalTopic[] { return workplaceSurvivalTopics; }
export function getLocalizedLessonItem(item: LessonItem, language: SupportLanguage): LessonItem & { supportText: string } {
  const supportText = language === 'vi' ? item.vietnamese : language === 'tl' ? item.filipino : item.english;
  return { ...item, supportText };
}

// Re-export for any direct importers of `dailySenseiLesson` that still exist.
export { dailySenseiLesson };