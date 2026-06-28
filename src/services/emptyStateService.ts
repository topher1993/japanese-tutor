export type EmptyStateSurface = 'lessons' | 'flashcards' | 'progress' | 'quiz' | 'survival';
export function getEmptyStateContent(surface: EmptyStateSurface) {
  const map = {
    lessons: { title: 'No lesson started yet', body: 'Start with one workplace phrase lesson today.', actionLabel: 'Start first lesson' },
    flashcards: { title: 'No flashcards due', body: 'Complete a lesson to unlock review flashcards.', actionLabel: 'Open lessons' },
    progress: { title: 'No progress yet', body: 'Your streak starts after your first lesson.', actionLabel: 'Complete a lesson' },
    quiz: { title: 'No quiz selected', body: 'Try a quick quiz after reviewing today’s phrases.', actionLabel: 'Start quick quiz' },
    survival: { title: 'Choose a survival topic', body: 'Pick safety, help, schedule, or emergency phrases.', actionLabel: 'Browse topics' }
  } as const;
  return map[surface];
}
