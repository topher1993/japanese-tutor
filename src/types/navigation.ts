export type AppTab = 'Home' | 'Lessons' | 'Flashcards' | 'Quiz' | 'Progress';
export type LessonTool = 'kanji' | 'example-sentences';
export interface NavigationState { activeTab: AppTab; currentLessonId?: string; history: string[]; }
