import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { FlipCard } from '../components/FlipCard';
import { Mascot } from '../components/Mascot';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ds } from '../theme/designSystem';
import { getAllLessons } from '../services/lessonService';
import { answerFlashcard, createFlashcardDeck } from '../services/flashcardService';
import { buildCandidateFlashcardCards } from '../services/candidateFlashcardAdapter';
import { answerDailyRushCard, buildDailyFlashcardRush, buildDailyRushProfilePatch, summarizeDailyRush, type DailyRushAnswerResult } from '../services/dailyFlashcardRushService';
import { useUserProfileContext } from '../services/userProfileContext';
import type { LearnerLanguage } from '../types/onboarding';
import type { FlashcardDeck } from '../types/flashcard';

export const NEXT_CARD_DELAY_MS = 220;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DailyRushScreen({ supportLanguage = 'en', onBack }: { supportLanguage?: LearnerLanguage; onBack: () => void }) {
  const [date] = useState(todayIso());
  const [cardIndex, setCardIndex] = useState(0);
  const [answers, setAnswers] = useState<DailyRushAnswerResult[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [incomingDirection, setIncomingDirection] = useState<'left' | null>(null);
  const [completionSaved, setCompletionSaved] = useState(false);
  const [practiceOnlyRun, setPracticeOnlyRun] = useState(false);
  const { profile, updateProfile } = useUserProfileContext();
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
    setCompletionSaved(false);
  }, [rush?.id]);

  useEffect(() => {
    if (answers.length === 0) setPracticeOnlyRun(completedToday === true);
  }, [answers.length, completedToday]);

  useEffect(() => {
    if (!rush || completionSaved || !profile || cardIndex < rush.cards.length || answers.length === 0) return;
    const finalSummary = summarizeDailyRush(answers);
    const profilePatch = buildDailyRushProfilePatch(profile, finalSummary, date);
    setCompletionSaved(true);
    void updateProfile(profilePatch);
  }, [answers, cardIndex, completionSaved, date, profile, rush, updateProfile]);

  function goNext() {
    setIncomingDirection('left');
    setSelectedChoiceId(null);
    setCardIndex(index => Math.min(index + 1, rush?.cards.length ?? 0));
  }

  function choose(choiceId: string) {
    if (!current || !deck || currentAnswer) return;
    const result = answerDailyRushCard(current, choiceId);
    setSelectedChoiceId(choiceId);
    setAnswers(prev => [...prev, result]);
    answerFlashcard(deck, current.card.id, result.label, date);
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
        <Button label="Do another rush" onPress={() => { setAnswers([]); setCardIndex(0); setSelectedChoiceId(null); setCompletionSaved(false); setPracticeOnlyRun(completedToday === true); }} iconRight="arrow-right" />
        <Button label="Back" onPress={onBack} variant="soft" icon="arrow-left" />
      </ScreenScaffold>
    );
  }

  const correctChoice = current.choices.find(choice => choice.correct);

  return (
    <ScreenScaffold>
      <ScreenHeader title="Daily Flashcard Rush" subtitle={completedToday ? `${answers.length}/10 answered • Completed today` : `${answers.length}/10 answered • +${summary.xpEarned} XP`} onBack={onBack} />
      <View style={styles.progressRow}>
        <Chip label={`${current.position} of ${rush.cards.length}`} selected />
        <Chip label={`${summary.good} Good`} selected={summary.good > 0} />
        <Chip label={`${summary.again} Again`} selected={summary.again > 0} tone="warning" />
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
