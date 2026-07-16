import type { PlacementLevel } from './placementTestService';
import type { SenseiLesson } from '../types/lesson';
import { absoluteBeginnerLessons } from '../data/absoluteBeginnerLessons';

export type CourseLevel = 'Absolute Beginner' | 'N5' | 'N4' | 'N3';

const COURSE_LEVEL_ORDER: Record<CourseLevel, number> = {
  'Absolute Beginner': 0,
  N5: 1,
  N4: 2,
  N3: 3,
};

export function placementLevelToCourseLevel(level: PlacementLevel | null | undefined): CourseLevel {
  if (level === 'absolute-beginner') return 'Absolute Beginner';
  if (level === 'N4') return 'N4';
  if (level === 'N3' || level === 'N3-or-above') return 'N3';
  return 'N5';
}

/**
 * Build the learner's forward curriculum from their placement result.
 *
 * Placement selects a starting level; it must not turn that level into a
 * terminal silo. A learner placed at N4 therefore studies N4 and then N3,
 * while an absolute beginner moves through Foundation → N5 → N4 → N3.
 * Callers that need a single-level review catalog should filter the complete
 * lesson list directly instead of using this progression helper.
 *
 * The legacy `getAllLessons()` fixture does not contain the foundation rows,
 * so prepend them for an absolute-beginner path and de-duplicate by id. The
 * learner-visible phrase catalog already contains those rows; de-duplication
 * keeps both call sites equivalent.
 */
export function lessonsForPlacementLevel(
  lessons: SenseiLesson[],
  placementLevel: PlacementLevel | null | undefined,
): SenseiLesson[] {
  const availableLessons = placementLevel === 'absolute-beginner'
    ? Array.from(
      new Map([...absoluteBeginnerLessons, ...lessons].map(lesson => [lesson.id, lesson])).values(),
    )
    : lessons;
  const startingLevel = placementLevelToCourseLevel(placementLevel);
  const startingRank = COURSE_LEVEL_ORDER[startingLevel];

  return availableLessons.filter(lesson => {
    const lessonRank = COURSE_LEVEL_ORDER[lesson.level as CourseLevel];
    return lessonRank !== undefined && lessonRank >= startingRank;
  });
}
