import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const readRepositoryFile = (name: string): string => readFileSync(
  new URL(`../../${name}`, import.meta.url),
  'utf8',
);

describe('Koi client security rules', () => {
  it.each(['firestore.rules', 'storage.rules'])('%s has one fail-closed catch-all and no allow-true rule', (name) => {
    const rules = readRepositoryFile(name);
    expect(rules).toMatch(/match \/\{(?:document|allPaths)=\*\*\}/);
    expect(rules).toMatch(/allow read, write: if false;/);
    expect(rules).not.toMatch(/allow\s+[^;]+:\s*if\s+true/);
  });
});

