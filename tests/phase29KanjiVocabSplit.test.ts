import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildKanjiSection, mergeKanjiCardPool } from '../src/services/kanjiSectionService';
import {
  buildCandidateKanjiSection,
  getCandidateKanjiCounts,
} from '../src/services/candidateKanjiAdapter';
import { buildCandidateFlashcardCards } from '../src/services/candidateFlashcardAdapter';

/**
 * Phase 29 — Kanji / Vocab pack split.
 *
 * Why this exists (2026-06-28, post-Phase 28 phone QA):
 *   The N5 kanji candidate file (`src/data/candidates/n5KanjiCandidateData.ts`)
 *   contained 81 multi-character entries that are real JLPT N5 vocabulary
 *   words (学校, 仕事, 会社, 時間, 今日, ...) — not single kanji. The adapter's
 *   `isSingleKanjiCharacter` filter silently dropped all 81, so:
 *     - The Kanji section only showed 84 cards (78 real kanji + 6 hardcoded
 *       additions not duplicated in the candidate pack) instead of an
 *       honest 78.
 *     - The 81 dropped entries were effectively orphaned: nothing on the
 *       learner path showed them.
 *
 *   Phase 29 splits the pack so each entry lives where it belongs:
 *     - The kanji file now contains only single-CJK-character entries.
 *     - The dropped compounds have been added to the N5 vocabulary candidate
 *       file so they surface in Flashcards / Vocab lessons.
 *     - The visible kanji count is honest (78 + 6 hardcoded-only kanji = 85)
 *       instead of looking bigger than the actual kanji pool.
 *
 * These tests fail before the data move and pass after.
 */

const N5_KANJI_DATA_PATH = join(process.cwd(), 'src/data/candidates/n5KanjiCandidateData.ts');
const N5_VOCAB_DATA_PATH = join(process.cwd(), 'src/data/candidates/n5VocabularyCandidateData.ts');

// Compounds that USED to be in the kanji file. The full list of 81 is here
// so we can assert none are still there after the move.
const COMPOUNDS_THAT_MUST_BE_OUT_OF_KANJI_FILE = [
  '学校', '仕事', '会社', '時間', '今日', '明日', '昨日',
  '毎週', '毎朝', '午前', '午後', '名前', '日本', '英語',
  '中国語', '韓国語', '黄色', '山道', '野菜', '茶碗',
  '冷蔵庫', '医者', '病院', '電話', '約束', '宿題', '勉強',
  '練習', '便利', '有名', '大切', '綺麗', '静か', '親切',
  '丁寧', '元気', '本当', '多分', '全然', '少少', '上手',
  '下手', '大好き', '嫌い', '安全', '危険', '止まれ', '逃げて',
  '助けて', '大丈夫', '忘れる', '覚える', '買う', '売る',
  '開ける', '閉じる', '始める', '終わる', '待つ', '行く',
  '来る', '帰る', '遊ぶ', '歌う', '笑う', '泣く', '怒る',
  '驚く', '困る', '考える', '選ぶ', '探す', '見つける',
  '作る', '使う', '渡す', '受け取る', '送る', '届ける',
  '住む', '結婚',
];

// 18 of those compounds were missing from the vocab file too — they must
// be added as part of the move so the vocab/flashcard paths can show them.
const COMPOUNDS_THAT_MUST_BE_IN_VOCAB_FILE = [
  '毎週', '毎朝', '山道', '冷蔵庫', '医者', '宿題',
  '勉強', '練習', '本当', '多分', '少少', '上手',
  '下手', '大好き', '嫌い', '逃げて', '開ける', '結婚',
];

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('Phase 29 kanji / vocab pack split', () => {
  it('N5 kanji candidate file no longer contains multi-character compounds', () => {
    const src = readSource(N5_KANJI_DATA_PATH);
    for (const compound of COMPOUNDS_THAT_MUST_BE_OUT_OF_KANJI_FILE) {
      expect(src, `compound "${compound}" still in kanji file`).not.toContain(`kanji: '${compound}'`);
    }
  });

  it('N5 kanji candidate file still contains real single kanji', () => {
    const src = readSource(N5_KANJI_DATA_PATH);
    // Sanity: 78 real single kanji must still be there.
    for (const kanji of ['一', '二', '三', '日', '月', '火', '水', '木', '金', '山', '川', '田', '人']) {
      expect(src, `kanji "${kanji}" missing from kanji file`).toContain(`kanji: '${kanji}'`);
    }
  });

  it('previously-orphaned compounds are now in the N5 vocabulary candidate file', () => {
    const src = readSource(N5_VOCAB_DATA_PATH);
    for (const compound of COMPOUNDS_THAT_MUST_BE_IN_VOCAB_FILE) {
      expect(src, `compound "${compound}" missing from vocab file`).toContain(`japanese: '${compound}'`);
    }
  });

  it('visible kanji pool no longer contains multi-character cards', async () => {
    const base = buildKanjiSection();
    const candidate = await buildCandidateKanjiSection();
    const visible = mergeKanjiCardPool([...base.cards, ...candidate.cards]);
    for (const card of visible) {
      expect(card.kanji.length, `kanji card "${card.kanji}" is multi-character`).toBe(1);
      expect(card.kanji, `kanji card "${card.kanji}" not in CJK range`).toMatch(/[\u3400-\u9fff]/);
    }
  });

  it('N5 visible kanji count matches the actual single-kanji source pool', async () => {
    const counts = await getCandidateKanjiCounts();
    // After Phase 29: 78 real single kanji in the candidate file (no more
    // multi-character compounds). The hardcoded base array in
    // kanjiSectionService still contributes 18 N5 entries; 12 of those
    // overlap with the candidate pool and are deduped by
    // mergeKanjiCardPool. Net unique visible cards: 78 + 18 − 12 = 84.
    expect(counts.n5).toBe(78);
    const base = buildKanjiSection();
    const candidate = await buildCandidateKanjiSection();
    const visible = mergeKanjiCardPool([...base.cards, ...candidate.cards]);
    const n5Visible = visible.filter((c) => c.jlptLevel === 'N5');
    expect(n5Visible.length).toBe(84);
    const unique = new Set(n5Visible.map((c) => c.kanji));
    expect(unique.size).toBe(n5Visible.length);
  });

  it('N4 visible kanji count is unchanged at 821 cards', async () => {
    const base = buildKanjiSection();
    const candidate = await buildCandidateKanjiSection();
    const visible = mergeKanjiCardPool([...base.cards, ...candidate.cards]);
    const n4Visible = visible.filter((c) => c.jlptLevel === 'N4');
    expect(n4Visible.length).toBe(821);
    const unique = new Set(n4Visible.map((c) => c.kanji));
    expect(unique.size).toBe(n4Visible.length);
  });

  it('new vocab entries flow through the flashcard adapter', async () => {
    const cards = await buildCandidateFlashcardCards('N4');
    for (const compound of COMPOUNDS_THAT_MUST_BE_IN_VOCAB_FILE) {
      const found = cards.some((c) => c.japanese === compound);
      expect(found, `compound "${compound}" not reachable from Flashcards`).toBe(true);
    }
  });
});
