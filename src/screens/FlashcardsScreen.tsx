import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Disclosure } from '../components/Disclosure';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { FlipCard } from '../components/FlipCard';
import { JishoLink } from '../components/JishoLink';
import { Mascot, type MascotExpression } from '../components/Mascot';
import { RatingButtons, type Rating } from '../components/RatingButtons';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { ds } from '../theme/designSystem';
import { track } from '../services/analyticsService';
import { getAllLessons } from '../services/lessonService';
import { buildLessonInteractionPath } from '../services/lessonInteractionPathService';
import { answerFlashcard, createFlashcardDeck } from '../services/flashcardService';
import type { FlashcardDeck, FlashcardReviewCard } from '../types/flashcard';
import { buildCandidateFlashcardCards, getCandidateCardCounts } from '../services/candidateFlashcardAdapter';
import { createFlashcardNavigator, getNextRandomFlashcardIndex, getRandomFlashcardIndex } from '../services/flashcardNavigatorService';
import { useLearningContext } from '../services/learningContext';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { getSecondaryTranslations, getSupportTranslation } from '../services/supportLanguageService';
import type { LearnerLanguage } from '../types/onboarding';
import type { LearnerProgress } from '../types/progress';
import type { ReviewCard } from '../services/spacedRepetitionService';

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a+'T00:00:00Z').getTime() - new Date(b+'T00:00:00Z').getTime()) / 86400000);
}

