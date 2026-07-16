import { completeLesson, createInitialProgress } from '../services/progressService';
import { localDateKey } from '../utils/localDate';
import type { LessonCategory, SenseiLesson } from '../types/lesson';
import type {
  ExtendedLearnerProgress,
  PersistentLearningRepository,
} from './sqliteLearningRepository';

export const WEB_LEARNING_STORAGE_KEY = 'japanese-tutor:learning:v1';

export interface LearningKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface LearningSnapshotV1 {
  schemaVersion: 1;
  lessons: SenseiLesson[];
  progress: ExtendedLearnerProgress;
}

function emptyProgress(): ExtendedLearnerProgress {
  return {
    ...createInitialProgress(localDateKey()),
    todoStates: {},
    weekTodosInitialized: {},
    todoEventCounts: {},
    weeklyReviewCompletions: [],
  };
}

function emptySnapshot(): LearningSnapshotV1 {
  return { schemaVersion: 1, lessons: [], progress: emptyProgress() };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSnapshot(raw: string | null): LearningSnapshotV1 {
  if (!raw) return emptySnapshot();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) return emptySnapshot();
    if (!Array.isArray(parsed.lessons) || !isRecord(parsed.progress)) return emptySnapshot();
    const progress = parsed.progress as unknown as Partial<ExtendedLearnerProgress>;
    if (!Array.isArray(progress.completedLessonIds) || !Array.isArray(progress.quizScores)) {
      return emptySnapshot();
    }
    return {
      schemaVersion: 1,
      lessons: parsed.lessons as SenseiLesson[],
      progress: {
        ...emptyProgress(),
        ...progress,
        todoStates: progress.todoStates ?? {},
        weekTodosInitialized: progress.weekTodosInitialized ?? {},
        todoEventCounts: progress.todoEventCounts ?? {},
        weeklyReviewCompletions: progress.weeklyReviewCompletions ?? [],
      },
    };
  } catch {
    return emptySnapshot();
  }
}

/**
 * Browser learning repository backed by localStorage's async adapter.
 * A single versioned snapshot is intentionally used here: browser storage is
 * atomic per key, and keeping lessons, canonical progress, and weekly-todo
 * state together prevents a reload from observing a partially updated save.
 */
export function createKeyValueLearningRepository(
  storage: LearningKeyValueStorage,
): PersistentLearningRepository {
  let snapshot = emptySnapshot();
  let initialization: Promise<void> | null = null;
  let writeChain: Promise<void> = Promise.resolve();

  function initialize(): Promise<void> {
    if (!initialization) {
      initialization = storage.getItem(WEB_LEARNING_STORAGE_KEY).then(raw => {
        snapshot = parseSnapshot(raw);
      });
    }
    return initialization;
  }

  function persist(): Promise<void> {
    const serialized = JSON.stringify(snapshot);
    const write = writeChain
      .catch(() => undefined)
      .then(() => storage.setItem(WEB_LEARNING_STORAGE_KEY, serialized));
    writeChain = write.catch(() => undefined);
    return write;
  }

  return {
    initialize,
    async saveLessons(lessons) {
      await initialize();
      snapshot.lessons = clone(lessons);
      await persist();
    },
    async getLessons() {
      await initialize();
      return clone(snapshot.lessons);
    },
    async findLessonsByCategory(category: LessonCategory) {
      return (await this.getLessons()).filter(lesson => lesson.category === category);
    },
    async saveCompletedLesson(lessonId, score, date) {
      await initialize();
      snapshot.progress = {
        ...snapshot.progress,
        ...completeLesson(snapshot.progress, lessonId, score, date),
      };
      await persist();
    },
    async getProgress() {
      await initialize();
      return clone(snapshot.progress);
    },
    async deleteAllProgress() {
      await initialize();
      snapshot.progress = emptyProgress();
      await persist();
    },
    async saveExtendedProgress(next) {
      await initialize();
      snapshot.progress = clone({
        ...emptyProgress(),
        ...next,
        todoStates: next.todoStates ?? {},
        weekTodosInitialized: next.weekTodosInitialized ?? {},
        todoEventCounts: next.todoEventCounts ?? {},
        weeklyReviewCompletions: next.weeklyReviewCompletions ?? [],
      });
      await persist();
    },
  };
}
