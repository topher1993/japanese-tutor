import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KOI_LOCAL_PREFERENCES,
  KOI_SENSEI_STORAGE_KEYS,
  createDefaultKoiExperienceState,
  createKoiSenseiRepository,
  type KoiActiveDojoSessionV1,
  type KoiCachedChatMessageV1,
  type KoiCachedPetSnapshotV1,
  type KoiCloudDeletionTombstoneV1,
  type KoiQueuedClaimV1,
  type KoiSenseiRepositoryOptions,
} from '../src/features/koi-sensei/data';
import { KOI_DOMAINS, KOI_RANKS, type KoiProgressionStateV1 } from '../src/features/koi-sensei/domain/types';
import { createInMemoryKeyValueStorage, type AsyncKeyValueStorage } from '../src/services/keyValueStorage';

const TEST_NOW = 1_000_000;

function createRepository(
  storage: AsyncKeyValueStorage,
  options: Omit<KoiSenseiRepositoryOptions, 'now'> = {},
) {
  return createKoiSenseiRepository(storage, { ...options, now: () => TEST_NOW });
}

function progression(): KoiProgressionStateV1 {
  return {
    schemaVersion: 1,
    currentRank: 'N5',
    rankProgress: Object.fromEntries(KOI_RANKS.map(rank => [rank, {
      domainStars: Object.fromEntries(KOI_DOMAINS.map(domain => [domain, 0])) as KoiProgressionStateV1['rankProgress']['N5']['domainStars'],
      earnedMilestoneIds: [],
    }])) as unknown as KoiProgressionStateV1['rankProgress'],
  };
}

function petSnapshot(): KoiCachedPetSnapshotV1 {
  return {
    schemaVersion: 1,
    revision: 4,
    syncedAt: 10_000,
    progression: progression(),
    bond: 12,
    coins: 40,
    equippedCosmeticIds: { crest: 'starter-study-headband' },
    ownedCareItemIds: ['care.green-tea'],
    ownedDojoThemeIds: ['dojo.aoi-garden'],
    selectedDojoThemeId: 'dojo.aoi-garden',
  };
}

function message(id: string, createdAt: number): KoiCachedChatMessageV1 {
  return {
    schemaVersion: 1,
    id,
    conversationId: 'conversation-1',
    role: id.startsWith('assistant') ? 'assistant' : 'user',
    text: `message ${id}`,
    sourceIds: [],
    createdAt,
  };
}

function dojoSession(): KoiActiveDojoSessionV1 {
  return {
    schemaVersion: 1,
    sessionId: 'dojo-session-1',
    rank: 'N5',
    questionContentIds: ['term-1', 'term-2', 'term-3', 'term-4', 'term-5'],
    completedContentIds: ['term-1', 'term-2'],
    correctContentIds: ['term-1'],
    currentRound: 2,
    startedAt: 1_000,
    updatedAt: 2_000,
  };
}

function rewardClaim(id: string, occurredAt = 1_000): KoiQueuedClaimV1 {
  return {
    schemaVersion: 1,
    kind: 'study_reward',
    claimId: id,
    eventType: 'lesson_completion',
    sourceId: `lesson-${id}`,
    occurredAt,
    count: 1,
  };
}

