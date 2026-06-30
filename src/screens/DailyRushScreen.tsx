import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { FlipCard } from '../components/FlipCard';
import { Mascot } from '../components/Mascot';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ds } from '../theme/designSystem';
import { getAllLessons } from '../services/lessonService';
import { buildLessonInteractionPath } from '../services/lessonInteractionPathService';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { useLearningContext } from '../services/learningContext';
import { answerFlashcard, createFlashcardDeck } from '../services/flashcardService';
import { buildCandidateFlashcardCards } from '../services/candidateFlashcardAdapter';
import { answerDailyRushCard, buildDailyFlashcardRush, buildDailyRushProfilePatch, summarizeDailyRush, timeOutDailyRushCard, type DailyRushAnswerResult } from '../services/dailyFlashcardRushService';
import { useUserProfileContext } from '../services/userProfileContext';
import type { LearnerLanguage } from '../types/onboarding';
import type { FlashcardDeck } from '../types/flashcard';
import type { LearnerProgress } from '../types/progress';

export const NEXT_CARD_DELAY_MS = 220;
export const DAILY_RUSH_TIMER_SECONDS = 10;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Phase 37d-1 — derive the active week for a Daily Rush completion. Daily
 * Rush is a level-wide feature (its deck covers all lessons), so the active
 * week is the week of the user's next uncompleted lesson in the canonical
 * lesson path. Falls back to week 1 when the user has not started.
 *
 * This intentionally avoids pulling in the full LearnerProgress shape — the
 * screen only needs the week number. The completedLessonIds list is read
 * lazily via the progress store later, so this helper is just a quick
 * week-mapping seed.
 */
function deriveDailyRushWeekNumber(progress: LearnerProgress | null | undefined): number {
  const safeProgress: LearnerProgress = progress ?? {
    startedAt: new Date().toISOString(),
    completedLessonIds: [],
    quizScores: [],
    streak: { currentStreak: 0, longestStreak: 0 },
  };
  const path = buildLessonInteractionPath(getAllLessons(), safeProgress);
  return path.currentLesson?.week ?? 1;
}

