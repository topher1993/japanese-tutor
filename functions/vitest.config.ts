import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: [{
      find: /^zod$/,
      replacement: fileURLToPath(new URL('./node_modules/zod/index.js', import.meta.url)),
    }],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: [],
  },
});

