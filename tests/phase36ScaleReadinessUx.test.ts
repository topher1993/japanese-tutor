import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { createPracticeProgressStore } from '../src/services/practiceProgressStore';
import { createInMemoryLearningRepository } from '../src/repositories/inMemoryLearningRepository';
import { getPhraseLessons } from '../src/services/lessonService';
import type { PersistentLearningRepository } from '../src/repositories/sqliteLearningRepository';

const homeSource = readFileSync('src/screens/HomeScreen.tsx', 'utf8');
const progressSource = readFileSync('src/screens/ProgressScreen.tsx', 'utf8');

describe('Phase 36 scale readiness — learner guidance and progress clarity', () => {
  it('Home screen gives a clear Today focus before scaling more content', () => {
    expect(homeSource).toContain("Today's focus");
    expect(homeSource).toContain('nextActionLabel');
    expect(homeSource).toContain('nextActionDetail');
    expect(homeSource).toContain('{completedLessons}/{totalLessons} lessons');
    expect(homeSource).toContain('30 min plan');
    expect(homeSource).toContain('10-card Rush');
    expect(homeSource).toContain("Start your first lesson");
    expect(homeSource).toContain("Continue today's lesson");
  });

  it('Progress screen title is backed by the real bundled lesson catalog on fresh start', async () => {
    const repo = createInMemoryLearningRepository() as unknown as PersistentLearningRepository;
    const store = createPracticeProgressStore(repo);
    const dashboard = await store.getDashboard();
    expect(dashboard.completedLessons).toBe(0);
    expect(dashboard.totalLessons).toBe(getPhraseLessons().length);
    expect(dashboard.totalLessons).toBeGreaterThan(0);
    expect(progressSource).toContain('`${view.completedLessons} of ${view.totalLessons} lessons done`');
  });
});
