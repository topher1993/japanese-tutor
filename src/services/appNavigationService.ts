import type { AppTab } from '../types/navigation';
import type { TabIconKey } from '../components/TabIcon';

export interface BottomNavigationTab {
  id: AppTab;
  label: string;
  icon: TabIconKey;
}

// Bottom-tab labels standardised on ACTIVITY NOUNS (Phase 22 audit fix P0-04).
// Icons are now hand-authored SVGs (PNG-rendered) instead of emoji glyphs.
export const bottomNavigationTabs: BottomNavigationTab[] = [
  { id: 'Home', label: 'Home', icon: 'home' },
  { id: 'Lessons', label: 'Lessons', icon: 'lessons' },
  { id: 'Flashcards', label: 'Flashcards', icon: 'flashcards' },
  { id: 'Quiz', label: 'Quiz', icon: 'quiz' },
  { id: 'Progress', label: 'Progress', icon: 'progress' },
];

export function getBottomNavigationTabs(): BottomNavigationTab[] {
  return bottomNavigationTabs;
}