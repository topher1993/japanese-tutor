export type AppTab = 'Home' | 'Lessons' | 'Flashcards' | 'Quiz' | 'Progress';
export interface NavigationState { activeTab: AppTab; currentLessonId?: string; history: string[]; }
