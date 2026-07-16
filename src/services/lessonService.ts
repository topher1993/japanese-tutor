import { dailySenseiLesson, mockSenseiLessons, workplaceSurvivalTopics } from '../data/mockSenseiLessons';
import { grammarLessons } from '../data/grammarLessons';
import { absoluteBeginnerLessons } from '../data/absoluteBeginnerLessons';
import type { LessonCategory, LessonItem, SenseiLesson, SupportLanguage, WorkplaceSurvivalTopic } from '../types/lesson';
import type { LearnerProgress } from '../types/progress';
import type { PlacementLevel } from './placementTestService';
import { lessonsForPlacementLevel } from './placementPathService';

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
  /** Human-friendly label like "Week 1 — Day 2" or "Course complete". */
  weekLabel: string;
  /** How many lessons in the lesson's week are already in `completedLessonIds`. */
  lessonsDoneThisWeek: number;
  /** Total lessons in the lesson's week. */
  lessonsTotalThisWeek: number;
  /** True when the previous week is fully complete and we are previewing the next one. */
  isWeekPreview: boolean;
  /** True when every lesson in the learner's forward phrase curriculum is complete. */
  isCourseComplete: boolean;
}

/**
 * Pick the next uncompleted lesson for the learner, with weekly context.
 *
 * Phase 30 (was: always returned `mockSenseiLessons[0]`). Now:
 *   1. If progress exists and the learner has completed some lessons, the
 *      daily lesson is the first phrase in their placement-aware forward
 *      curriculum whose id is NOT in `progress.completedLessonIds`.
 *   2. If the learner has finished every lesson in the PREVIOUS week, we
 *      hand back a lesson from the NEXT week and flag `isWeekPreview: true`
 *      so the screen can render "Week 1 done — tap to start Week 2".
 *   3. If everything is finished, we return the last lesson, flag
 *      `isCourseComplete: true`, and report the FULL course totals (not
 *      just the last week's count) so the UI can say "18 of 18 done".
 *   4. With no progress yet, an unplaced learner starts at N5; a placement
 *      result changes the starting level without truncating higher levels.
 *
 * Lessons retain canonical phrase-catalog order so "next" always means the
 * next item in the learner's forward curriculum.
 */
export function getDailyLesson(
  progress?: LearnerProgress | null,
  placementLevel?: PlacementLevel | null,
): DailyLessonView {
  // Daily progression follows the learner-visible Phrases track. Grammar has
  // its own track and progress card; mixing legacy grammar rows here could
  // recommend a lesson that the Phrases screen cannot open.
  const phraseCatalog = placementLevel
    ? getPhraseLessons()
    : getPhraseLessons().filter(lesson => lesson.level !== 'Absolute Beginner');
  const courseLessons = lessonsForPlacementLevel(phraseCatalog, placementLevel);
  const completed = new Set(progress?.completedLessonIds ?? []);

  // Find the first lesson that is NOT yet completed.
  const nextUncompleted = courseLessons.find((lesson) => !completed.has(lesson.id));

  if (!nextUncompleted) {
    // Everything is done — keep returning the last lesson but flag
    // course complete. The weekLabel / lessonsDoneThisWeek reflect the
    // FULL course totals (not just the last week), so the UI can show
    // "🎉 Course complete — 18 of 18 lessons done" instead of the
    // misleading "0 of 8 done this week" that an empty last-week
    // counter would produce.
    const lastLesson = courseLessons[courseLessons.length - 1] ?? mockSenseiLessons[0];
    const totalCompleted = courseLessons.filter((l) => completed.has(l.id)).length;
    return {
      lesson: lastLesson,
      weekLabel: 'Course complete',
      lessonsDoneThisWeek: totalCompleted,
      lessonsTotalThisWeek: courseLessons.length,
      isWeekPreview: false,
      isCourseComplete: true,
    };
  }

  const weekNumber = nextUncompleted.week;
  const lessonsThisWeek = courseLessons.filter((l) => l.week === weekNumber);
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
  const previousWeekLessons = courseLessons.filter((l) => l.week === weekNumber - 1);
  const previousWeekFullyDone = weekNumber !== 1
    && previousWeekLessons.length > 0
    && previousWeekLessons.every((l) => completed.has(l.id));
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

/** @deprecated Legacy fixture catalog. App flows should choose a typed track below. */
export function getAllLessons(): SenseiLesson[] { return mockSenseiLessons; }
/** Existing phrase lessons, excluding the legacy grammar examples. */
export function getPhraseLessons(): SenseiLesson[] {
  return [...absoluteBeginnerLessons, ...mockSenseiLessons.filter(lesson => lesson.category !== 'grammar')];
}
/** Every learner-visible grammar lesson, including the legacy N4/N3 rows. */
export function getGrammarLessons(): SenseiLesson[] {
  return [
    ...grammarLessons,
    ...mockSenseiLessons.filter(lesson => lesson.category === 'grammar'),
  ];
}
/** Full learner-visible catalog used by persistence and practice surfaces. */
export function getAllCourseLessons(): SenseiLesson[] {
  const byId = new Map<string, SenseiLesson>();
  for (const lesson of [...getPhraseLessons(), ...getGrammarLessons()]) byId.set(lesson.id, lesson);
  return Array.from(byId.values());
}
export function getLessonsByCategory(category: LessonCategory): SenseiLesson[] {
  return [...absoluteBeginnerLessons, ...mockSenseiLessons].filter(lesson => lesson.category === category);
}
export function getWeeklyLessonSummary(week: number): WeeklyLessonSummary {
  const lessons = mockSenseiLessons.filter(lesson => lesson.week === week);
  return {
    week,
    objectives: ['workplace greetings', 'safety commands', 'asking for help', 'schedule/time language', 'emergency phrases'],
    lessons,
    reviewContent: lessons.flatMap(lesson => lesson.items.slice(0, 2).map(item => item.vocabulary?.japanese ?? item.japanese)),
  };
}
export function getWorkplaceSurvivalTopics(): WorkplaceSurvivalTopic[] { return workplaceSurvivalTopics; }
export function getLocalizedLessonItem(item: LessonItem, language: SupportLanguage): LessonItem & { supportText: string } {
  const vocabulary = item.vocabulary;
  const supportText = language === 'vi'
    ? vocabulary?.meanings.vi.join('; ') ?? item.vietnamese
    : language === 'tl'
      ? vocabulary?.meanings.tl.join('; ') ?? item.filipino
      : vocabulary?.meanings.en.join('; ') ?? item.english;
  return { ...item, supportText };
}

// Re-export for any direct importers of `dailySenseiLesson` that still exist.
export { dailySenseiLesson };
