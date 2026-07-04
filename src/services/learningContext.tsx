import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { createPracticeProgressStore, type PracticeProgressStore } from './practiceProgressStore';
import { createInMemoryLearningRepository, type LearningRepository } from '../repositories/inMemoryLearningRepository';
import { createSqliteLearningRepository, type PersistentLearningRepository, type SqliteLikeDatabase } from '../repositories/sqliteLearningRepository';
import { createTablesSql } from '../db/schema';
import { createPersistentSrsStore, createInMemorySrsStore, type PersistentSpacedRepetitionScheduler } from './persistentSrsStore';

// React Native injects `__DEV__` at runtime; declare it for TS so we don't
// get an implicit-any error when guarding console.warn calls.
declare const __DEV__: boolean | undefined;

interface LearningContextValue {
  /** True once the underlying repository is open and ready. */
  ready: boolean;
  /** Whether persistence is durable (SQLite) or session-only (in-memory fallback). */
  durable: boolean;
  /** The practice-progress façade the screens use. */
  store: PracticeProgressStore | null;
  /** The persistent spaced-repetition scheduler (Phase 22 audit fix P0-03). */
  srs: PersistentSpacedRepetitionScheduler | null;
  /** The lower-level repo, exposed for tests and QA. */
  repo: LearningRepository | PersistentLearningRepository | null;
  /**
   * Phase 25 / P0-2: wipe every persisted lesson-completion + every SRS card,
   * and reset in-memory caches. Returns the count of SRS rows removed so
   * SettingsScreen can confirm what happened. Safe to call multiple times.
   */
  resetAll: () => Promise<{ srsRowsCleared: number }>;
}

const LearningContext = createContext<LearningContextValue>({
  ready: false,
  durable: false,
  store: null,
  srs: null,
  repo: null,
  resetAll: async () => ({ srsRowsCleared: 0 }),
});

export function useLearningContext(): LearningContextValue {
  return useContext(LearningContext);
}

/**
 * Phase 22 audit fix P0-02 + P0-03: wire the existing SQLite repository and
 * SRS scheduler into the running app via React Context. Both are opened
 * asynchronously; children render only after `ready` is true.
 *
 * On native we use the SQLite-backed implementations. On web we use the
 * in-memory variants (browser has no SQLite via expo-sqlite).
 */
export function LearningRepositoryProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<LearningContextValue>({
    ready: false,
    durable: false,
    store: null,
    srs: null,
    repo: null,
    resetAll: async () => ({ srsRowsCleared: 0 }),
  });

  useEffect(() => {
    let cancelled = false;

    async function openRepo() {
      try {
        if (Platform.OS === 'web') {
          const repo = createInMemoryLearningRepository();
          const store = createPracticeProgressStore(toPersistentShape(repo));
          const srs = createInMemorySrsStore();
          if (cancelled) return;
          setValue({ ready: true, durable: false, store, srs, repo, resetAll: makeResetAll(store, srs) });
          return;
        }

        // Native: open SQLite, ensure schema, build both stores.
        const SQLite = await import('expo-sqlite');
        const db = await SQLite.openDatabaseAsync('japanese-tutor.db');
        for (const sql of createTablesSql) await db.execAsync(sql);
        const sqliteAdapter: SqliteLikeDatabase = {
          execAsync: (sql: string) => db.execAsync(sql),
          runAsync: (sql: string, ...params: unknown[]) => db.runAsync(sql, ...(params as never[])),
          getAllAsync: ((sql: string, ...params: unknown[]) =>
            db.getAllAsync(sql, ...(params as never[]))) as SqliteLikeDatabase['getAllAsync'],
        };
        const repo = createSqliteLearningRepository(sqliteAdapter);
        await repo.initialize();
        const store = createPracticeProgressStore(repo);
        const srs = createPersistentSrsStore(sqliteAdapter);
        await srs.hydrate();
        if (cancelled) return;
        setValue({ ready: true, durable: true, store, srs, repo, resetAll: makeResetAll(store, srs) });
      } catch (err) {
        if (__DEV__) console.warn('[learning] repo open failed; falling back to in-memory', err);
        const repo = createInMemoryLearningRepository();
        const store = createPracticeProgressStore(toPersistentShape(repo));
        const srs = createInMemorySrsStore();
        if (cancelled) return;
        setValue({ ready: true, durable: false, store, srs, repo, resetAll: makeResetAll(store, srs) });
      }
    }

    openRepo();
    return () => { cancelled = true; };
  }, []);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

/**
 * Build a `resetAll` closure that wipes practice-progress + SRS via the live
 * store/srs refs. Called fresh each time the provider value updates so the
 * closure always sees the latest refs.
 */
function makeResetAll(
  store: PracticeProgressStore,
  srs: PersistentSpacedRepetitionScheduler,
): () => Promise<{ srsRowsCleared: number }> {
  return async () => {
    // Count SRS rows BEFORE clearing so the UI can confirm what happened.
    const before = await srs.listCards();
    await Promise.all([store.reset(), srs.clearAll()]);
    return { srsRowsCleared: before.length };
  };
}

function toPersistentShape(repo: LearningRepository): PersistentLearningRepository {
  return repo as unknown as PersistentLearningRepository;
}