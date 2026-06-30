// Phase 37 — Todo-gated weekly progression. Type definitions per
// docs/phase-37-todo-gated-progression-proposal.md §3.1 and §3.2.
//
// IMPORTANT (per 37b task brief): TodoState and TodoEventCounts live in THIS
// file for the 37b phase. Widening src/types/progress.ts to declare these
// fields directly belongs to a later phase — until then consumers use the
// ExtendedLearnerProgress cast pattern from sqliteLearningRepository.ts.

export type WeekTodoKind =
  | 'flashcards'
  | 'daily-rush'
  | 'quiz'
  | 'lesson'
  | 'example-sentences'
  | 'kanji';

export interface WeekTodo {
  /** Stable identifier, e.g. "n5-w1-lessons". */
  id: string;
  kind: WeekTodoKind;
  /** Learner-visible title (English + selected helper lang). */
  title: string;
  /** Count threshold (cards, %, sentences, lessons). */
  target: number;
  /** Optional unit hint, e.g. "cards", "% correct". */
  unit?: string;
  /** Per-kind config: which card pool to draw from for flashcards kind. */
  pool?: 'week' | 'level' | string;
  /** For lesson-kind todos. */
  lessonIds?: string[];
  /** For kanji-kind todos. */
  kanjiSet?: string[];
}

export interface WeekPlan {
  weekNumber: number;
  todos: WeekTodo[];
  /** Default 'all' if omitted. */
  passingStrategy?: 'all' | 'majority';
}

/** Per-todo completion snapshot. Key is `todoId`. */
export interface TodoState {
  todoId: string;
  weekNumber: number;
  /** Current count toward target. */
  progress: number;
  /** Snapshot at the time the week was unlocked. */
  target: number;
  /** Epoch ms set when progress >= target. */
  completedAt?: number;
  /** Soft-skip path (see proposal §6.3 / §11.3). Not used in 37b. */
  skipped?: boolean;
}

/** Append-only event log the store writes when actions happen on screen. */
export interface TodoEventCounts {
  /** weekNumber → distinct card ids reviewed. */
  flashcardReviews: Record<number, string[]>;
  /** weekNumber → best score %, 0..100. */
  quizAttempts: Record<number, number>;
  /** weekNumber → ISO dates on which a Daily Rush was completed. */
  dailyRushDates: Record<number, string[]>;
  /** weekNumber → distinct sentence ids viewed. */
  exampleSentencesViewed: Record<number, string[]>;
  /** weekNumber → distinct kanji card ids marked Good. */
  kanjiGoodAnswers: Record<number, string[]>;
}

/** Defaults every newly empty TodoEventCounts should start from. */
export function emptyTodoEventCounts(): TodoEventCounts {
  return {
    flashcardReviews: {},
    quizAttempts: {},
    dailyRushDates: {},
    exampleSentencesViewed: {},
    kanjiGoodAnswers: {},
  };
}
