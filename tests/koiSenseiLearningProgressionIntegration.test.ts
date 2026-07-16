import { describe, expect, it, vi } from 'vitest';

import { getN5VocabularyCandidatePack } from '../src/data/candidates/n5VocabularyCandidatePack';
import {
  DEFAULT_KOI_LOCAL_PREFERENCES,
  createKoiEligibilityRecord,
  createDefaultKoiExperienceState,
  createDefaultKoiPetSnapshot,
  createKoiSenseiRepository,
} from '../src/features/koi-sensei/data';
import {
  KOI_DOMAINS,
  createDefaultKoiProgression,
  createKoiContentAvailabilityManifest,
  getKoiMilestoneId,
  type KoiContentAvailabilityManifestV1,
  type KoiProgressionStateV1,
} from '../src/features/koi-sensei/domain';
import { auditKoiContentEvidence } from '../src/features/koi-sensei/governance';
import {
  KOI_LEARNING_MILESTONE_THRESHOLDS,
  KOI_MAX_EVIDENCE_IDS_PER_CLAIM,
  planKoiLearningProgression,
  subscribeKoiLearningProgression,
} from '../src/features/koi-sensei/integration';
import { createInMemoryLearningRepository } from '../src/repositories/inMemoryLearningRepository';
import type { PersistentLearningRepository } from '../src/repositories/sqliteLearningRepository';
import { resetAllDeviceData } from '../src/services/appResetService';
import { createInMemoryKeyValueStorage } from '../src/services/keyValueStorage';
import { getAllCourseLessons } from '../src/services/lessonService';
import { createPracticeProgressStore } from '../src/services/practiceProgressStore';
import type { MasteryEvidence } from '../src/types/mastery';
import type { LearnerProgress } from '../src/types/progress';
import { emptyTodoEventCounts, type TodoEventCounts } from '../src/types/weeklyTodo';

const NOW = 1_725_000_000_000;

function n5Lessons() {
  return getAllCourseLessons().filter(lesson => (
    lesson.level === 'Absolute Beginner'
    || lesson.level === 'Beginner'
    || lesson.level === 'N5'
  ));
}

function progressForLessons(lessonIds: readonly string[], score = 90): LearnerProgress {
  return {
    startedAt: '2026-07-01',
    completedLessonIds: [...lessonIds],
    quizScores: lessonIds.map((lessonId, index) => ({
      lessonId,
      score,
      completedAt: `2026-07-${String(index + 1).padStart(2, '0')}`,
    })),
    streak: { currentStreak: lessonIds.length, longestStreak: lessonIds.length },
  };
}

function completedN5Progression(): KoiProgressionStateV1 {
  const progression = createDefaultKoiProgression();
  for (const domain of KOI_DOMAINS) {
    progression.rankProgress.N5.domainStars[domain] = 2;
    progression.rankProgress.N5.earnedMilestoneIds.push(
      getKoiMilestoneId('N5', domain, 'practice'),
      getKoiMilestoneId('N5', domain, 'mastery'),
    );
  }
  return progression;
}

function vocabularyEvents(count: number): TodoEventCounts {
  const events = emptyTodoEventCounts();
  const candidates = getN5VocabularyCandidatePack().slice(0, count);
  const masteryEvidence: MasteryEvidence[] = [];
  candidates.forEach((candidate, index) => {
    const refId = `cand-${candidate.id}`;
    masteryEvidence.push(
      {
        id: `recognition-${index}`,
        refId,
        modality: 'recognition',
        score: 0.8,
        source: 'flashcards',
        occurredAt: '2026-07-10T00:00:00.000Z',
      },
      {
        id: `reading-${index}`,
        refId,
        modality: 'reading',
        score: 0.75,
        source: 'flashcards',
        occurredAt: '2026-07-11T00:00:00.000Z',
      },
    );
  });
  events.masteryEvidence = masteryEvidence;
  return events;
}

