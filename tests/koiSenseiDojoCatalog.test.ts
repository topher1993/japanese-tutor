import { describe, expect, it } from 'vitest';

import {
  KOI_SENSEI_STORAGE_KEYS,
  answerKoiDojoRound,
  buildGovernedKoiDojoCatalog,
  createKoiDojoSession,
  createKoiSenseiRepository,
  getKoiDojoQuestion,
  loadKoiDojoCatalog,
  prepareKoiDojoSession,
  selectKoiDojoContentIds,
  type KoiDojoCatalogCard,
  type KoiDojoSrsEvidence,
  type KoiDojoVocabularySourceEntry,
} from '../src/features/koi-sensei/data';
import { createInMemoryKeyValueStorage } from '../src/services/keyValueStorage';

function catalog(rank: 'N5' | 'N4' | 'N3' = 'N5'): KoiDojoCatalogCard[] {
  return Array.from({ length: 10 }, (_, index) => ({
    contentId: `cand-${rank.toLowerCase()}-${String(index + 1).padStart(2, '0')}`,
    contentRank: rank,
    prompt: `単語${index + 1}`,
    reading: `たんご${index + 1}`,
    answer: `meaning ${index + 1}`,
  }));
}

function evidence(
  refId: string,
  patch: Partial<KoiDojoSrsEvidence> = {},
): KoiDojoSrsEvidence {
  return {
    refId,
    stage: 'memorized',
    dueOn: '2026-08-01',
    repetitions: 4,
    easeFactor: 2.5,
    lastReviewedOn: '2026-07-15',
    ...patch,
  };
}

describe('Koi Vocab Dojo catalog and SRS selection', () => {
  it('deterministically prioritizes due cards, then weak cards, before unseen vocabulary', () => {
    const cards = catalog();
    const rows = [
      evidence('cand-n5-08', { dueOn: '2026-07-16' }),
      evidence('cand-n5-07', { dueOn: '2026-07-10', repetitions: 0, easeFactor: 1.7 }),
      evidence('cand-n5-06', { stage: 'seen', dueOn: '2026-09-01', repetitions: 0 }),
      evidence('cand-n5-05', { stage: 'recognized', dueOn: '2026-09-01', repetitions: 1 }),
    ];

    const first = selectKoiDojoContentIds(cards, rows, 'stable-session', '2026-07-17');
    const second = selectKoiDojoContentIds(cards, rows, 'stable-session', '2026-07-17');

    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
    expect(first.slice(0, 4)).toEqual([
      'cand-n5-07',
      'cand-n5-08',
      'cand-n5-06',
      'cand-n5-05',
    ]);
  });

  it('keeps only exact-rank, approved, source-backed vocabulary and maps preview ranks safely', async () => {
    const source = { id: 'jmdict-edrdg', license: 'CC BY-SA 4.0' };
    const approvedN4 = Array.from({ length: 6 }, (_, index): KoiDojoVocabularySourceEntry => ({
      id: `n4-${index + 1}`,
      japanese: `N4-${index + 1}`,
      kana: `n4-${index + 1}`,
      english: `approved ${index + 1}`,
      level: 'N4',
      reviewStatus: 'approved-for-beta',
      source,
    }));
    const mixed: KoiDojoVocabularySourceEntry[] = [
      ...approvedN4,
      { ...approvedN4[0], id: 'wrong-rank', level: 'N5' },
      { ...approvedN4[0], id: 'not-reviewed', reviewStatus: 'candidate' },
      { ...approvedN4[0], id: 'missing-license', source: { id: 'jmdict-edrdg', license: '' } },
    ];

    expect(buildGovernedKoiDojoCatalog('N4', mixed).map(card => card.contentId)).toEqual(
      approvedN4.map(entry => `cand-${entry.id}`),
    );

    const realN4 = await loadKoiDojoCatalog('N4');
    expect(realN4.length).toBeGreaterThanOrEqual(5);
    expect(realN4.every(card => card.contentRank === 'N4' && card.contentId.startsWith('cand-'))).toBe(true);

    const n3Rows = approvedN4.map((entry, index) => ({ ...entry, id: `n3-${index}`, level: 'N3' as const }));
    expect(buildGovernedKoiDojoCatalog('N1', n3Rows).every(card => card.contentRank === 'N3')).toBe(true);
  });

  it('falls back safely when learning storage is unavailable', async () => {
    const cards = catalog();
    const loadCatalog = async () => cards;
    const withoutStorage = await prepareKoiDojoSession('N5', {
      now: 1_000,
      sessionId: 'fallback-session',
      loadCatalog,
      srs: { listCards: async () => { throw new Error('storage unavailable'); } },
    });
    const repeated = await prepareKoiDojoSession('N5', {
      now: 1_000,
      sessionId: 'fallback-session',
      loadCatalog,
      srs: null,
    });

    expect(withoutStorage.selectionSource).toBe('catalog-fallback');
    expect(withoutStorage.session.questionContentIds).toEqual(repeated.session.questionContentIds);
    expect(withoutStorage.session.questionContentIds).toHaveLength(5);
  });

  it('resumes from an ID-only checkpoint and reconstructs prompt/answers at runtime', async () => {
    const cards = catalog();
    let session = createKoiDojoSession('N5', cards, [], 1_000, 'resume-session');
    const firstQuestion = getKoiDojoQuestion(session, cards)!;
    session = answerKoiDojoRound(session, firstQuestion.correctChoiceId, cards, 1_001).session;

    const storage = createInMemoryKeyValueStorage();
    const repository = createKoiSenseiRepository(storage, { now: () => 2_000 });
    await repository.saveActiveDojoSession(session);
    const raw = await storage.getItem(KOI_SENSEI_STORAGE_KEYS.localState);
    expect(raw).not.toContain('単語');
    expect(raw).not.toContain('meaning ');
    expect(raw).not.toContain('selectedAnswer');

    const resumed = (await repository.load()).activeDojoSession!;
    const nextQuestion = getKoiDojoQuestion(resumed, cards)!;
    expect(resumed.currentRound).toBe(1);
    expect(nextQuestion.contentId).toBe(resumed.questionContentIds[1]);
    expect(nextQuestion.prompt).toContain('単語');
    expect(nextQuestion.choices).toHaveLength(4);
  });
});