export function FlashcardsScreen({
  supportLanguage = 'en',
  dueReviewMode = false,
}: {
  supportLanguage?: LearnerLanguage;
  /** Phase 25 / P1-1: when true, the deck is pre-filtered to cards whose SRS
   *  row is due today or earlier. The user can still navigate randomly via
   *  "Next", but the initial card is one of the due cards. */
  dueReviewMode?: boolean;
}) {
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [srsCardIdByRefId, setSrsCardIdByRefId] = useState<Record<string, string>>({});
  const [persistedSrsCards, setPersistedSrsCards] = useState<ReviewCard[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [candidateCounts, setCandidateCounts] = useState<{ n5: number; n4: number; total: number } | null>(null);
  const [dueCount, setDueCount] = useState<number | null>(null);
  // Mascot feedback after a rating — clears automatically on next card.
  const [lastRating, setLastRating] = useState<{ rating: Rating; cardId: string } | null>(null);
  // Direction the incoming card should slide in from. Set when a swipe
  // commits so the new card animates in from the opposite edge.
  // null = first mount (no entry animation).
  const [incomingDirection, setIncomingDirection] = useState<'left' | 'right' | null>(null);
  // Phase 50: due-card count captured at session start, used as the
  // baseline for the per-session `srs_session_summary` event. Survives
  // re-renders via state (updated only inside the SRS hydrate effect).
  const [startDueCount, setStartDueCount] = useState<number>(0);
  // Phase 50: per-session aggregate trackers — refs so they survive
  // renders without triggering re-renders. Flushed on AppState='background'
  // / unmount via the effect below.
  const lapseCount = useRef<number>(0);
  const reviewCount = useRef<number>(0);
  const efAverage = useRef<{ sum: number; n: number }>({ sum: 0, n: 0 });

  const { ready, store, srs } = useLearningContext();

  function todayIso(): string { return new Date().toISOString().slice(0, 10); }

  /**
   * Phase 37d-2: derive the active week for a flashcard review. Mirrors
   * DailyRushScreen.deriveDailyRushWeekNumber — reads completedLessonIds from
   * the persistence store and falls back to week 1 when the learner has not
   * started.
   */
  function deriveFlashcardWeekNumber(progress: LearnerProgress | null | undefined): number {
    const safeProgress: LearnerProgress = progress ?? {
      startedAt: new Date().toISOString(),
      completedLessonIds: [],
      quizScores: [],
      streak: { currentStreak: 0, longestStreak: 0 },
    };
    const path = buildLessonInteractionPath(getAllLessons(), safeProgress);
    return path.currentLesson?.week ?? 1;
  }

  useEffect(() => {
    if (!ready || !srs) return;
    let cancelled = false;
    (async () => {
      try {
        const [cards, count] = await Promise.all([srs.listCards(), srs.dueCount()]);
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const c of cards) map[c.refId] = c.id;
        setSrsCardIdByRefId(map);
        setPersistedSrsCards(cards);
        setDueCount(count);
        // Phase 50: snapshot the due count at the moment we hydrate the
        // SRS store. The per-session summary event references this baseline
        // so analytics can compare cards-due-at-start vs lapses-during-session.
        setStartDueCount(count);
      } catch {
        // SRS rehydration failed — leave maps empty, screen still works for new ratings.
      }
    })();
    return () => { cancelled = true; };
  }, [ready, srs]);

  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [dueSubset, setDueSubset] = useState<string[] | null>(null);
  useEffect(() => {
    if (!deck || !srs) return;
    if (!dueReviewMode) {
      setActiveDeck(deck);
      setDueSubset(null);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const dueRefIds = new Set(
      persistedSrsCards
        .filter(c => c.dueOn <= today)
        .map(c => c.refId),
    );
    const subset = deck.cards.filter((c: FlashcardReviewCard) => dueRefIds.has(c.id));
    setDueSubset(subset.map((c: FlashcardReviewCard) => c.id));
    if (subset.length === 0) {
      setActiveDeck(deck);
    } else {
      setActiveDeck({ ...deck, cards: subset });
      setCardIndex(0);
    }
  }, [deck, dueReviewMode, srs, persistedSrsCards]);

  useEffect(() => {
    if (!activeDeck) return;
    if (cardIndex >= activeDeck.cards.length) setCardIndex(0);
  }, [activeDeck, cardIndex]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base = createFlashcardDeck(getAllLessons());
        const candidateCards = await buildCandidateFlashcardCards();
        if (cancelled) return;
        setDeck({ ...base, title: 'Practice', cards: [...base.cards, ...candidateCards] });
        setCardIndex(getRandomFlashcardIndex([...base.cards, ...candidateCards].length));
      } catch {
        if (!cancelled) return;
        const base = createFlashcardDeck(getAllLessons());
        setDeck({ ...base, title: 'Practice', cards: base.cards });
        setCardIndex(getRandomFlashcardIndex(base.cards.length));
      }
    })();
    getCandidateCardCounts()
      .then(c => { if (!cancelled) setCandidateCounts(c); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  function recordPractice() {
    if (!ready || !store) return;
    void store.completeCurrentLesson(card.id, 100, todayIso()).catch(() => undefined);
  }

  async function refreshSrs() {
    if (!srs) return;
    try {
      const [cards, count] = await Promise.all([srs.listCards(), srs.dueCount()]);
      setDueCount(count);
      setPersistedSrsCards(cards);
    } catch {
      // Best-effort refresh — leave existing state.
    }
  }

  if (!deck || !activeDeck) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Flashcards" subtitle="Loading..." />
      </ScreenScaffold>
    );
  }

  // Phase 45 Tier-2: defensive empty-state for the case where the deck
  // hydrates successfully but has no cards to study. In practice
  // createFlashcardDeck() flattens every lesson's items so this branch
  // is reachable only if getAllLessons() returns [] (data refactor) or
  // every candidate adapter errors out. Mirrors the LessonsScreen
  // empty-wrap pattern (size 200 sits between HomeScreen's 180 and
  // LessonsScreen's 220).
  if (activeDeck.cards.length === 0) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Flashcards" subtitle="No cards yet" />
        <View style={styles.emptyWrap}>
          <EmptyStateArt screen="flashcards" size={200} />
          <Text style={styles.emptyTitle}>No flashcards yet</Text>
          <Text style={styles.emptyBody}>
            Flashcards will appear here once lessons and review items are available.
          </Text>
        </View>
      </ScreenScaffold>
    );
  }

  const navigator = createFlashcardNavigator(activeDeck, cardIndex);
  const card = navigator.currentCard;
  const primaryTranslation = getSupportTranslation(card, supportLanguage);
  const secondaryTranslations = getSecondaryTranslations(card, supportLanguage);
  const srCardId = srsCardIdByRefId[card.id];
  const srCard = srCardId
    ? persistedSrsCards.find(c => c.id === srCardId)
    : undefined;

  function showRandomCard() {
    setLastRating(null);
    setIncomingDirection('left'); // user swiped LEFT → new card enters from RIGHT
    setCardIndex(index => getNextRandomFlashcardIndex(index, activeDeck!.cards.length));
  }
  function showPreviousCard() {
    setLastRating(null);
    setIncomingDirection('right'); // user swiped RIGHT → new card enters from LEFT
    setCardIndex(index => createFlashcardNavigator(activeDeck!, index).previous().currentIndex);
  }
  function markGoodAndAdvance() {
      setDeck(currentDeck => answerFlashcard(currentDeck!, card.id, 'good', todayIso()));
      recordPractice();
      // Phase 37d-2: also notify the practiceProgressStore so the flashcards
      // todo gate (UI wired in 37c) counts this review. Guarded behind
      // isTodoFeatureEnabled() so the default behavior is unchanged for
      // non-37g builds. Uses the LearningRepositoryProvider's store.
      if (isTodoFeatureEnabled() && store) {
              void (async () => {
                try {
                  let weekNumber = 1;
                  try {
                    const progress = await store.getProgress();
                    weekNumber = deriveFlashcardWeekNumber(progress);
                  } catch {
                    // progress read failed — leave default weekNumber = 1
                  }
                  await store.recordFlashcardReview(weekNumber, card.id);
                  // Phase 37d-3: ALSO record the kanji todo progress when this card
                  // is tagged `kind === 'kanji'`. The store method de-dups by
                  // cardId and intersects against each kanji-kind todo's
                  // `kanjiSet`, so calling unconditionally is safe — non-kanji
                  // cards simply have no `kanji` todo whose kanjiSet contains the
                  // id and therefore never count. markGoodAndAdvance only fires
                  // on `good`, so we don't filter by answer here. The flashcards
                  // call above already happened; this is additive.
                  if (card.kind === 'kanji') {
                    await store.recordKanjiGood(weekNumber, card.id);
                  }
                } catch (err) {
                  if (__DEV__) console.warn('[FlashcardsScreen] failed to record flashcard review', err);
                }
              })();
            }
      setLastRating({ rating: 'good', cardId: card.id });
      showRandomCard(); // also sets incomingDirection = 'left' (new card from right)
    }
  function rateCard(rating: Rating) {
    if (!srs) return;
    let cardId = srsCardIdByRefId[card.id];
    if (!cardId) {
      const created = srs.createCard(card.id);
      cardId = created.id;
      setSrsCardIdByRefId(prev => ({ ...prev, [card.id]: cardId! }));
    }
    // Phase 50: capture pre-state for telemetry (Beru Q4 must-have).
    // We snapshot the SRS card BEFORE calling srs.review() so the
    // pre_* values reflect the actual on-disk state. The updated card
    // arrives in the .then() handler, which lets us compute post_ease
    // / post_interval as the real post-review numbers — never guessed.
    const preEase = srCard?.easeFactor ?? 2.5;
    const preInterval = srCard?.intervalDays ?? 0;
    const reps = srCard?.repetitions ?? 0;
    const preDueOn = srCard?.dueOn ?? todayIso();
    const overdueDays = Math.max(0, daysBetween(todayIso(), preDueOn));
    const overdue_state: 'on_time' | 'recent_overdue' | 'catch_up_handled' =
      overdueDays >= 2 * preInterval ? 'recent_overdue' : 'on_time';
    srs.review(cardId, rating).then((updated) => {
      const postEase = updated.easeFactor;
      const postInterval = updated.intervalDays;
      // Beru Q1+Q2 cascade: if the review was the catch-up reschedule
      // (recent_overdue) AND the post-interval came back shorter than
      // pre (i.e. the rescheduler halved the interval), tag this as
      // 'catch_up_handled' so analytics can distinguish "user reviewed
      // a long-overdue card normally" from "rescheduler stepped in".
      const final_state: 'on_time' | 'recent_overdue' | 'catch_up_handled' =
        overdue_state === 'recent_overdue' && postInterval < preInterval ? 'catch_up_handled' : overdue_state;
      track('srs_review', {
        card_id: cardId,
        rating,
        pre_ease: preEase,
        post_ease: postEase,
        pre_interval: preInterval,
        post_interval: postInterval,
        reps,
        overdue_days: overdueDays,
        overdue_state: final_state,
      });
      // Accumulate per-session aggregates (refs only — no re-renders).
      reviewCount.current += 1;
      efAverage.current.sum += postEase;
      efAverage.current.n += 1;
      if (rating === 'again') lapseCount.current += 1;
    }).catch((err) => {
      // Don't let SRS errors (e.g. card-not-found during cold-start edge
      // cases) crash the screen — surface them through the feedback path
      // instead. The persistent store hydrates from SQLite on its own;
      // this catch is the last-resort net.
      if (__DEV__) console.warn('[FlashcardsScreen] srs.review failed', err);
    });
    recordPractice();
    setLastRating({ rating, cardId: card.id });
    void refreshSrs().then(showRandomCard);
  }

  // Phase 50: per-session summary — fires when the app goes to background
  // OR when the screen unmounts. Both paths reset the aggregate refs so a
  // new session starts from zero. The session-end flush on unmount is the
  // safety net: even if AppState doesn't fire (e.g. fast refresh during
  // dev), we still emit a summary for whatever the user has rated so far.
  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        const average_ef = efAverage.current.n > 0 ? efAverage.current.sum / efAverage.current.n : 0;
        track('srs_session_summary', {
          lapse_count: lapseCount.current,
          average_ef,
          cards_due_at_session_start: startDueCount,
        });
        // reset for next session
        lapseCount.current = 0;
        reviewCount.current = 0;
        efAverage.current = { sum: 0, n: 0 };
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => {
      // final flush on unmount
      handler('background');
      sub.remove();
    };
  }, [startDueCount]);

  const subtitle = (() => {
    if (dueReviewMode && dueSubset && dueSubset.length > 0) {
      return `Review due now (${dueSubset.length})`;
    }
    if (dueCount === null) return 'Loading...';
    return `${dueCount} cards due`;
  })();

  const feedback = lastRating && lastRating.cardId === card.id
    ? mascotFeedbackFor(lastRating.rating)
    : null;

  return (
    <ScreenScaffold>
      <ScreenHeader title="Flashcards" subtitle={subtitle} />

      <View style={styles.cardWrap}>
        <FlipCard
          key={card.id}
          front={
            <View style={styles.cardFace}>
              <Text style={styles.cardFront}>{card.japanese}</Text>
              <Text style={styles.cardFrontRomaji}>{card.romaji}</Text>
              <Text style={styles.cardHint}>Tap to flip</Text>
            </View>
          }
          back={
            <View style={styles.cardFace}>
              <Text style={styles.cardBack}>{primaryTranslation.text}</Text>
              {secondaryTranslations.length > 0 ? (
                <Text style={styles.cardBackSecondary}>
                  {secondaryTranslations.map(t => `${t.label}: ${t.text}`).join(' • ')}
                </Text>
              ) : null}
              <Text style={styles.cardHint}>Tap to flip back</Text>
            </View>
          }
          cardNumber={cardIndex + 1}
          totalCards={activeDeck.cards.length}
          cornerBadge={
            <JishoLink japanese={card.japanese} variant="corner" testID={`flashcard-jisho-${card.id}`} />
          }
          onSwipeLeft={showRandomCard}
          onSwipeRight={showPreviousCard}
          swipeInDirection={incomingDirection}
        />
      </View>

      {feedback ? (
        <View style={[styles.mascotFeedback, { backgroundColor: feedback.bg }]}>
          <Mascot expression={feedback.expression} size={48} />
          <Text style={[styles.mascotFeedbackText, { color: feedback.text }]}>
            {feedback.message}
          </Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Button label="Previous" variant="soft" iconRight="arrow-left" onPress={showPreviousCard} />
        <Button label="Mark good" iconRight="check" onPress={markGoodAndAdvance} />
      </View>

      <View style={styles.ratingWrap}>
        <RatingButtons onRate={rateCard} />
      </View>

      <Disclosure title="Card info" icon="info" open={showInfo} onToggle={() => setShowInfo(v => !v)}>
        <View style={styles.infoList}>
          {candidateCounts ? (
            <Text style={styles.infoLine}>Candidate pool: {candidateCounts.n5} N5 + {candidateCounts.n4} N4 = {candidateCounts.total}</Text>
          ) : null}
          {srCard ? (
            <Text style={styles.infoLine}>Next review in {srCard.intervalDays} day{srCard.intervalDays === 1 ? '' : 's'}</Text>
          ) : (
            <Text style={styles.infoLine}>Review: not yet rated (will create SRS card on first rating)</Text>
          )}
          {/*
            Phase 49 Sensei + Beru review: dev-only fields below were
            visible to learners by default. "Card id" / "Category" / raw
            SM-2 numbers / "Storage" line invite grindy behavior (push
            Easy to inflate ease) and leak engineering noise. Gated
            behind __DEV__ so they only appear in dev builds. The
            learner-facing line above (interval in days) is intentionally
            non-numeric (no "ease 2.50" or "reps 3") to avoid the same
            trap.
          */}
          {typeof __DEV__ !== 'undefined' && __DEV__ ? (
            <>
              <Text style={styles.infoLine}>Card id: {card.id}</Text>
              <Text style={styles.infoLine}>Category: {card.category}</Text>
              {srCard ? (
                <Text style={styles.infoLine}>SM-2: {srCard.repetitions} reps, ease {srCard.easeFactor.toFixed(2)}</Text>
              ) : null}
              <Text style={styles.infoLine}>Storage: {srs ? 'persistent (durable)' : 'in-memory fallback'}</Text>
            </>
          ) : null}
        </View>
        <JishoLink japanese={card.japanese} variant="full" testID={`flashcard-jisho-info-${card.id}`} />
      </Disclosure>

      <View style={styles.chipRow}>
        <Chip label={`${card.japanese.length} chars`} selected={false} />
        <Chip label={card.category} selected={false} />
        <Chip label={`${dueCount ?? '—'} due`} selected={false} />
        {card.translationReviewStatus === 'draft' ? (
          <Chip
            label={
              supportLanguage === 'vi' ? 'Bản nháp — chờ duyệt' :
              supportLanguage === 'tl' ? 'Draft — nire-review pa' :
              'Draft — pending review'
            }
            selected
            tone="warning"
          />
        ) : null}
      </View>
    </ScreenScaffold>
  );
}

interface MascotFeedback {
  expression: MascotExpression;
  message: string;
  bg: string;
  text: string;
}

function mascotFeedbackFor(rating: Rating): MascotFeedback {
  switch (rating) {
    case 'again':
      return {
        expression: 'thinking',
        message: "That's okay — we'll see this one again soon.",
        bg: ds.colors.dangerSoft,
        text: ds.colors.danger,
      };
    case 'hard':
      return {
        expression: 'thinking',
        message: 'Tricky one. Keep going!',
        bg: ds.colors.warmSoft,
        text: ds.colors.warmInkStrong,
      };
    case 'good':
      return {
        expression: 'happy',
        message: 'Nice work! 次のカードへ。',
        bg: ds.colors.successSoft,
        text: ds.colors.text,
      };
    case 'easy':
      return {
        expression: 'celebrate',
        message: 'Perfect — you nailed it!',
        bg: ds.colors.infoSoft,
        text: ds.colors.text,
      };
    default:
      return {
        expression: 'base',
        message: '',
        bg: ds.colors.surface,
        text: ds.colors.text,
      };
  }
}

const styles = StyleSheet.create({
  cardWrap: { marginBottom: ds.spacing.md, minHeight: 240 },
  cardFace: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: ds.spacing.lg,
    gap: ds.spacing.sm,
    position: 'relative',
  },
  cardFront: { fontSize: 48, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  cardFrontRomaji: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center' },
  cardBack: { fontSize: ds.type.heading, fontWeight: '800', color: ds.colors.primary, textAlign: 'center' },
  cardBackSecondary: { fontSize: ds.type.caption, color: ds.colors.textMuted, textAlign: 'center', marginTop: ds.spacing.xs },
  cardHint: { fontSize: ds.type.micro, color: ds.colors.textMuted, marginTop: ds.spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: ds.spacing.sm, marginBottom: ds.spacing.sm },
  ratingWrap: { marginBottom: ds.spacing.md },
  mascotFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.spacing.sm,
    padding: ds.spacing.sm,
    borderRadius: ds.radius.md,
    marginBottom: ds.spacing.sm,
  },
  mascotFeedbackText: { fontSize: ds.type.body, fontWeight: '700', flexShrink: 1 },
  infoList: { gap: ds.spacing.xs },
  infoLine: { fontSize: ds.type.caption, color: ds.colors.text, fontFamily: 'monospace' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs, marginTop: ds.spacing.sm },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ds.spacing.md, paddingVertical: ds.spacing.xl },
  emptyTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  emptyBody: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center', flexShrink: 1, paddingHorizontal: ds.spacing.lg },
});