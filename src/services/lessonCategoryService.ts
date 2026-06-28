import { getAllLessons } from './lessonService';
import { getAllAdditionalLessonCategoryContent } from './additionalLessonContentService';
import { getSurvivalCategories } from './workplaceSurvivalService';

export type LessonCategoryCardId = 'workplace' | 'daily-conversation' | 'shopping' | 'safety-emergency' | 'directions' | 'grammar-basics';
export type LessonCategoryStatus = 'available' | 'planned';

export interface LessonCategoryCard {
  id: LessonCategoryCardId;
  title: string;
  description: string;
  status: LessonCategoryStatus;
  lessonCount: number;
  phraseCount: number;
}

export function getLessonCategoryCards(): LessonCategoryCard[] {
  const lessons = getAllLessons();
  const survivalPhraseCount = getSurvivalCategories().reduce((total, category) => total + category.phraseCount, 0);
  const additionalContent = getAllAdditionalLessonCategoryContent();

  const workplaceCard: LessonCategoryCard = {
    id: 'workplace',
    title: 'Workplace',
    description: 'N5 workplace survival lessons, safety phrases, schedules, tools, health, and emergency Japanese.',
    status: 'available',
    lessonCount: lessons.length,
    phraseCount: survivalPhraseCount,
  };

  const additionalCards: LessonCategoryCard[] = additionalContent.map(content => ({
    id: content.id,
    title: content.title,
    description: content.description,
    status: 'available',
    lessonCount: 1,
    phraseCount: content.phrases.length,
  }));

  return [workplaceCard, ...additionalCards];
}
