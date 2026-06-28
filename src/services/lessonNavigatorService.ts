import type { SenseiLesson } from '../types/lesson';
export interface LessonNavigatorState { lessons: SenseiLesson[]; selectedLesson?: SenseiLesson; list(): SenseiLesson[]; open(id: string): LessonNavigatorState; nextLesson(): SenseiLesson | undefined; previousLesson(): SenseiLesson | undefined; }
export function createLessonNavigator(lessons: SenseiLesson[], selectedLessonId?: string): LessonNavigatorState {
  const selectedLesson = selectedLessonId ? lessons.find(lesson => lesson.id === selectedLessonId) : undefined;
  const index = selectedLesson ? lessons.findIndex(lesson => lesson.id === selectedLesson.id) : -1;
  return { lessons, selectedLesson, list: () => lessons, open: (id: string) => createLessonNavigator(lessons, id), nextLesson: () => index >= 0 ? lessons[index + 1] : lessons[0], previousLesson: () => index > 0 ? lessons[index - 1] : undefined };
}
