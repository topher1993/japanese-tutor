import { survivalCategoryBase, survivalPhrases } from '../data/workplaceSurvivalPhrases';
import type { SurvivalCategory, SurvivalCategoryId, SurvivalPhrase, SurvivalTopicDetail } from '../types/workplaceSurvival';

export function getSurvivalCategories(): SurvivalCategory[] {
  return survivalCategoryBase.map(category => ({ ...category, phraseCount: survivalPhrases.filter(phrase => phrase.categoryId === category.id).length }));
}
export function getSurvivalTopicDetail(id: SurvivalCategoryId): SurvivalTopicDetail {
  const category = getSurvivalCategories().find(item => item.id === id);
  if (!category) throw new Error(`Unknown survival category: ${id}`);
  return { ...category, coachTip: id === 'emergency' || id === 'safety' ? 'Use short, clear phrases first. Point or show the problem if needed.' : 'Use polite short phrases. Repeat slowly if needed.', phrases: survivalPhrases.filter(phrase => phrase.categoryId === id) };
}
export function getPriorityEmergencyPhrases(): SurvivalPhrase[] { return survivalPhrases.filter(phrase => phrase.priority === 'emergency'); }
export function searchSurvivalPhrases(query: string): SurvivalPhrase[] {
  const q = query.toLowerCase();
  return survivalPhrases.filter(phrase => [phrase.japanese, phrase.romaji, phrase.english, phrase.vietnamese, phrase.filipino, phrase.usageNote].some(value => value.toLowerCase().includes(q)));
}
