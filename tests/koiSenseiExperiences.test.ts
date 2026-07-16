import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  KOI_COSMETICS,
  getKoiMasteryCosmetic,
} from '../src/features/koi-sensei/domain';
import {
  KOI_CARE_ACTIONS,
  KOI_DEFAULT_LEAGUE_ALIAS,
  KOI_LEAGUE_POINT_CAP,
  answerKoiDojoRound,
  applyKoiCareAction,
  buildGentleKoiLeagueStandings,
  buildKoiLocalDataExport,
  completeKoiDojoSession,
  createDefaultKoiExperienceState,
  createDefaultKoiPetSnapshot,
  createKoiDojoSession,
  createKoiSenseiRepository,
  equipKoiCosmetic,
  getKoiDojoQuestion,
  getKoiWeekKey,
  rollKoiLeagueWeek,
  type KoiCachedChatMessageV1,
  type KoiDojoCatalogCard,
} from '../src/features/koi-sensei/data';
import { createInMemoryKeyValueStorage } from '../src/services/keyValueStorage';

const DOJO_CATALOG: KoiDojoCatalogCard[] = Array.from({ length: 8 }, (_, index) => ({
  contentId: `cand-test-n5-${index + 1}`,
  contentRank: 'N5',
  prompt: `単語${index + 1}`,
  reading: `たんご${index + 1}`,
  answer: `fixture meaning ${index + 1}`,
}));

describe('Koi care and mastery closet', () => {
  it('builds bond once per care action per day without decay or punishment', () => {
    const pet = createDefaultKoiPetSnapshot();
    const experience = createDefaultKoiExperienceState();
    const first = applyKoiCareAction(pet, experience, 'green-tea', '2026-07-16');
    expect(first).toMatchObject({ applied: true, reason: 'applied' });
    expect(first.petSnapshot.bond).toBe(2);
    expect(first.experience.care.totalInteractions).toBe(1);

    const repeated = applyKoiCareAction(first.petSnapshot, first.experience, 'green-tea', '2026-07-16');
    expect(repeated).toMatchObject({ applied: false, reason: 'already-cared-today' });
    expect(repeated.petSnapshot.bond).toBe(2);
    expect(repeated.response).toContain('nothing decays');

    const tomorrow = applyKoiCareAction(repeated.petSnapshot, repeated.experience, 'green-tea', '2026-07-17');
    expect(tomorrow.petSnapshot.bond).toBe(4);
    expect(KOI_CARE_ACTIONS).toHaveLength(3);
  });

  it('equips only unlocked milestone cosmetics and toggles an equipped slot off', () => {
    const pet = createDefaultKoiPetSnapshot();
    const starter = KOI_COSMETICS.find(item => item.id === 'starter-study-headband')!;
    const equipped = equipKoiCosmetic(pet, starter);
    expect(equipped.equippedCosmeticIds.crest).toBe(starter.id);
    expect(equipKoiCosmetic(equipped, starter).equippedCosmeticIds.crest).toBeUndefined();

    const mastery = getKoiMasteryCosmetic('N5', 'vocabulary');
    expect(() => equipKoiCosmetic(pet, mastery)).toThrow('not been unlocked through mastery');
    pet.progression.rankProgress.N5.domainStars.vocabulary = 2;
    expect(equipKoiCosmetic(pet, mastery).equippedCosmeticIds.crest).toBe(mastery.id);
  });
});

describe('Koi five-round vocabulary dojo', () => {
  it('uses exactly five local questions and persists only IDs and correctness', () => {
    let session = createKoiDojoSession('N5', DOJO_CATALOG, [], 1_000, 'dojo-fixed');
    expect(session.questionContentIds).toHaveLength(5);

    while (session.currentRound < 5) {
      const question = getKoiDojoQuestion(session, DOJO_CATALOG)!;
      const result = answerKoiDojoRound(session, question.correctChoiceId, DOJO_CATALOG, session.updatedAt + 1);
      expect(result.correct).toBe(true);
      session = result.session;
    }

    expect(session.currentRound).toBe(5);
    expect(session.correctContentIds).toEqual(session.questionContentIds);
    const persisted = JSON.stringify(session);
    expect(persisted).not.toContain('fixture meaning');
    expect(persisted).not.toContain('単語');
    expect(persisted).not.toContain('selectedAnswer');
  });

  it('rewards a completed session once and caps opt-in weekly league points', () => {
    let session = createKoiDojoSession('N5', DOJO_CATALOG, [], 1_000, 'dojo-reward-once');
    while (session.currentRound < 5) {
      const question = getKoiDojoQuestion(session, DOJO_CATALOG)!;
      session = answerKoiDojoRound(
        session,
        question.correctChoiceId,
        DOJO_CATALOG,
        session.updatedAt + 1,
      ).session;
    }
    const experience = createDefaultKoiExperienceState();
    experience.league.weekKey = '2026-W29';
    experience.league.weeklyPoints = 490;
    const first = completeKoiDojoSession(session, createDefaultKoiPetSnapshot(), experience, {
      leagueEnabled: true,
      weekKey: '2026-W29',
    });
    expect(first).toMatchObject({ applied: true, score: 5, coinReward: 15, bondReward: 1, leaguePointReward: 10 });
    expect(first.experience.league.weeklyPoints).toBe(KOI_LEAGUE_POINT_CAP);
    expect(first.experience.dojo).toMatchObject({ completedSessions: 1, bestScore: 5 });

    const repeated = completeKoiDojoSession(session, first.petSnapshot, first.experience, {
      leagueEnabled: true,
      weekKey: '2026-W29',
    });
    expect(repeated).toMatchObject({ applied: false, coinReward: 0, bondReward: 0, leaguePointReward: 0 });
  });
});

