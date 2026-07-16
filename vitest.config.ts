import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['functions/**', 'node_modules/**'],
    setupFiles: ['./tests/setup.ts'],
  },
});