describe('Koi learning-progression bridge', () => {
  it('uses the real content audit and fails closed for every currently ungoverned N5 domain', () => {
    const report = auditKoiContentEvidence();
    expect(Object.values(report.audits.N5).every(domain => !domain.ready)).toBe(true);
    const lessons = n5Lessons();
    expect(lessons.length).toBeGreaterThanOrEqual(3);
    const plan = planKoiLearningProgression({
      progression: createDefaultKoiProgression(),
      progress: progressForLessons(lessons.map(lesson => lesson.id), 100),
      extended: { todoEventCounts: vocabularyEvents(12) },
      occurredAt: NOW,
    });
    expect(plan.changed).toBe(false);
    expect(plan.claims).toEqual([]);
    expect(plan.progression).toEqual(createDefaultKoiProgression());
  });

  it('awards only a specifically governed domain from real LearnerProgress shapes', () => {
    const lessons = n5Lessons().slice(0, 4);
    const availability = createKoiContentAvailabilityManifest({
      evidenceTagged: { N5: ['quizzes'] },
    });
    const plan = planKoiLearningProgression({
      progression: createDefaultKoiProgression(),
      progress: progressForLessons(lessons.map(lesson => lesson.id), 90),
      extended: { todoEventCounts: emptyTodoEventCounts() },
      occurredAt: NOW,
    }, availability);

    expect(plan.progression.rankProgress.N5.domainStars).toEqual({
      vocabulary: 0,
      grammar: 0,
      phrases: 0,
      quizzes: 2,
    });
    expect(plan.awardedMilestoneIds).toEqual([
      getKoiMilestoneId('N5', 'quizzes', 'practice'),
      getKoiMilestoneId('N5', 'quizzes', 'mastery'),
    ]);
    expect(plan.claims).toHaveLength(2);
    for (const claim of plan.claims) {
      expect(Object.keys(claim).sort()).toEqual([
        'claimId',
        'domain',
        'evidenceIds',
        'kind',
        'milestone',
        'milestoneId',
        'occurredAt',
        'rank',
        'schemaVersion',
      ]);
      expect(claim.evidenceIds.length).toBeLessThanOrEqual(KOI_MAX_EVIDENCE_IDS_PER_CLAIM);
      expect(claim.evidenceIds.every(id => typeof id === 'string')).toBe(true);
      expect(JSON.stringify(claim)).not.toMatch(/prompt|answer|japanese|translation|rawAudio/i);
    }
  });

  it('requires successful evidence across many distinct vocabulary items for mastery', () => {
    const availability = createKoiContentAvailabilityManifest({
      evidenceTagged: { N5: ['vocabulary'] },
    });
    const repeated = vocabularyEvents(1);
    // Repeating one item many times is still one distinct item.
    repeated.masteryEvidence = Array.from({ length: 20 }, (_, index) => ({
      id: `repeat-${index}`,
      refId: repeated.masteryEvidence![0].refId,
      modality: index % 2 === 0 ? 'recognition' as const : 'reading' as const,
      score: 1,
      source: 'flashcards' as const,
      occurredAt: '2026-07-10T00:00:00.000Z',
    }));
    const repeatedPlan = planKoiLearningProgression({
      progression: createDefaultKoiProgression(),
      progress: progressForLessons([]),
      extended: { todoEventCounts: repeated },
      occurredAt: NOW,
    }, availability);
    expect(repeatedPlan.progression.rankProgress.N5.domainStars.vocabulary).toBe(0);

    const distinctPlan = planKoiLearningProgression({
      progression: createDefaultKoiProgression(),
      progress: progressForLessons([]),
      extended: {
        todoEventCounts: vocabularyEvents(
          KOI_LEARNING_MILESTONE_THRESHOLDS.masteryDistinctVocabularyItems,
        ),
      },
      occurredAt: NOW,
    }, availability);
    expect(distinctPlan.progression.rankProgress.N5.domainStars.vocabulary).toBe(2);
    expect(distinctPlan.claims.map(claim => claim.milestone)).toEqual(['practice', 'mastery']);
  });

  it('advances only when the current rank is complete and the whole next rank is governed', () => {
    const progress = progressForLessons([]);
    const fullyGoverned: KoiContentAvailabilityManifestV1 = createKoiContentAvailabilityManifest({
      evidenceTagged: { N5: KOI_DOMAINS, N4: KOI_DOMAINS },
    });
    const allowed = planKoiLearningProgression({
      progression: completedN5Progression(),
      progress,
      extended: { todoEventCounts: emptyTodoEventCounts() },
      occurredAt: NOW,
    }, fullyGoverned);
    expect(allowed.progression.currentRank).toBe('N4');
    expect(allowed.advancedRanks).toEqual(['N4']);

    const blocked = planKoiLearningProgression({
      progression: completedN5Progression(),
      progress,
      extended: { todoEventCounts: emptyTodoEventCounts() },
      occurredAt: NOW,
    }, createKoiContentAvailabilityManifest({
      evidenceTagged: { N5: KOI_DOMAINS, N4: ['vocabulary', 'grammar', 'phrases'] },
    }));
    expect(blocked.progression.currentRank).toBe('N5');
    expect(blocked.changed).toBe(false);
  });
});