describe('Koi gentle league and local privacy controls', () => {
  it('builds deterministic pseudonymous standings and resets points at a new week', () => {
    const experience = createDefaultKoiExperienceState();
    experience.league.weekKey = '2026-W28';
    experience.league.weeklyPoints = 200;
    expect(getKoiWeekKey(new Date(2026, 6, 16))).toBe('2026-W29');
    const rolled = rollKoiLeagueWeek(experience, '2026-W29');
    expect(rolled.league).toMatchObject({ alias: KOI_DEFAULT_LEAGUE_ALIAS, weekKey: '2026-W29', weeklyPoints: 0 });

    const first = buildGentleKoiLeagueStandings(rolled, '2026-W29');
    const second = buildGentleKoiLeagueStandings(rolled, '2026-W29');
    expect(first).toEqual(second);
    expect(first).toHaveLength(6);
    expect(first.filter(item => item.isLearner)).toEqual([{ alias: KOI_DEFAULT_LEAGUE_ALIAS, points: 0, isLearner: true }]);
    expect(first.every(item => !item.alias.includes('tophe'))).toBe(true);
  });

  it('exports user-facing local data but excludes retry queues and deletion tombstones', async () => {
    const repository = createKoiSenseiRepository(createInMemoryKeyValueStorage(), { now: () => 10_000 });
    const state = await repository.load();
    const exportText = buildKoiLocalDataExport({
      ...state,
      queuedClaims: [{
        schemaVersion: 1,
        kind: 'study_reward',
        claimId: 'internal-claim',
        eventType: 'dojo_completion',
        sourceId: 'dojo-1',
        occurredAt: 1,
        count: 1,
      }],
      cloudDeletionTombstone: {
        schemaVersion: 1,
        requestId: 'internal-delete-retry',
        createdAt: 1,
        attemptCount: 0,
      },
    }, 20_000);
    expect(exportText).toContain(KOI_DEFAULT_LEAGUE_ALIAS);
    expect(exportText).not.toContain('internal-claim');
    expect(exportText).not.toContain('internal-delete-retry');
  });

  it('atomically persists activity state and enforces rolling 30-day chat retention', async () => {
    const now = 5_000_000_000;
    const repository = createKoiSenseiRepository(createInMemoryKeyValueStorage(), { now: () => now });
    const pet = createDefaultKoiPetSnapshot();
    const experience = createDefaultKoiExperienceState();
    const dojo = createKoiDojoSession('N5', DOJO_CATALOG, [], now - 100, 'dojo-resume');
    await repository.saveActivityState(pet, experience, dojo);
    expect(await repository.load()).toMatchObject({ petSnapshot: pet, experience, activeDojoSession: dojo });

    const message = (id: string, createdAt: number): KoiCachedChatMessageV1 => ({
      schemaVersion: 1,
      id,
      conversationId: 'retention-test',
      role: 'user',
      text: id,
      sourceIds: [],
      createdAt,
    });
    const day = 86_400_000;
    await repository.replaceMessages([
      message('expired', now - (31 * day)),
      message('edge', now - (30 * day)),
      message('recent', now - day),
      message('future', now + 1),
    ]);
    expect((await repository.load()).messages.map(item => item.id)).toEqual(['edge', 'recent']);
  });

  it('wires accessible local-first panels without purchases or network calls', () => {
    const screen = readFileSync('src/features/koi-sensei/ui/KoiSenseiScreen.tsx', 'utf8');
    const panels = readFileSync('src/features/koi-sensei/ui/KoiExperiencePanels.tsx', 'utf8');
    expect(screen).toContain('<KoiCarePanel />');
    expect(screen).toContain('<KoiClosetPanel />');
    expect(screen).toContain('<KoiDojoPanel />');
    expect(screen).toContain('<KoiLeaguePanel />');
    expect(screen).toContain('<KoiSettingsPanel />');
    expect(panels).toContain('testID="koi-data-delete-confirm"');
    expect(panels).toContain('There are no Koi cosmetic purchases');
    expect(panels).toContain('No real name, chat, public profile, demotion, or league cosmetics');
    expect(panels).not.toMatch(/fetch\(|axios|https?:\/\//);
  });
});
