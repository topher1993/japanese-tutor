import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'node',
    include: ['emulator-test/**/*.emulator.test.ts'],
    setupFiles: [],
    testTimeout: 30_000,
    hookTimeout: 20_000,
  },
});
