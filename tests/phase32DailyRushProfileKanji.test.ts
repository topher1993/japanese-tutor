import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createFlashcardDeck } from '../src/services/flashcardService';
import { getAllLessons } from '../src/services/lessonService';
import { buildKanjiSection, mergeKanjiCardPool } from '../src/services/kanjiSectionService';
import { buildCandidateKanjiSection } from '../src/services/candidateKanjiAdapter';
import { buildProgressDashboard } from '../src/services/progressDashboardService';
import type { LearnerProgress } from '../src/types/progress';

/**
 * Phase 32 Daily Flashcard Rush + Kanji polish + Profile progression.
 *
 * Phase 43 — App.tsx split: the `showDailyRush` useState moved out of App.tsx
 * into `src/app/useAppNavigation.ts`. App.tsx still imports DailyRushScreen
 * and renders the route block (guarded by `nav.showDailyRush`), so the
 * import assertion still scans App.tsx. The useState line is now in the hook.
 */

const appSource = readFileSync('App.tsx', 'utf8');
const navHookSource = readFileSync('src/app/useAppNavigation.ts', 'utf8');
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

  it('keeps unmemorized cards in Daily Rush when an eligibility pool is supplied', async () => {
    const { buildDailyFlashcardRush } = await import('../src/services/dailyFlashcardRushService');
    const deck = createFlashcardDeck(getAllLessons());
    const eligibleCardIds = new Set(deck.cards.slice(10, 13).map(card => card.id));
    const rush = buildDailyFlashcardRush(deck, {
      date: '2026-06-29',
      supportLanguage: 'en',
      count: 10,
      eligibleCardIds,
    });

    expect(rush.cards).toHaveLength(3);
    expect(rush.cards.every(card => eligibleCardIds.has(card.card.id))).toBe(true);
  });

  it('varies distractors and answer order between Daily Rush runs while keeping a seed reproducible', async () => {
    const { buildDailyFlashcardRush } = await import('../src/services/dailyFlashcardRushService');
    const deck = createFlashcardDeck(getAllLessons());
    const first = buildDailyFlashcardRush(deck, { date: '2026-06-29', supportLanguage: 'en', choiceSeed: 'run-one' });
    const repeated = buildDailyFlashcardRush(deck, { date: '2026-06-29', supportLanguage: 'en', choiceSeed: 'run-one' });
    const nextRun = buildDailyFlashcardRush(deck, { date: '2026-06-29', supportLanguage: 'en', choiceSeed: 'run-two' });

    expect(repeated.cards.map(card => card.choices.map(choice => choice.id))).toEqual(
      first.cards.map(card => card.choices.map(choice => choice.id)),
    );
    expect(nextRun.cards.some((card, index) => (
      card.choices.map(choice => choice.id).join('|') !== first.cards[index].choices.map(choice => choice.id).join('|')
    ))).toBe(true);
  });

  it('never repeats the correct-answer position on consecutive Daily Rush cards', async () => {
    const { buildDailyFlashcardRush } = await import('../src/services/dailyFlashcardRushService');
    const rush = buildDailyFlashcardRush(createFlashcardDeck(getAllLessons()), {
      date: '2026-06-29',
      supportLanguage: 'en',
      choiceSeed: 'position-rotation',
    });
    const correctIndexes = rush.cards.map(card => card.choices.findIndex(choice => choice.correct));

    for (let index = 1; index < correctIndexes.length; index += 1) {
      expect(correctIndexes[index]).not.toBe(correctIndexes[index - 1]);
    }
  });

  it('scores Daily Rush answers as Good for correct, Again for wrong, and Again on timeout with profile-ready result totals', async () => {
    const { buildDailyFlashcardRush, answerDailyRushCard, summarizeDailyRush, timeOutDailyRushCard } = await import('../src/services/dailyFlashcardRushService');
    const deck = createFlashcardDeck(getAllLessons());
    const rush = buildDailyFlashcardRush(deck, { date: '2026-06-29', supportLanguage: 'en' });
    const first = rush.cards[0];
    const correct = first.choices.find(choice => choice.correct)!;
    const wrong = first.choices.find(choice => !choice.correct)!;

    expect(answerDailyRushCard(first, correct.id).label).toBe('good');
    expect(answerDailyRushCard(first, wrong.id).label).toBe('again');
    expect(timeOutDailyRushCard(first).label).toBe('again');
    expect(timeOutDailyRushCard(first).selectedChoiceId).toBe('timeout');

    const summary = summarizeDailyRush([
      answerDailyRushCard(first, correct.id),
      answerDailyRushCard(rush.cards[1], rush.cards[1].choices.find(choice => !choice.correct)!.id),
    ]);
    expect(summary.good).toBe(1);
    expect(summary.again).toBe(1);
    expect(summary.xpEarned).toBeGreaterThan(0);

    const timeout = timeOutDailyRushCard(rush.cards[2]);
    const duplicateTimeoutSummary = summarizeDailyRush([timeout, timeout]);
    expect(duplicateTimeoutSummary.total).toBe(1);
    expect(duplicateTimeoutSummary.good).toBe(0);
    expect(duplicateTimeoutSummary.again).toBe(1);
    expect(duplicateTimeoutSummary.xpEarned).toBe(timeout.xpEarned);
  });

  it('builds a profile patch that records one XP-bearing Daily Rush completion per date', async () => {
    const { buildDailyRushProfilePatch } = await import('../src/services/dailyFlashcardRushService');
    const { createDefaultUserProfile } = await import('../src/services/userProfileService');
    const profile = createDefaultUserProfile();
    const summary = { total: 10, good: 8, again: 2, xpEarned: 104, accuracyPercent: 80 };

    const firstPatch = buildDailyRushProfilePatch(profile, summary, '2026-06-29');
    expect(firstPatch.dynamic?.xp).toBe(104);
    expect(firstPatch.dynamic?.dailyRush?.totalRuns).toBe(1);
    expect(firstPatch.dynamic?.dailyRush?.totalGood).toBe(8);
    expect(firstPatch.dynamic?.dailyRush?.lastCompletedDate).toBe('2026-06-29');
    expect(firstPatch.dynamic?.dailyRush?.lastSummary?.accuracyPercent).toBe(80);

    const alreadyCompleted = createDefaultUserProfile({ dynamic: { xp: 104, dailyRush: firstPatch.dynamic!.dailyRush } });
    const repeatPatch = buildDailyRushProfilePatch(alreadyCompleted, summary, '2026-06-29');
    expect(repeatPatch.dynamic?.xp).toBe(104);
    expect(repeatPatch.dynamic?.dailyRush?.totalRuns).toBe(1);
    expect(repeatPatch.dynamic?.dailyRush?.totalGood).toBe(8);
  });

  it('DailyRushScreen persists completion through profile context and shows completed-today status', () => {
    const source = readFileSync('src/screens/DailyRushScreen.tsx', 'utf8');
    expect(source).toContain('useUserProfileContext');
    expect(source).toContain('buildDailyRushProfilePatch');
    expect(source).toContain('Completed today');
    expect(source).toContain('updateProfile(profilePatch)');
    expect(source).toContain('Daily Rush saved to your daily and weekly todos.');
    expect(source).toContain('pendingTodoWrites');
    expect(source).toContain('await Promise.allSettled(Array.from(pendingTodoWrites.current))');
    expect(source).toContain('disabled={!completionPersisted}');
  });

  it('wires a DailyRushScreen route and visible Home CTA without adding a bottom tab', () => {
    expect(appSource).toContain("import { DailyRushScreen } from './src/screens/DailyRushScreen';");
    // Phase 43: showDailyRush state moved to useAppNavigation.ts.
    expect(navHookSource).toContain('useState(requestedDailyRush)');
    expect(navHookSource).toContain('loadPersistedNavigationState()');
    expect(navHookSource).toContain('savePersistedNavigationState({ showDailyRush: value })');
    expect(appSource).toContain('<DailyRushScreen supportLanguage={supportLanguage} onBack={() => nav.setShowDailyRush(false)} />');
    expect(homeSource).toContain('Daily Flashcard Rush');
    expect(homeSource).toContain('home-daily-rush-cta');
    expect(homeSource).toContain('onOpenDailyRush');
    expect(appSource).not.toContain("'DailyRush'");
  });

  it('DailyRushScreen exposes answer choices, Good/Again labels, faster seamless next-card timing, and a 10-second per-card countdown', () => {
    const source = readFileSync('src/screens/DailyRushScreen.tsx', 'utf8');
    expect(source).toContain('NEXT_CARD_DELAY_MS = 220');
    expect(source).toContain('DAILY_RUSH_TIMER_SECONDS = 10');
    expect(source).toContain('setInterval');
    expect(source).toContain('new Animated.Value(1)');
    expect(source).toContain('Animated.timing(timerProgress');
    expect(source).toContain('Easing.linear');
    expect(source).toContain('testID="daily-rush-timer-animation"');
    expect(source).toContain('timerProgress.interpolate');
    expect(source).toContain('timerFillColor');
    expect(source).toContain('setTimeLeft(seconds => Math.max(0, seconds - 1))');
    expect(source).toContain('}, [current?.id, timerProgress]);');
    expect(source).toContain('timeOutDailyRushCard(current)');
    expect(source).toContain('recordedAnswerAppearanceIds.current.has(current.id)');
    expect(source).toContain('recordedAnswerAppearanceIds.current.add(current.id)');
    // Phase 51 Task 4 reorganized the reset effect: `setTimeLeft(DAILY_RUSH_TIMER_SECONDS)`
    // and `setCardIndex(0)` are now on separate statements inside the same
    // `useEffect(..., [effectiveRush?.cards])` (also resetting session refs).
    // The combined literal above was split by the Phase 51 source edit;
    // assert the new shape and the reset-effect key instead.
    expect(source).toContain('setCardIndex(0);');
    expect(source).toContain('setTimeLeft(DAILY_RUSH_TIMER_SECONDS);');
    expect(source).toContain('}, [effectiveRush?.cards]);');
    expect(source).toContain("`⏱ ${timeLeft}s`");
    expect(source).toContain('10s per card');
    // Phase 51: the 4-button RatingButtons UI was removed from FlashcardsScreen
    // (and never lived on DailyRushScreen — Daily Rush used `answerDailyRushCard`
    // which is service-side). The "Good" / "Again" literal labels no longer
    // appear in DailyRushScreen.tsx. Daily Rush now derives rating from the
    // chosen choice + per-kind recall baseline, and emits telemetry events
    // `card_stage_advanced` / `card_skipped` instead. Assert the Phase 51
    // feature markers instead of the legacy literal strings.
    expect(source).toContain('getRecallBaseline');
    expect(source).toContain("track('card_stage_advanced'");
    expect(source).toContain('DAILY_RUSH_SEEN_POOL_CAP');
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