export function DailyRushScreen({ supportLanguage = 'en', onBack }: { supportLanguage?: LearnerLanguage; onBack: () => void }) {
  const [date] = useState(todayIso());
  const [cardIndex, setCardIndex] = useState(0);
  const [answers, setAnswers] = useState<DailyRushAnswerResult[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(DAILY_RUSH_TIMER_SECONDS);
  const [incomingDirection, setIncomingDirection] = useState<'left' | null>(null);
  const [completionSaved, setCompletionSaved] = useState(false);
  const [practiceOnlyRun, setPracticeOnlyRun] = useState(false);
  const timerProgress = useRef(new Animated.Value(1)).current;
  const recordedAnswerCardIds = useRef(new Set<string>());
  const { profile, updateProfile } = useUserProfileContext();
  // Phase 37d-1: consume the same practiceProgressStore that LessonsScreen
  // and the rest of the app use, via the LearningRepositoryProvider context.
  // Earlier 37d-1 draft opened a fresh SQLite handle here per rush completion,
  // which raced with the provider's open and double-initialized the schema —
  // replaced with the context's store accessor.
  const { store: practiceStore } = useLearningContext();
  const completedToday = profile?.dynamic.dailyRush.lastCompletedDate === date;
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const baseDeck = createFlashcardDeck(getAllLessons());
      try {
        const candidateCards = await buildCandidateFlashcardCards();
        if (!cancelled) setDeck({ ...baseDeck, cards: [...baseDeck.cards, ...candidateCards] });
      } catch {
        if (!cancelled) setDeck(baseDeck);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const rush = useMemo(
    () => deck ? buildDailyFlashcardRush(deck, { date, supportLanguage }) : null,
    [date, deck, supportLanguage],
  );
  const current = rush?.cards[cardIndex];
  const currentAnswer = answers.find(answer => answer.cardId === current?.card.id) ?? null;
  const summary = summarizeDailyRush(answers);

  useEffect(() => {
    setCardIndex(0);
    setAnswers([]);
    setSelectedChoiceId(null);
    setTimeLeft(DAILY_RUSH_TIMER_SECONDS);
    setCompletionSaved(false);
    recordedAnswerCardIds.current.clear();
  }, [rush?.id]);

  useEffect(() => {
    setTimeLeft(DAILY_RUSH_TIMER_SECONDS);
    timerProgress.setValue(1);
    setSelectedChoiceId(null);
  }, [current?.id, timerProgress]);

  useEffect(() => {
    timerProgress.stopAnimation();
    if (!rush || !current || currentAnswer || cardIndex >= rush.cards.length) {
      timerProgress.setValue(Math.max(0, timeLeft / DAILY_RUSH_TIMER_SECONDS));
      return;
    }
    const animation = Animated.timing(timerProgress, {
      toValue: 0,
      duration: Math.max(0, timeLeft) * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [cardIndex, current, currentAnswer, rush, timeLeft, timerProgress]);

  useEffect(() => {
    if (!rush || currentAnswer || cardIndex >= rush.cards.length || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(seconds => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cardIndex, currentAnswer, rush, timeLeft]);

  useEffect(() => {
    if (!rush || !current || currentAnswer || !deck || timeLeft > 0 || cardIndex >= rush.cards.length) return;
    if (recordedAnswerCardIds.current.has(current.card.id)) return;
    const result = timeOutDailyRushCard(current);
    recordedAnswerCardIds.current.add(current.card.id);
    setSelectedChoiceId('timeout');
    setAnswers(prev => [...prev, result]);
    answerFlashcard(deck, current.card.id, result.label, date);
    // Phase 37d-2: also notify the practiceProgressStore so the flashcards
    // todo gate (UI wired in 37c) counts this review. Guarded behind
    // isTodoFeatureEnabled() so the default behavior is unchanged for
    // non-37g builds. Uses the LearningRepositoryProvider's store (opened
    // once at app boot) — do NOT open a fresh SQLite handle here.
    if (isTodoFeatureEnabled() && practiceStore) {
      void (async () => {
        try {
          let weekNumber = 1;
          try {
            const progress = await practiceStore.getProgress();
            weekNumber = deriveDailyRushWeekNumber(progress);
          } catch {
            // progress read failed — leave default weekNumber = 1
          }
          await practiceStore.recordFlashcardReview(weekNumber, current.card.id);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[daily-rush] failed to record flashcard review', err);
        }
      })();
    }
    setTimeout(goNext, NEXT_CARD_DELAY_MS);
  }, [cardIndex, current, currentAnswer, date, deck, rush, timeLeft]);

  useEffect(() => {
    if (answers.length === 0) setPracticeOnlyRun(completedToday === true);
  }, [answers.length, completedToday]);

  useEffect(() => {
    if (!rush || completionSaved || !profile || cardIndex < rush.cards.length) return;
    const finalSummary = summarizeDailyRush(answers);
    const profilePatch = buildDailyRushProfilePatch(profile, finalSummary, date);
    setCompletionSaved(true);
    void updateProfile(profilePatch);
    // Phase 37d-1 — alongside the existing UserProfile write, notify the
    // practiceProgressStore so the daily-rush todo gate (UI wired in 37c)
    // counts this completion. Guarded behind isTodoFeatureEnabled() so the
    // default behavior is unchanged for non-37g builds. Uses the
    // LearningRepositoryProvider's store (opened once at app boot by the
    // provider) — do NOT open a fresh SQLite handle here.
    if (isTodoFeatureEnabled() && practiceStore) {
      void (async () => {
        try {
          // Derive the active week from the learner's actual progress
          // (buildLessonInteractionPath needs completedLessonIds, not the
          // user-profile lastCompletedDate string). We do not block on this
          // — if the read fails we fall back to week 1.
          let weekNumber = 1;
          try {
            const progress = await practiceStore.getProgress();
            weekNumber = deriveDailyRushWeekNumber(progress);
          } catch {
            // progress read failed — leave default weekNumber = 1
          }
          await practiceStore.recordDailyRushComplete(weekNumber, date);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[daily-rush] failed to record todo completion', err);
        }
      })();
    }
  }, [answers, cardIndex, completionSaved, date, practiceStore, profile, rush, updateProfile]);

  function goNext() {
    setIncomingDirection('left');
    setSelectedChoiceId(null);
    setTimeLeft(DAILY_RUSH_TIMER_SECONDS);
    setCardIndex(index => Math.min(index + 1, rush?.cards.length ?? 0));
  }

  function choose(choiceId: string) {
    if (!current || !deck || currentAnswer) return;
    if (recordedAnswerCardIds.current.has(current.card.id)) return;
    const result = answerDailyRushCard(current, choiceId);
    recordedAnswerCardIds.current.add(current.card.id);
    setSelectedChoiceId(choiceId);
    setAnswers(prev => [...prev, result]);
    answerFlashcard(deck, current.card.id, result.label, date);
    // Phase 37d-2: also notify the practiceProgressStore so the flashcards
    // todo gate counts this review. Guarded behind isTodoFeatureEnabled() so
    // the default behavior is unchanged for non-37g builds.
    if (isTodoFeatureEnabled() && practiceStore) {
      void (async () => {
        try {
          let weekNumber = 1;
          try {
            const progress = await practiceStore.getProgress();
            weekNumber = deriveDailyRushWeekNumber(progress);
          } catch {
            // progress read failed — leave default weekNumber = 1
          }
          await practiceStore.recordFlashcardReview(weekNumber, current.card.id);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[daily-rush] failed to record flashcard review', err);
        }
      })();
    }
    setTimeout(goNext, NEXT_CARD_DELAY_MS);
  }

  if (!rush) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Daily Flashcard Rush" subtitle="Loading full flashcard pool..." onBack={onBack} />
      </ScreenScaffold>
    );
  }

  if (!current || cardIndex >= rush.cards.length) {
    const finalSummary = summarizeDailyRush(answers);
    return (
      <ScreenScaffold>
        <ScreenHeader title="Daily Flashcard Rush" subtitle="10-card daily sprint complete" onBack={onBack} />
        <Card tone="brand" shadow="hero" style={styles.resultHero}>
          <Mascot expression={finalSummary.good >= 7 ? 'celebrate' : 'happy'} size={72} />
          <Text style={styles.resultTitle}>{finalSummary.accuracyPercent}% correct</Text>
          <Text style={styles.resultText}>{finalSummary.good} Good • {finalSummary.again} Again • +{practiceOnlyRun ? 0 : finalSummary.xpEarned} XP</Text>
          <Text style={styles.resultStatus}>{practiceOnlyRun ? 'Completed today — extra runs are practice only.' : 'Daily Rush saved to your profile.'}</Text>
        </Card>
        <Button label="Do another rush" onPress={() => { setAnswers([]); recordedAnswerCardIds.current.clear(); setCardIndex(0); setSelectedChoiceId(null); setTimeLeft(DAILY_RUSH_TIMER_SECONDS); setCompletionSaved(false); setPracticeOnlyRun(completedToday === true); }} iconRight="arrow-right" />
        <Button label="Back" onPress={onBack} variant="soft" icon="arrow-left" />
      </ScreenScaffold>
    );
  }

  const correctChoice = current.choices.find(choice => choice.correct);
  const timerFillWidth = timerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const timerFillColor = timeLeft <= 3 ? ds.colors.danger : timeLeft <= 5 ? ds.colors.warning : ds.colors.success;

  return (
    <ScreenScaffold>
      <ScreenHeader title="Daily Flashcard Rush" subtitle={completedToday ? `${answers.length}/10 answered • 10s per card • Completed today` : `${answers.length}/10 answered • 10s per card • +${summary.xpEarned} XP`} onBack={onBack} />
      <View style={styles.progressRow}>
        <Chip label={`${current.position} of ${rush.cards.length}`} selected />
        <Chip label={`${summary.good} Good`} selected={summary.good > 0} />
        <Chip label={`${summary.again} Again`} selected={summary.again > 0} tone="warning" />
        <Chip label={`⏱ ${timeLeft}s`} selected={timeLeft > 3} tone={timeLeft <= 3 ? 'warning' : 'default'} />
      </View>
      <View style={styles.timerMeter} testID="daily-rush-timer-animation">
        <View style={styles.timerMeterHeader}>
          <Text style={styles.timerMeterLabel}>Card timer</Text>
          <Text style={[styles.timerMeterValue, timeLeft <= 3 && styles.timerMeterValueWarning]}>{timeLeft}s left</Text>
        </View>
        <View style={styles.timerTrack}>
          <Animated.View style={[styles.timerFill, { width: timerFillWidth, backgroundColor: timerFillColor }]} />
        </View>
      </View>

      <FlipCard
        key={current.id}
        front={
          <View style={styles.face}>
            <Text style={styles.promptLabel}>Choose the meaning</Text>
            <Text style={styles.japanese}>{current.card.japanese}</Text>
            <Text style={styles.romaji}>{current.card.romaji}</Text>
            <Text style={styles.hint}>Answering flips the card and moves on quickly.</Text>
          </View>
        }
        back={
          <View style={styles.face}>
            <Text style={styles.revealLabel}>{currentAnswer?.label === 'good' ? 'Good' : 'Again'}</Text>
            <Text style={styles.answerText}>{correctChoice?.text}</Text>
            <Text style={styles.hint}>{currentAnswer?.correct ? 'Correct — nice work.' : 'Wrong answer — this card is marked Again.'}</Text>
          </View>
        }
        flipped={Boolean(currentAnswer)}
        disableSwipe
        swipeInDirection={incomingDirection}
        cardNumber={current.position}
        totalCards={rush.cards.length}
      />

      <View style={styles.choices}>
        {current.choices.map(choice => {
          const selected = selectedChoiceId === choice.id;
          const reveal = Boolean(currentAnswer);
          const variant = reveal && choice.correct ? 'primary' : reveal && selected && !choice.correct ? 'danger' : 'soft';
          return (
            <Button
              key={choice.id}
              label={choice.text}
              variant={variant}
              disabled={reveal}
              onPress={() => choose(choice.id)}
              testID={`daily-rush-choice-${choice.id}`}
            />
          );
        })}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs, marginBottom: ds.spacing.sm },
  timerMeter: {
    backgroundColor: ds.colors.surface,
    borderRadius: ds.radius.md,
    padding: ds.spacing.sm,
    marginBottom: ds.spacing.md,
    borderWidth: 1,
    borderColor: ds.colors.border,
    ...ds.shadow.card,
  },
  timerMeterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ds.spacing.xs },
  timerMeterLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.textMuted, textTransform: 'uppercase' },
  timerMeterValue: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.text },
  timerMeterValueWarning: { color: ds.colors.danger },
  timerTrack: { height: 10, borderRadius: ds.radius.pill, overflow: 'hidden', backgroundColor: ds.colors.surfaceMuted },
  timerFill: { height: '100%', borderRadius: ds.radius.pill },
  face: { alignItems: 'center', justifyContent: 'center', gap: ds.spacing.sm, padding: ds.spacing.md },
  promptLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  japanese: { fontSize: ds.type.display, fontWeight: '900', color: ds.colors.text, textAlign: 'center', lineHeight: 40 },
  romaji: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center' },
  hint: { fontSize: ds.type.caption, color: ds.colors.textMuted, textAlign: 'center', lineHeight: 18 },
  revealLabel: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.primary },
  answerText: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, textAlign: 'center', lineHeight: 26 },
  choices: { gap: ds.spacing.sm, marginTop: ds.spacing.md },
  resultHero: { alignItems: 'center', gap: ds.spacing.sm },
  resultTitle: { fontSize: ds.type.display, color: ds.colors.brandInk, fontWeight: '900' },
  resultText: { fontSize: ds.type.body, color: ds.colors.brandInk, fontWeight: '800', textAlign: 'center' },
  resultStatus: { fontSize: ds.type.caption, color: ds.colors.brandInk, opacity: 0.85, textAlign: 'center', lineHeight: 18 },
});
