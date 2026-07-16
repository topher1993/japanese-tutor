import { describe, expect, it } from 'vitest';
import { createInMemoryUserProfileRepository } from '../src/repositories/userProfileRepository';
import { createDefaultUserProfile, createUserProfileService } from '../src/services/userProfileService';
import { createPracticeProgressStore } from '../src/services/practiceProgressStore';
import { createInMemoryLearningRepository } from '../src/repositories/inMemoryLearningRepository';
import type { PersistentLearningRepository } from '../src/repositories/sqliteLearningRepository';

describe('v1.1 release polish persistence', () => {
  it('persists the selected audio-study delay in the user profile', async () => {
    const service = createUserProfileService(
      createInMemoryUserProfileRepository(createDefaultUserProfile()),
    );
    const updated = await service.update({ static: { audioStudyDelayMs: 1600 } });
    expect(updated.static.audioStudyDelayMs).toBe(1600);
    expect((await service.load()).static.audioStudyDelayMs).toBe(1600);
  });

  it('persists quiz history independently from weekly todo gating', async () => {
    const store = createPracticeProgressStore(
      createInMemoryLearningRepository() as unknown as PersistentLearningRepository,
    );
    await store.ready();
    await store.recordQuizHistory({
      id: 'quiz-history-1',
      completedAt: '2026-07-13T00:00:00.000Z',
      weekNumber: 2,
      mode: 'listening',
      source: 'grammar',
      score: 4,
      total: 5,
    });
    expect(store.getExtendedProgress().todoEventCounts.quizHistory).toEqual([
      expect.objectContaining({ id: 'quiz-history-1', mode: 'listening', source: 'grammar', score: 4, total: 5 }),
    ]);
  });
});
