export function createFakeSqliteDatabase() {
  return {
    tables: new Map<string, unknown[]>(),
    async execAsync(_sql: string): Promise<void> {},
    async runAsync(_sql: string, ..._params: unknown[]): Promise<{ changes: number }> { return { changes: 1 }; },
    async getAllAsync<T>(_sql: string, ..._params: unknown[]): Promise<T[]> { return []; }
  };
}
