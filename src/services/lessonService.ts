import { dailySenseiLesson, mockSenseiLessons, workplaceSurvivalTopics } from '../data/mockSenseiLessons';
import type { LessonCategory, LessonItem, SenseiLesson, SupportLanguage, WorkplaceSurvivalTopic } from '../types/lesson';
export interface WeeklyLessonSummary { week: number; objectives: string[]; lessons: SenseiLesson[]; reviewContent: string[]; }
export function getDailyLesson(): SenseiLesson { return dailySenseiLesson; }
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