describe('Koi Sensei local repository', () => {
  it('loads safe versioned defaults when storage is empty, corrupt, or incompatible', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createRepository(storage);

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

    await storage.setItem(KOI_SENSEI_STORAGE_KEYS.localState, '{broken');
    expect((await repository.load()).messages).toEqual([]);
    await storage.setItem(KOI_SENSEI_STORAGE_KEYS.localState, JSON.stringify({ schemaVersion: 999 }));
    expect(await repository.load()).toMatchObject({ schemaVersion: 1, draft: '', petSnapshot: null });
  });

  it('round-trips draft, preferences, pet snapshot, and dojo checkpoint without leaking references', async () => {
    const repository = createRepository(createInMemoryKeyValueStorage());
    const pet = petSnapshot();
    const dojo = dojoSession();

    await repository.saveDraft('How do I use 〜ながら?');
    await repository.savePreferences({
      avatarMode: '2d',
      effectPreference: 'reduced',
      voiceAutoplayEnabled: true,
    });
    await repository.savePetSnapshot(pet);
    await repository.saveActiveDojoSession(dojo);

    const loaded = await repository.load();
    expect(loaded.draft).toBe('How do I use 〜ながら?');
    expect(loaded.preferences).toEqual({
      avatarMode: '2d',
      effectPreference: 'reduced',
      voicePlaybackEnabled: true,
      voiceAutoplayEnabled: true,
      speechToTextEnabled: true,
      detailedProgressConsent: false,
      leagueParticipationEnabled: false,
    });
    expect(loaded.petSnapshot).toEqual(pet);
    expect(loaded.activeDojoSession).toEqual(dojo);

    loaded.petSnapshot!.progression.rankProgress.N5.earnedMilestoneIds.push('external-mutation');
    loaded.activeDojoSession!.completedContentIds.push('term-3');
    const reloaded = await repository.load();
    expect(reloaded.petSnapshot!.progression.rankProgress.N5.earnedMilestoneIds).toEqual([]);
    expect(reloaded.activeDojoSession!.completedContentIds).toEqual(['term-1', 'term-2']);
  });

  it('normalizes individual corrupt fields without discarding unrelated valid state', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createRepository(storage);
    await storage.setItem(KOI_SENSEI_STORAGE_KEYS.localState, JSON.stringify({
      schemaVersion: 1,
      draft: 'kept',
      preferences: { avatarMode: 'broken', effectPreference: 'off', voicePlaybackEnabled: false },
      petSnapshot: { schemaVersion: 1, revision: -1 },
      messages: [message('valid', 1), { schemaVersion: 1, id: '', text: 'invalid' }],
      activeDojoSession: { ...dojoSession(), currentRound: 5 },
      queuedClaims: [rewardClaim('valid-claim'), { kind: 'study_reward', rawAnswer: 'secret' }],
      cloudDeletionTombstone: { schemaVersion: 1, requestId: '', createdAt: 1, attemptCount: 0 },
    }));

    const loaded = await repository.load();
    expect(loaded.draft).toBe('kept');
    expect(loaded.preferences).toMatchObject({ avatarMode: '3d', effectPreference: 'off', voicePlaybackEnabled: false });
    expect(loaded.petSnapshot).toBeNull();
    expect(loaded.messages.map(item => item.id)).toEqual(['valid']);
    expect(loaded.activeDojoSession).toBeNull();
    expect(loaded.queuedClaims.map(item => item.claimId)).toEqual(['valid-claim']);
    expect(loaded.cloudDeletionTombstone).toBeNull();
  });

  it('keeps only the newest 200 messages and handles duplicate ids deterministically', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createRepository(storage);
    await repository.replaceMessages(Array.from({ length: 205 }, (_, index) => message(`message-${index}`, index)));
    await repository.appendMessage({ ...message('message-204', 999), text: 'replacement' });

    const loaded = await repository.load();
    expect(loaded.messages).toHaveLength(200);
    expect(loaded.messages[0].id).toBe('message-5');
    expect(loaded.messages.at(-1)).toMatchObject({ id: 'message-204', text: 'replacement', createdAt: 999 });
    expect(() => createRepository(storage, { maxMessages: 201 })).toThrow('at most 200');
  });

  it('serializes concurrent message writes so none are lost', async () => {
    const backing = createInMemoryKeyValueStorage();
    const delayedStorage: AsyncKeyValueStorage = {
      ...backing,
      async setItem(key, value) {
        await new Promise(resolve => setTimeout(resolve, key.length % 3));
        await backing.setItem(key, value);
      },
    };
    const repository = createRepository(delayedStorage, { maxMessages: 10 });
    await Promise.all([
      repository.appendMessage(message('one', 1)),
      repository.appendMessage(message('two', 2)),
      repository.appendMessage(message('three', 3)),
    ]);
    expect((await repository.load()).messages.map(item => item.id)).toEqual(['one', 'two', 'three']);
  });

  it('queues content-free reward and mastery claims, de-duplicates, acknowledges, and bounds them', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createRepository(storage, { maxQueuedClaims: 2 });
    const mastery: KoiQueuedClaimV1 = {
      schemaVersion: 1,
      kind: 'mastery',
      claimId: 'mastery-1',
      rank: 'N5',
      domain: 'vocabulary',
      milestone: 'practice',
      milestoneId: 'koi.N5.vocabulary.practice.v1',
      evidenceIds: ['term-1', 'term-2'],
      occurredAt: 2_000,
    };

    await Promise.all([
      repository.enqueueClaim(rewardClaim('reward-1')),
      repository.enqueueClaim(rewardClaim('reward-1')),
    ]);
    await repository.enqueueClaim(mastery);
    expect((await repository.load()).queuedClaims).toEqual([rewardClaim('reward-1'), mastery]);
    await expect(repository.enqueueClaim(rewardClaim('reward-2'))).rejects.toThrow('capacity');

    await repository.acknowledgeClaims(['reward-1']);
    expect((await repository.load()).queuedClaims).toEqual([mastery]);
    await repository.clearQueuedClaims();
    expect((await repository.load()).queuedClaims).toEqual([]);
  });

  it('persists only allowlisted fields, never raw audio, auth tokens, answers, or renderer state', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createRepository(storage);
    await repository.savePetSnapshot({
      ...petSnapshot(),
      rawAudio: 'base64-audio',
      authToken: 'provider-token',
    } as KoiCachedPetSnapshotV1);
    await repository.appendMessage({
      ...message('private-safe', 5),
      rawAudio: [1, 2, 3],
      rendererState: { frame: 99 },
    } as KoiCachedChatMessageV1);
    await repository.saveActiveDojoSession({
      ...dojoSession(),
      selectedAnswerText: 'raw answer',
      glContext: 'transient',
    } as KoiActiveDojoSessionV1);
    await repository.enqueueClaim({
      ...rewardClaim('privacy-claim'),
      rawAnswer: 'private answer',
    } as unknown as KoiQueuedClaimV1);

    const raw = await storage.getItem(KOI_SENSEI_STORAGE_KEYS.localState);
    expect(raw).not.toContain('base64-audio');
    expect(raw).not.toContain('provider-token');
    expect(raw).not.toContain('raw answer');
    expect(raw).not.toContain('private answer');
    expect(raw).not.toContain('transient');
    expect(raw).not.toContain('rendererState');
  });

  it('tracks a credential-free cloud-deletion tombstone until explicitly cleared or reset', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createRepository(storage);
    const tombstone: KoiCloudDeletionTombstoneV1 = {
      schemaVersion: 1,
      requestId: 'delete-request-1',
      createdAt: 1_000,
      attemptCount: 2,
      lastAttemptAt: 2_000,
    };
    await repository.setCloudDeletionTombstone(tombstone);
    expect((await repository.load()).cloudDeletionTombstone).toEqual(tombstone);
    await repository.clearCloudDeletionTombstone();
    expect((await repository.load()).cloudDeletionTombstone).toBeNull();
    await repository.setCloudDeletionTombstone(tombstone);
    await repository.reset();
    expect(await storage.getItem(KOI_SENSEI_STORAGE_KEYS.localState)).toBeNull();
    expect((await repository.load()).cloudDeletionTombstone).toBeNull();
  });

  it('clears chat independently and fully resets all local Koi state', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createRepository(storage);
    await repository.saveDraft('draft');
    await repository.appendMessage(message('message', 1));
    await repository.savePetSnapshot(petSnapshot());
    await repository.clearChat();
    expect(await repository.load()).toMatchObject({ draft: '', messages: [], petSnapshot: petSnapshot() });

    await repository.reset();
    expect(await storage.getItem(KOI_SENSEI_STORAGE_KEYS.localState)).toBeNull();
    expect(await repository.load()).toMatchObject({ draft: '', messages: [], petSnapshot: null });
  });

  it('recovers the mutation queue after a failed write', async () => {
    const backing = createInMemoryKeyValueStorage();
    let failNextWrite = true;
    const flakyStorage: AsyncKeyValueStorage = {
      ...backing,
      async setItem(key, value) {
        if (failNextWrite) {
          failNextWrite = false;
          throw new Error('disk unavailable');
        }
        await backing.setItem(key, value);
      },
    };
    const repository = createRepository(flakyStorage);
    await expect(repository.saveDraft('lost')).rejects.toThrow('disk unavailable');
    await repository.saveDraft('saved');
    expect((await repository.load()).draft).toBe('saved');
  });
});
