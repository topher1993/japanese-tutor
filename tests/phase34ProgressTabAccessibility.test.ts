import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const progressSource = readFileSync('src/screens/ProgressScreen.tsx', 'utf8');

describe('Phase 34 Progress tab accessibility', () => {
  it('keeps Progress tab sections and More tools accessible before the first daily task is complete', () => {
    expect(progressSource).toContain('Your journey starts here');
    expect(progressSource).toContain("Today's plan");
    expect(progressSource).toContain('Achievements');
    expect(progressSource).toContain('More tools');
    expect(progressSource).toContain('progress-open-profile');
    expect(progressSource).not.toContain('!hasAnyProgress ? (');
  });
});
