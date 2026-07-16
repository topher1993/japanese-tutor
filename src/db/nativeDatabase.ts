import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';
import { createTablesSql } from './schema';
import type { SqliteLikeDatabase } from '../repositories/sqliteLearningRepository';

// Keep one native handle for all providers. Multiple independent handles to
// the same file can invalidate native statement handles during Daily Rush's
// burst of review/todo writes.
let databasePromise: Promise<SQLiteDatabase> | null = null;
const operationTails = new WeakMap<object, Promise<void>>();

export function openSharedNativeDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await openDatabaseAsync('japanese-tutor.db');
      for (const sql of createTablesSql) await db.execAsync(sql);
      return db;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function serialize<T>(db: SQLiteDatabase, operation: () => Promise<T>): Promise<T> {
  const previous = operationTails.get(db) ?? Promise.resolve();
  const result = previous.then(operation);
  operationTails.set(db, result.then(() => undefined, () => undefined));
  return result;
}

export function createSharedSqliteAdapter(db: SQLiteDatabase): SqliteLikeDatabase {
  return {
    execAsync: (sql: string) => serialize(db, () => db.execAsync(sql)),
    runAsync: (sql: string, ...params: unknown[]) =>
      serialize(db, () => db.runAsync(sql, ...(params as never[]))),
    getAllAsync: ((sql: string, ...params: unknown[]) =>
      serialize(db, () => db.getAllAsync(sql, ...(params as never[])))) as SqliteLikeDatabase['getAllAsync'],
  };
}
