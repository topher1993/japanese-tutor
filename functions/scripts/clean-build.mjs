import { rm } from 'node:fs/promises';

// Keep deploy artifacts deterministic and prevent stale compiled tests from a
// previous tsconfig from being uploaded with production Functions.
await rm(new URL('../lib/', import.meta.url), { recursive: true, force: true });
