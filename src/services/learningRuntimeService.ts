import type { PersistentLearningRepository } from '../repositories/sqliteLearningRepository';
import { createPracticeProgressStore, type PracticeProgressStore } from './practiceProgressStore';
import {
  createInMemorySrsStore,
  type PersistentSpacedRepetitionScheduler,
} from './persistentSrsStore';

declare const __DEV__: boolean | undefined;

export interface LearningRuntime {
  store: PracticeProgressStore;
  srs: PersistentSpacedRepetitionScheduler;
  repo: PersistentLearningRepository;
  /** False when only the review scheduler had to degrade to memory. */
  srsDurable: boolean;
}

/** Keep a broken review store from hiding an otherwise healthy lesson repo. */
export async function createLearningRuntimeWithSrsFallback(
  repo: PersistentLearningRepository,
  createDurableSrs: () => PersistentSpacedRepetitionScheduler,
  onSrsFailure?: (error: unknown) => void,
): Promise<LearningRuntime> {
  const store = createPracticeProgressStore(repo);
  let durableSrs: PersistentSpacedRepetitionScheduler | null = null;
  try {
    durableSrs = createDurableSrs();
    await durableSrs.hydrate();
    return { store, srs: durableSrs, repo, srsDurable: true };
  } catch (error) {
    onSrsFailure?.(error);
    const memorySrs = createInMemorySrsStore();
    const recoverySrs: PersistentSpacedRepetitionScheduler = durableSrs
      ? {
          ...memorySrs,
          // Retain the damaged durable handle for Settings recovery. Its
          // clearAll path can recreate a missing table even when hydration
          // or reads failed.
          async clearAll() {
            await memorySrs.clearAll();
            await durableSrs!.clearAll();
          },
        }
      : memorySrs;
    return { store, srs: recoverySrs, repo, srsDurable: false };
  }
}

/** Build the Settings reset operation with best-effort pre-reset counting. */
export function makeResetAll(
  store: PracticeProgressStore,
  srs: PersistentSpacedRepetitionScheduler,
): () => Promise<{ srsRowsCleared: number }> {
  return async () => {
    let before: Awaited<ReturnType<PersistentSpacedRepetitionScheduler['listCards']>> = [];
    try {
      before = await srs.listCards();
    } catch (err) {
      if (__DEV__) console.warn('[learning] could not count SRS rows before reset', err);
    }

    // Attempt both independent clears even when either one fails.
    const [progressResult, srsResult] = await Promise.allSettled([store.reset(), srs.clearAll()]);
    if (progressResult.status === 'rejected' && srsResult.status === 'rejected') {
      throw new AggregateError(
        [progressResult.reason, srsResult.reason],
        'Could not clear learning progress or review cards',
      );
    }
    if (progressResult.status === 'rejected') throw progressResult.reason;
    if (srsResult.status === 'rejected') throw srsResult.reason;
    return { srsRowsCleared: before.length };
  };
}
