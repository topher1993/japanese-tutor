import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createFlashcardDeck } from '../src/services/flashcardService';
import { getAllLessons } from '../src/services/lessonService';
import { buildKanjiSection, mergeKanjiCardPool } from '../src/services/kanjiSectionService';
import { buildCandidateKanjiSection } from '../src/services/candidateKanjiAdapter';
import { buildProgressDashboard } from '../src/services/progressDashboardService';
import type { LearnerProgress } from '../src/types/progress';

const appSource = readFileSync('App.tsx', 'utf8');
const homeSource = readFileSync('src/screens/HomeScreen.tsx', 'utf8');
const profileSource = readFileSync('src/screens/ProfileScreen.tsx', 'utf8');
const flashcardSource = readFileSync('src/screens/FlashcardsScreen.tsx', 'utf8');

describe('Phase 32 Daily Flashcard Rush', () => {
  it('builds a deterministic 10-card daily rush with 4 answer choices per card', async () => {
    const { buildDailyFlashcardRush } = await import('../src/services/dailyFlashcardRushService');
    const deck = createFlashcardDeck(getAllLessons());
    const rush = buildDailyFlashcardRush(deck, { date: '2026-06-29', supportLanguage: 'en' });

    expect(rush.id).toBe('daily-rush-2026-06-29');
    expect(rush.cards).toHaveLength(10);
    expect(new Set(rush.cards.map(card => card.card.id)).size).toBe(10);
    for (const item of rush.cards) {
      expect(item.choices).toHaveLength(4);
      expect(item.choices.filter(choice => choice.correct)).toHaveLength(1);
      expect(item.choices.some(choice => choice.cardId === item.card.id && choice.correct)).toBe(true);
    }
  });

  it('scores Daily Rush answers as Good for correct and Again for wrong with profile-ready result totals', async () => {
    const { buildDailyFlashcardRush, answerDailyRushCard, summarizeDailyRush } = await import('../src/services/dailyFlashcardRushService');
    const deck = createFlashcardDeck(getAllLessons());
    const rush = buildDailyFlashcardRush(deck, { date: '2026-06-29', supportLanguage: 'en' });
    const first = rush.cards[0];
    const correct = first.choices.find(choice => choice.correct)!;
    const wrong = first.choices.find(choice => !choice.correct)!;

    expect(answerDailyRushCard(first, correct.id).label).toBe('good');
    expect(answerDailyRushCard(first, wrong.id).label).toBe('again');

    const summary = summarizeDailyRush([
      answerDailyRushCard(first, correct.id),
      answerDailyRushCard(rush.cards[1], rush.cards[1].choices.find(choice => !choice.correct)!.id),
    ]);
    expect(summary.good).toBe(1);
    expect(summary.again).toBe(1);
    expect(summary.xpEarned).toBeGreaterThan(0);
  });

  it('wires a DailyRushScreen route and visible Home CTA without adding a bottom tab', () => {
    expect(appSource).toContain("import { DailyRushScreen } from './src/screens/DailyRushScreen';");
    expect(appSource).toContain("const [showDailyRush, setShowDailyRush] = useState(getParam('screen') === 'daily-rush');");
    expect(appSource).toContain('<DailyRushScreen supportLanguage={supportLanguage} onBack={() => setShowDailyRush(false)} />');
    expect(homeSource).toContain('Daily Flashcard Rush');
    expect(homeSource).toContain('home-daily-rush-cta');
    expect(homeSource).toContain('onOpenDailyRush');
    expect(appSource).not.toContain("'DailyRush'");
  });

  it('DailyRushScreen exposes answer choices, Good/Again labels, and faster seamless next-card timing', () => {
    const source = readFileSync('src/screens/DailyRushScreen.tsx', 'utf8');
    expect(source).toContain('NEXT_CARD_DELAY_MS = 220');
    expect(source).toContain('Good');
    expect(source).toContain('Again');
    expect(source).toContain('answerDailyRushCard');
    expect(source).toContain('choices.map');
    expect(source).toContain('testID={`daily-rush-choice-${choice.id}`}');
  });
});

describe('Phase 32 Kanji polish', () => {
  it('visible kanji cards keep kanji prominent and readings/examples separate', async () => {
    const base = buildKanjiSection();
    const candidate = await buildCandidateKanjiSection();
    const visible = mergeKanjiCardPool([...base.cards, ...candidate.cards]);
    expect(visible.length).toBeGreaterThan(800);
    for (const card of visible) {
      expect(card.kanji).toMatch(/^[\u3400-\u9fff]$/);
      expect(card.readings).not.toContain(card.kanji);
      expect(card.meanings.length).toBeGreaterThan(0);
      expect(card.exampleWords.length).toBeGreaterThan(0);
    }
    const panelSource = readFileSync('src/screens/KanjiSectionPanel.tsx', 'utf8');
    expect(panelSource).toContain('styles.kanji');
    expect(panelSource).toContain('On / Kun readings');
    expect(panelSource).toContain('Meanings');
  });
});

describe('Phase 32 Profile progression', () => {
  it('computes learner XP, streak, level, badges, and recent lesson history from progress', async () => {
    const { buildProfileProgression } = await import('../src/services/profileProgressionService');
    const lessons = getAllLessons();
    const progress: LearnerProgress = {
      startedAt: '2026-06-01',
      completedLessonIds: lessons.slice(0, 7).map(lesson => lesson.id),
      quizScores: [
        { lessonId: lessons[0].id, score: 100, completedAt: '2026-06-20' },
        { lessonId: lessons[1].id, score: 80, completedAt: '2026-06-21' },
      ],
      streak: { currentStreak: 7, longestStreak: 9, lastStudyDate: '2026-06-29' },
    };
    const dashboard = buildProgressDashboard(progress, lessons);
    const profile = buildProfileProgression(progress, lessons, dashboard, { dailyRushRuns: 2, dailyRushGood: 14 });

    expect(profile.xp).toBeGreaterThan(0);
    expect(profile.level).toBeGreaterThanOrEqual(2);
    expect(profile.badges.some(badge => badge.id === 'daily-rush-starter' && badge.earned)).toBe(true);
    expect(profile.badges.some(badge => badge.id === 'seven-day-streak' && badge.earned)).toBe(true);
    expect(profile.recentHistory.length).toBeGreaterThan(0);
    expect(profile.nextMilestone.label).toContain('XP');
  });

  it('ProfileScreen renders progression cards instead of only static preference chips', () => {
    expect(profileSource).toContain('buildProfileProgression');
    expect(profileSource).toContain('XP');
    expect(profileSource).toContain('Recent study history');
    expect(profileSource).toContain('Achievement progress');
    expect(profileSource).toContain('Next milestone');
  });

  it('FlashcardsScreen keeps the faster next-card transition contract visible to users', () => {
    expect(flashcardSource).toContain('showRandomCard');
    expect(flashcardSource).toContain('setIncomingDirection');
  });
});
