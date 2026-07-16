// Phase 37 — Todo-gated weekly progression. Type definitions per
// docs/phase-37-todo-gated-progression-proposal.md §3.1 and §3.2.
//
// IMPORTANT (per 37b task brief): TodoState and TodoEventCounts live in THIS
// file for the 37b phase. Widening src/types/progress.ts to declare these
// fields directly belongs to a later phase — until then consumers use the
// ExtendedLearnerProgress cast pattern from sqliteLearningRepository.ts.
import type { QuizContentSource, QuizPracticeMode } from './quiz';

export type WeekTodoKind =
  | 'flashcards'
  | 'daily-rush'
  | 'quiz'
  | 'lesson'
  | 'example-sentences'
  | 'kanji';
export type TodoTrack = 'all' | 'phrases' | 'grammar';

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
  /** Optional content track filter for track-specific lesson boards. */
  track?: Exclude<TodoTrack, 'all'>;
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

export interface QuizHistoryEntry {
  id: string;
  completedAt: string;
  weekNumber: number;
  mode: QuizPracticeMode;
  source: QuizContentSource;
  score: number;
  total: number;
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
  /**
   * Phase 51 (Q6d) — distinct refIds per week whose Daily Rush answer
   * advanced them from `seen` → `memorized` or `seen` → `recognized`.
   * The daily-rush weekly todo's progress is weighted by this log
   * (cumulative, deduplicated across weeks) so a learner with prior
   * Daily Rush work shows non-zero progress even if no new transitions
   * happened this week. See practiceProgressStore.recordCardStageAdvanced.
   */
  seenStageAdvancedRefIds: Record<number, string[]>;
  /**
   * Date-keyed activity used by the daily Todo board. This is additive and
   * optional at runtime so older persisted todo blobs remain compatible.
   */
  dailyActivity: Record<string, DailyTodoActivity>;
  /** Personalized Mastery System evidence. Optional for legacy progress blobs. */
  masteryEvidence?: import('./mastery').MasteryEvidence[];
  /** One compact daily mastery snapshot, retained for weekly change reporting. */
  masterySnapshots?: import('./mastery').MasterySnapshot[];
  /** Recent quiz results retained for mode-specific progress feedback. */
  quizHistory?: QuizHistoryEntry[];
}

export interface DailyTodoActivity {
  /** Course week active when this day's activity was recorded. */
  weekNumber?: number;
  lessonIds?: string[];
  flashcardReviewIds?: string[];
  dailyRushCompleted?: boolean;
  /** Date-scoped signals consumed by Adaptive Daily Plan 2.0. */
  quizCompleted?: boolean;
  quizBestScore?: number;
  sentenceLabReviewIds?: string[];
}

/** Defaults every newly empty TodoEventCounts should start from. */
export function emptyTodoEventCounts(): TodoEventCounts {
  return {
    flashcardReviews: {},
    quizAttempts: {},
    dailyRushDates: {},
    exampleSentencesViewed: {},
    kanjiGoodAnswers: {},
    seenStageAdvancedRefIds: {},
    dailyActivity: {},
    quizHistory: [],
  };
}