describe('Koi learning subscription, atomic persistence, and reset', () => {
  it('subscribes to a real PracticeProgressStore and preserves pet/experience state', async () => {
    const learningRepository = createInMemoryLearningRepository();
    const learningStore = createPracticeProgressStore(
      learningRepository as unknown as PersistentLearningRepository,
    );
    const koiRepository = createKoiSenseiRepository(createInMemoryKeyValueStorage(), {
      now: () => NOW,
    });
    const pet = { ...createDefaultKoiPetSnapshot(), bond: 41, coins: 17 };
    const experience = {
      ...createDefaultKoiExperienceState(),
      care: { totalInteractions: 4, lastInteractionDateByAction: { 'green-tea': '2026-07-15' } },
    };
    await koiRepository.savePetSnapshot(pet);
    await koiRepository.saveExperience(experience);
    const persisted = vi.fn();
    const subscription = subscribeKoiLearningProgression({
      learningStore,
      learningRepository,
      koiRepository,
      availability: createKoiContentAvailabilityManifest({ evidenceTagged: { N5: ['quizzes'] } }),
      now: () => NOW,
      onPersisted: persisted,
    });
    await subscription.drain();

    for (const [index, lesson] of n5Lessons().slice(0, 3).entries()) {
      await learningStore.completeCurrentLesson(lesson.id, 90, `2026-07-${10 + index}`);
    }
    await subscription.drain();
    subscription.unsubscribe();

    const loaded = await koiRepository.load();
    expect(loaded.petSnapshot?.progression.rankProgress.N5.domainStars.quizzes).toBe(2);
    expect(loaded.petSnapshot).toMatchObject({ bond: 41, coins: 17 });
    expect(loaded.experience).toEqual(experience);
    expect(loaded.queuedClaims).toHaveLength(2);
    expect(persisted).toHaveBeenCalled();

    // A lower replay cannot revoke already-earned stars or mutate experience.
    await koiRepository.saveLearningProgression(createDefaultKoiProgression(), [], NOW + 1);
    const replayed = await koiRepository.load();
    expect(replayed.petSnapshot?.progression.rankProgress.N5.domainStars.quizzes).toBe(2);
    expect(replayed.experience).toEqual(experience);
  });

  it('fails atomically at queued-claim capacity instead of persisting an unreconcilable star', async () => {
    const repository = createKoiSenseiRepository(createInMemoryKeyValueStorage(), {
      maxQueuedClaims: 1,
      now: () => NOW,
    });
    const plan = planKoiLearningProgression({
      progression: createDefaultKoiProgression(),
      progress: progressForLessons(n5Lessons().slice(0, 3).map(lesson => lesson.id), 90),
      extended: { todoEventCounts: emptyTodoEventCounts() },
      occurredAt: NOW,
    }, createKoiContentAvailabilityManifest({ evidenceTagged: { N5: ['quizzes'] } }));
    await expect(repository.saveLearningProgression(plan.progression, plan.claims, NOW))
      .rejects.toThrow('queued claim capacity');
    const loaded = await repository.load();
    expect(loaded.queuedClaims).toEqual([]);
    expect(loaded.petSnapshot).toBeNull();
  });

  it('clears all local Koi data through the app-wide reset coordinator', async () => {
    const repository = createKoiSenseiRepository(createInMemoryKeyValueStorage(), {
      now: () => NOW,
    });
    await repository.saveEligibility(createKoiEligibilityRecord({
      ageBand: '18_plus',
      aiDataConsent: true,
      usProcessingAcknowledged: true,
    }, NOW));
    await repository.saveDraft('private shared-device draft');
    await repository.savePreferences({
      detailedProgressConsent: true,
      leagueParticipationEnabled: true,
    });
    await repository.savePetSnapshot({ ...createDefaultKoiPetSnapshot(), bond: 12, coins: 9 });
    await repository.saveExperience({
      ...createDefaultKoiExperienceState(),
      care: { totalInteractions: 2, lastInteractionDateByAction: { 'green-tea': '2026-07-15' } },
    });
    await repository.appendMessage({
      schemaVersion: 1,
      id: 'private-message',
      conversationId: 'private-conversation',
      role: 'user',
      text: 'private question',
      sourceIds: [],
      createdAt: NOW,
    });
    await repository.enqueueClaim({
      schemaVersion: 1,
      kind: 'study_reward',
      claimId: 'private-claim',
      eventType: 'lesson_completion',
      sourceId: 'lesson-private',
      occurredAt: NOW,
      count: 1,
    });
    const resetAppOwnedData = vi.fn();
    await resetAllDeviceData({
      resetLearning: async () => ({ srsRowsCleared: 2 }),
      resetProfile: async () => ({ profileRowsCleared: 1 }),
      resetKoi: () => repository.reset(),
      resetAppOwnedData,
    });

    expect(await repository.load()).toEqual({
      schemaVersion: 1,
      eligibility: null,
      draft: '',
      preferences: DEFAULT_KOI_LOCAL_PREFERENCES,
      petSnapshot: null,
      experience: createDefaultKoiExperienceState(),
      messages: [],
      activeDojoSession: null,
      queuedClaims: [],
      cloudDeletionTombstone: null,
    });
    expect(resetAppOwnedData).toHaveBeenCalledOnce();
  });

  it('still attempts Koi clearing when another local reset fails', async () => {
    const resetKoi = vi.fn(async () => undefined);
    const resetAppOwnedData = vi.fn(async () => undefined);
    await expect(resetAllDeviceData({
      resetLearning: async () => { throw new Error('learning storage unavailable'); },
      resetProfile: async () => ({ profileRowsCleared: 0 }),
      resetKoi,
      resetAppOwnedData,
    })).rejects.toThrow('One or more local data stores');
    expect(resetKoi).toHaveBeenCalledOnce();
    expect(resetAppOwnedData).toHaveBeenCalledOnce();
  });
});
