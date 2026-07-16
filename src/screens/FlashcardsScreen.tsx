import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Chip } from '../components/Chip';
import { Disclosure } from '../components/Disclosure';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { FlipCard } from '../components/FlipCard';
import { JishoLink } from '../components/JishoLink';
import { Mascot, type MascotExpression } from '../components/Mascot';
// Phase 51 Task 5: RatingButtons is no longer rendered on this screen. The
// component file is kept (and marked @deprecated) for downstream consumers
// that still reference its `Rating` type. The type itself is re-exported
// here so the post-rating mascot feedback / state slots continue to compile.
// We do NOT import `RatingButtons` itself — see SKILL jt-interactional-card-stages.
import type { Rating } from '../components/RatingButtons';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { ds } from '../theme/designSystem';
import { track } from '../services/analyticsService';
import { getAllCourseLessons } from '../services/lessonService';
import { lessonsForPlacementLevel } from '../services/placementPathService';
import { resolveActivePhraseWeek } from '../services/activeLessonWeekService';
import { answerFlashcard, createFlashcardDeck } from '../services/flashcardService';
import type { FlashcardDeck, FlashcardReviewCard } from '../types/flashcard';
import { buildCandidateFlashcardCards, getCandidateCardCounts } from '../services/candidateFlashcardAdapter';
import { createFlashcardNavigator, getNextRandomFlashcardIndex, getRandomFlashcardIndex } from '../services/flashcardNavigatorService';
import { useLearningContext } from '../services/learningContext';
import { useUserProfileContext } from '../services/userProfileContext';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { AudioStudyPanel } from '../components/AudioStudyPanel';
import { getSecondaryTranslations, getSupportTranslation } from '../services/supportLanguageService';
import type { LearnerLanguage } from '../types/onboarding';
import type { ReviewCard, ReviewRating } from '../services/spacedRepetitionService';
import { markShadowingAttempt, speakJapanese } from '../services/speechPracticeService';
import { learningGroupLabel, taxonomyDetailLabel, VOCABULARY_LEARNING_GROUPS, type VocabularyLearningGroup } from '../services/vocabularyTaxonomyService';
import { masteryTopicLabel } from '../services/masteryService';
import { localCalendarDayDifference, localDateKey } from '../utils/localDate';

function trackSrsReviewTelemetry(
  refId: string,
  rating: ReviewRating,
  before: ReviewCard,
  after: ReviewCard,
) {
  const overdueDays = Math.max(0, localCalendarDayDifference(localDateKey(), before.dueOn));
  const overdueState = before.intervalDays > 1 && overdueDays >= 2 * before.intervalDays
    ? 'catch_up_handled'
    : overdueDays > 0
      ? 'recent_overdue'
      : 'on_time';
  track('srs_review', {
    card_id: refId,
    rating,
    pre_ease: before.easeFactor,
    post_ease: after.easeFactor,
    pre_interval: before.intervalDays,
    post_interval: after.intervalDays,
    reps: after.repetitions,
    overdue_days: overdueDays,
    overdue_state: overdueState,
  });
}

export function FlashcardsScreen({
  supportLanguage = 'en',
  dueReviewMode = false,
  weakReviewMode = false,
  initialLearningGroup,
  initialTopic,
}: {
  supportLanguage?: LearnerLanguage;
  /** Phase 25 / P1-1: when true, the deck is pre-filtered to cards whose SRS
   *  row is due today or earlier. The user can still navigate randomly via
   *  "Next", but the initial card is one of the due cards. */
  dueReviewMode?: boolean;
  weakReviewMode?: boolean;
  initialLearningGroup?: VocabularyLearningGroup | null;
  initialTopic?: string | null;
}) {
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [groupFilter, setGroupFilter] = useState<VocabularyLearningGroup | 'all'>(initialLearningGroup ?? 'all');
  const [topicFilter, setTopicFilter] = useState<string | null>(initialTopic ?? null);
  const [cardIndex, setCardIndex] = useState(0);
  const [srsCardIdByRefId, setSrsCardIdByRefId] = useState<Record<string, string>>({});
  const [persistedSrsCards, setPersistedSrsCards] = useState<ReviewCard[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [practiceMode, setPracticeMode] = useState<'flashcards' | 'audio'>('flashcards');
  const [candidateCounts, setCandidateCounts] = useState<{ n5: number; n4: number; n3: number; total: number } | null>(null);
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
  const startDueCountRef = useRef<number>(0);
  // Phase 50: per-session aggregate trackers — refs so they survive
  // renders without triggering re-renders. Flushed on AppState='background'
  // / unmount via the effect below.
  const lapseCount = useRef<number>(0);
  const reviewCount = useRef<number>(0);
  const efAverage = useRef<{ sum: number; n: number }>({ sum: 0, n: 0 });
  const reviewActionInFlight = useRef(false);
  const [reviewActionBusy, setReviewActionBusy] = useState(false);
  const ratingAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenMountedRef = useRef(true);

  // Phase 51: registry that the Phase 51 useEffect populates with the
  // latest onPressIn/onPressOut/onFlipChange handlers. The FlipCard
  // JSX reads handlers from this ref so it can use the freshly-captured
  // activeDeck/cardIndex/srs state from the most recent render without
  // forcing the FlipCard to re-render. null while the screen is
  // unmounted or before the effect has run.
  const flipHandlerRegistry = useRef<{
    onPressIn: () => void;
    onPressOut: () => void;
    onFlipChange: (nowBack: boolean) => void;
  } | null>(null);

  const { ready, store, srs } = useLearningContext();
  const { profile } = useUserProfileContext();
  const placementLevel = profile?.dynamic.placement?.level;

  useEffect(() => {
    setGroupFilter(initialLearningGroup ?? 'all');
  }, [initialLearningGroup]);
  useEffect(() => {
    setTopicFilter(initialTopic ?? null);
  }, [initialTopic]);

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
        startDueCountRef.current = count;
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
    const groupFilteredDeck = groupFilter === 'all'
      ? deck
      : { ...deck, cards: deck.cards.filter(card => card.learningGroup === groupFilter) };
    const filteredDeck = topicFilter
      ? { ...groupFilteredDeck, cards: groupFilteredDeck.cards.filter(card => card.category === topicFilter) }
      : groupFilteredDeck;
    if (!dueReviewMode && !weakReviewMode) {
      setActiveDeck(filteredDeck);
      setDueSubset(null);
      return;
    }
    const today = localDateKey();
    const dueRefIds = new Set(
      persistedSrsCards
        .filter(c => weakReviewMode
          ? c.stage !== 'memorized' || c.easeFactor < 2.2
          : c.stage === 'memorized' && c.dueOn <= today)
        .map(c => c.refId),
    );
    const subset = filteredDeck.cards.filter((c: FlashcardReviewCard) => dueRefIds.has(c.id));
    setDueSubset(subset.map((c: FlashcardReviewCard) => c.id));
    if (subset.length === 0) {
      setActiveDeck(filteredDeck);
    } else {
      setActiveDeck({ ...filteredDeck, cards: subset });
      setCardIndex(0);
    }
  }, [deck, groupFilter, topicFilter, dueReviewMode, weakReviewMode, srs, persistedSrsCards]);

  useEffect(() => {
    if (!activeDeck) return;
    if (cardIndex >= activeDeck.cards.length) setCardIndex(0);
  }, [activeDeck, cardIndex]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base = createFlashcardDeck(lessonsForPlacementLevel(getAllCourseLessons(), placementLevel));
        const candidateCards = await buildCandidateFlashcardCards(placementLevel);
        if (cancelled) return;
        setDeck({ ...base, title: 'Practice', cards: [...base.cards, ...candidateCards] });
        setCardIndex(getRandomFlashcardIndex([...base.cards, ...candidateCards].length));
      } catch {
        if (cancelled) return;
        const base = createFlashcardDeck(lessonsForPlacementLevel(getAllCourseLessons(), placementLevel));
        setDeck({ ...base, title: 'Practice', cards: base.cards });
        setCardIndex(getRandomFlashcardIndex(base.cards.length));
      }
    })();
    getCandidateCardCounts(placementLevel)
      .then(c => { if (!cancelled) setCandidateCounts(c); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [placementLevel]);

  // Phase 50: per-session summary — fires when the app goes to background
  // OR when the screen unmounts. Both paths reset the aggregate refs so a
  // new session starts from zero. The session-end flush on unmount is the
  // safety net: even if AppState doesn't fire (e.g. fast refresh during
  // dev), we still emit a summary for whatever the user has rated so far.
  //
  // RULES OF HOOKS (caught at runtime on device, log2 of 2 in the
  // RedBox): this useEffect MUST stay above every early `return` in
  // this function. Originally it sat below the `if (!deck || !activeDeck)
  // return <Loading/>` and `if (activeDeck.cards.length === 0) return
  // <EmptyState/>` early-return paths (around L178 + L193). On the first
  // render (deck=null), both early returns fired and this effect was
  // skipped — React saw 13 hooks. On the post-hydration render
  // (deck + activeDeck both populated), this effect ran — React saw 14
  // hooks → "Rendered more hooks than during the previous render". Moved
  // here so the hook count is identical on every render. A ref keeps the
  // hydration update from tearing down the effect and emitting a zero-review
  // session. The review-count guard also prevents duplicate background +
  // unmount summaries.
  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        if (reviewCount.current === 0) return;
        const average_ef = efAverage.current.n > 0 ? efAverage.current.sum / efAverage.current.n : 0;
        track('srs_session_summary', {
          lapse_count: lapseCount.current,
          average_ef,
          cards_due_at_session_start: startDueCountRef.current,
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
  }, []);

  useEffect(() => {
    screenMountedRef.current = true;
    return () => {
      screenMountedRef.current = false;
      if (ratingAdvanceTimerRef.current) clearTimeout(ratingAdvanceTimerRef.current);
    };
  }, []);

  // Phase 51: back-face dwell gate. Mirrors Phase 50's Rules-of-Hooks
  // placement — sits BEFORE the early returns below so the hook count
  // is identical on every render (deferred to L168+ comment for
  // context). The effect owns three refs and a 1500ms timer:
  //
  // - `backFaceRef` tracks whether the active card is currently showing
  //   its back face. Toggled by the FlipCard onFlipChange callback
  //   wired into the JSX below.
  // - `dwellStartRef` stores the timestamp at which the back face
  //   became visible (or zero while front).
  // - `emittedForCardRef` stores the most recent card.id for which we
  //   already fired `card_flipped_back`. Cleared whenever the active
  //   card changes so each back-face exposure emits exactly once.
  // - `dwellTimerRef` holds the active setTimeout handle so we can
  //   cancel it if the user touches down (onPressIn) before 1500ms
  //   elapses.
  //
  // Trigger flow (Beru Q1.1 — emit on blur, not unmount):
  //   1. User taps the card → FlipCard fires onFlipChange(true),
  //      parent sets backFaceRef=true and records dwellStartRef.
  //   2. User releases → FlipCard fires onPressOut, parent schedules
  //      a 1500ms timer.
  //   3a. After 1500ms, if backFaceRef is still true AND the active
  //       card matches emittedForCardRef's cleared state, fire the
  //       telemetry event with `dwell_ms` and `stage_before` pulled
  //       from srs.getCard(cardId) (or 'seen' default).
  //   3b. If the user touches down again before 1500ms (onPressIn),
  //       the timer is cancelled — no emit, matching "blur" semantics.
  //   3c. If the card changes or flips back before the timer fires,
  //       the cleanup on re-render cancels the timer.
  useEffect(() => {
    const backFaceRef = { current: false };
    const dwellStartRef = { current: 0 };
    const emittedForCardRef = { current: '' };
    const dwellTimerRef = { current: null as ReturnType<typeof setTimeout> | null };

    function clearDwellTimer() {
      if (dwellTimerRef.current !== null) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
    }

    // Re-bind the FlipCard callbacks for the currently-rendered card.
    // The registry is a ref so the FlipCard's prop closures always
    // read the latest callbacks without forcing the FlipCard to
    // re-render when these change. Because the useEffect deps include
    // activeDeck/cardIndex/srsCardIdByRefId/srs, the latest captured
    // state is wired each time those values change.
    flipHandlerRegistry.current = {
      onPressIn: () => {
        // Beru Q1.1: cancel the pending dwell emit — touching the
        // card means the user is engaged, not dwelling away.
        clearDwellTimer();
      },
      onPressOut: () => {
        // Only meaningful while back face is visible. The 1500ms
        // gate measures uninterrupted back-face dwell starting
        // from the press-out moment. (Flip completes ~550ms after
        // press, so this aligns cleanly with "user looked, then
        // released".)
        if (!backFaceRef.current) return;
        if (!activeDeck) return;
        const idx = Math.min(cardIndex, activeDeck.cards.length - 1);
        const currentCard = activeDeck.cards[idx];
        if (!currentCard) return;
        clearDwellTimer();
        const flipStartedAt = dwellStartRef.current || Date.now();
        const dwellTimer = setTimeout(() => {
          // Re-validate: card may have changed, user may have
          // touched again, or flip may have been reversed.
          if (!backFaceRef.current) return;
          if (emittedForCardRef.current === currentCard.id) return;
          const dwellMs = Math.max(1500, Date.now() - flipStartedAt);
          let stageBefore: 'seen' | 'recognized' | 'memorized' = 'seen';
          try {
            const srsCardId = srsCardIdByRefId[currentCard.id];
            const persisted = srsCardId ? srs?.getCard(srsCardId) : undefined;
            // Persisted cards default to 'memorized' after Phase 51
            // migration. Never-rated cards have no SRS row yet.
            stageBefore = (persisted?.stage ?? 'seen') as typeof stageBefore;
          } catch {
            // srs.getCard threw — keep default 'seen'.
          }
          track('card_flipped_back', {
            card_id: currentCard.id,
            dwell_ms: dwellMs,
            stage_before: stageBefore,
          });
          emittedForCardRef.current = currentCard.id;
          dwellTimerRef.current = null;
        }, 1500);
        dwellTimerRef.current = dwellTimer;
      },
      onFlipChange: (nowBack: boolean) => {
        if (!activeDeck) return;
        const idx = Math.min(cardIndex, activeDeck.cards.length - 1);
        const currentCard = activeDeck.cards[idx];
        if (!currentCard) return;
        if (nowBack) {
          // Entering back face: reset guard + start dwell clock.
          if (emittedForCardRef.current !== currentCard.id) {
            emittedForCardRef.current = '';
          }
          backFaceRef.current = true;
          dwellStartRef.current = Date.now();
          clearDwellTimer();

          // Chris's spec (2026-07-09): when the user flips a card
          // to the back face, mark it as stage='seen' so it enters
          // the Daily Rush seen-pool draw. This is the explicit
          // "I want to recall this in Daily Rush" signal.
          //
          // Idempotent: if the card already has an SRS row and is
          // already in 'seen', this is a no-op. If the row exists
          // with a different stage (recognized/memorized), the
          // 'seen' stage is intentionally NOT overridden here —
          // the user's prior progress is preserved. The card is
          // only "marked as seen" if it has never been rated
          // (no SRS row yet) OR if its current stage is 'seen'.
          if (srs) {
            void (async () => {
              try {
                let cardId = srsCardIdByRefId[currentCard.id];
                if (!cardId) {
                  const created = srs.createCard(currentCard.id);
                  cardId = created.id;
                  setSrsCardIdByRefId(prev => ({ ...prev, [currentCard.id]: cardId! }));
                }
                // Check current stage — only ensure it's 'seen' if
                // not already there. No-op for recognized/memorized.
                const persisted = srs.getCard(cardId);
                if (!persisted || persisted.stage === 'seen') {
                  // Stage is already 'seen' (or the row is fresh
                  // with the Phase 51 default). No further action
                  // needed — the card is already in the seen pool.
                  return;
                }
                // Card is recognized/memorized but the user is
                // choosing to re-flip it. Don't regress the stage
                // (that would lose their progress). The card is
                // still eligible for Daily Rush if its dueOn <= today
                // via the existing SM-2 scheduling.
              } catch (err) {
                if (__DEV__) console.warn('[FlashcardsScreen] mark-as-seen on flip failed', err);
              }
            })();
          }
        } else {
          // Returning to front: cancel any pending emit and clear
          // per-card state so the next back exposure is a fresh shot.
          backFaceRef.current = false;
          dwellStartRef.current = 0;
          clearDwellTimer();
        }
      },
    };

    return () => {
      clearDwellTimer();
      // null the registry so a stale handler doesn't fire after
      // unmount.
      flipHandlerRegistry.current = null;
    };
  }, [activeDeck, cardIndex, srsCardIdByRefId, srs]);

  function replacePersistedSrsCard(updated: ReviewCard) {
    setPersistedSrsCards(previous => {
      const withoutUpdated = previous.filter(card => card.id !== updated.id && card.refId !== updated.refId);
      return [...withoutUpdated, updated];
    });
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
  const displayedReading = card.reading ?? card.romaji;
  const displayedGroup = card.learningGroup ?? 'expression';
  const displayedTaxonomy = card.partOfSpeech
    ? taxonomyDetailLabel({ partOfSpeech: card.partOfSpeech, verbGroup: card.verbGroup })
    : learningGroupLabel(displayedGroup);

  function advanceRandomCard() {
    setLastRating(null);
    setIncomingDirection('left'); // user swiped LEFT → new card enters from RIGHT
    setCardIndex(index => getNextRandomFlashcardIndex(index, activeDeck!.cards.length));
  }

  function releaseScheduledRatingAdvance() {
    if (ratingAdvanceTimerRef.current) {
      clearTimeout(ratingAdvanceTimerRef.current);
      ratingAdvanceTimerRef.current = null;
    }
    reviewActionInFlight.current = false;
    setReviewActionBusy(false);
  }

  function showRandomCard() {
    // Ignore navigation while durable review writes are still pending. Once
    // the feedback timer exists, a manual swipe is allowed and cancels the
    // second automatic advance.
    if (reviewActionInFlight.current && !ratingAdvanceTimerRef.current) return;
    if (ratingAdvanceTimerRef.current) releaseScheduledRatingAdvance();
    advanceRandomCard();
  }

  function showPreviousCard() {
    if (reviewActionInFlight.current && !ratingAdvanceTimerRef.current) return;
    if (ratingAdvanceTimerRef.current) releaseScheduledRatingAdvance();
    setLastRating(null);
    setIncomingDirection('right'); // user swiped RIGHT → new card enters from LEFT
    setCardIndex(index => createFlashcardNavigator(activeDeck!, index).previous().currentIndex);
  }

  function finishRatedAction(pendingWrites: Promise<unknown>[]) {
    void Promise.all(pendingWrites).finally(() => {
      if (!screenMountedRef.current) {
        reviewActionInFlight.current = false;
        return;
      }
      // Keep the rated card on-screen briefly so the mascot feedback is
      // actually visible. The old path cleared it in the same event handler.
      ratingAdvanceTimerRef.current = setTimeout(() => {
        ratingAdvanceTimerRef.current = null;
        reviewActionInFlight.current = false;
        setReviewActionBusy(false);
        advanceRandomCard();
      }, 700);
    });
  }
  function practiceAloud() {
    markShadowingAttempt(card.japanese);
    speakJapanese(card.japanese, 0.72);
    void store?.recordMasteryEvidence({
      refId: card.id, modality: 'production', score: 0.55, source: 'shadowing',
    });
    setLastRating({ rating: 'good', cardId: card.id });
  }
  function listenToCard() {
    speakJapanese(card.japanese);
    void store?.recordMasteryEvidence({
      refId: card.id, modality: 'listening', score: 0.35, source: 'listening',
    });
  }
  function markGoodAndAdvance() {
        if (reviewActionInFlight.current) return;
        reviewActionInFlight.current = true;
        setReviewActionBusy(true);
        const pendingWrites: Promise<unknown>[] = [];
        // Phase 51 Task 5: route through srs.review(cardId, 'hard') instead of
        // the old `answerFlashcard` good path. Reasoning (per Beru Q3):
        // outside Daily Rush the user can't reliably tell "fast" from "slow",
        // so we collapse both to the recognized-stage mapping
        // (SM-2 q=3 → 'hard' on a fresh card). Daily Rush is the only
        // surface that derives the slow vs fast distinction from answer
        // latency; on the Flashcards tab we treat every positive tap as a
        // "saw it, kinda knew it" signal and let Daily Rush refine.
        setDeck(currentDeck => answerFlashcard(currentDeck!, card.id, 'good', localDateKey()));
        void store?.recordMasteryEvidence({
          refId: card.id, modality: 'recognition', score: 0.75, source: 'flashcards',
        });
        void store?.recordMasteryEvidence({
          refId: card.id, modality: 'reading', score: 0.7, source: 'flashcards',
        });
        if (srs) {
          let cardId = srsCardIdByRefId[card.id];
          if (!cardId) {
            const created = srs.createCard(card.id);
            cardId = created.id;
            setSrsCardIdByRefId(prev => ({ ...prev, [card.id]: cardId! }));
          }
          // A successful scheduled review must never demote a graduated card.
          // Fresh/seen cards advance to recognized; memorized stays memorized.
          const stageAfterReview = srs.getCard(cardId)?.stage === 'memorized'
            ? 'memorized'
            : 'recognized';
          const preReview = srs.getCard(cardId);
          pendingWrites.push(srs.review(cardId, 'hard').then(updated => srs.setStage(cardId!, stageAfterReview).then(staged => ({ updated, staged }))).then(({ staged }) => {
            replacePersistedSrsCard(staged);
            if (preReview) trackSrsReviewTelemetry(card.id, 'hard', preReview, staged);
            reviewCount.current += 1;
            efAverage.current.sum += staged.easeFactor;
            efAverage.current.n += 1;
            void srs.dueCount().then(setDueCount).catch(() => undefined);
          }).catch((err) => {
            if (__DEV__) console.warn('[FlashcardsScreen] markGoodAndAdvance srs.review failed', err);
          }));
        }
        // Phase 37d-2: also notify the practiceProgressStore so the flashcards
        // todo gate (UI wired in 37c) counts this review. Guarded behind
        // isTodoFeatureEnabled() so the default behavior is unchanged for
        // non-37g builds. Uses the LearningRepositoryProvider's store.
        if (isTodoFeatureEnabled() && store) {
                pendingWrites.push((async () => {
                  try {
                    let weekNumber = 1;
                    try {
                      const progress = await store.getProgress();
                      weekNumber = resolveActivePhraseWeek(progress, placementLevel);
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
                })());
        }
        setLastRating({ rating: 'hard', cardId: card.id });
        finishRatedAction(pendingWrites);
      }
    // Explicit lapse action. A visible button is more discoverable and does
    // not interfere with the card's tap-to-flip gesture.
    function markDidNotKnow() {
      if (!srs) return;
      if (reviewActionInFlight.current) return;
      reviewActionInFlight.current = true;
      setReviewActionBusy(true);
      setDeck(currentDeck => answerFlashcard(currentDeck!, card.id, 'again', localDateKey()));
      const pendingWrites: Promise<unknown>[] = [];
      let cardId = srsCardIdByRefId[card.id];
      if (!cardId) {
        const created = srs.createCard(card.id);
        cardId = created.id;
        setSrsCardIdByRefId(prev => ({ ...prev, [card.id]: cardId! }));
      }
      const stageBefore: 'seen' | 'recognized' | 'memorized' =
        (persistedSrsCards.find(c => c.id === cardId)?.stage ?? 'seen');
      const preReview = srs.getCard(cardId);
      pendingWrites.push(srs.review(cardId, 'again').then(updated => srs.setStage(cardId!, 'seen').then(staged => ({ updated, staged }))).then(({ staged }) => {
        replacePersistedSrsCard(staged);
        if (preReview) trackSrsReviewTelemetry(card.id, 'again', preReview, staged);
        lapseCount.current += 1;
        reviewCount.current += 1;
        efAverage.current.sum += staged.easeFactor;
        efAverage.current.n += 1;
        void srs.dueCount().then(setDueCount).catch(() => undefined);
        track('card_skipped', {
          card_id: card.id,
          stage_before: stageBefore,
          from_screen: 'flashcards',
        });
      }).catch((err) => {
        if (__DEV__) console.warn('[FlashcardsScreen] card_skipped srs.review failed', err);
      }));
      if (isTodoFeatureEnabled() && store) {
        pendingWrites.push((async () => {
          try {
            let weekNumber = 1;
            try {
              const progress = await store.getProgress();
              weekNumber = resolveActivePhraseWeek(progress, placementLevel);
            } catch {
              // Keep week 1 when progress cannot be read.
            }
            await store.recordFlashcardReview(weekNumber, card.id);
          } catch (err) {
            if (__DEV__) console.warn('[FlashcardsScreen] failed to record not-yet review', err);
          }
        })());
      }
      setLastRating({ rating: 'again', cardId: card.id });
      void store?.recordMasteryEvidence({
        refId: card.id, modality: 'recognition', score: 0, source: 'flashcards',
      });
      finishRatedAction(pendingWrites);
    }

  // NOTE: Phase 50's per-session summary useEffect was moved above the
  // early `return` paths in this function to satisfy the Rules of Hooks
  // (it was registered conditionally because the early returns fired
  // before this line on the first render). See the moved copy further up,
  // right after the deck-loading useEffect.

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
  const learningStatus = !srCard
    ? 'New card — flip it when you want it to appear in Daily Rush.'
    : srCard.stage === 'seen'
      ? 'Daily Rush will bring this card back for active recall.'
      : srCard.stage === 'recognized'
        ? 'You recognized this one. Daily Rush will check it again before it graduates.'
        : srCard.dueOn <= localDateKey()
          ? 'Due now — this review is scheduled to strengthen the memory.'
          : `Graduated — next scheduled review is ${srCard.dueOn}.`;

  return (
    <ScreenScaffold>
      <ScreenHeader title="Flashcards" subtitle={subtitle} />

      <View style={styles.modeSwitcher} accessibilityRole="tablist">
        <Chip label="Flashcards" selected={practiceMode === 'flashcards'} onPress={() => setPracticeMode('flashcards')} />
        <Chip label="Audio study loop" selected={practiceMode === 'audio'} onPress={() => setPracticeMode('audio')} />
      </View>

      {practiceMode === 'audio' ? (
        <AudioStudyPanel cards={activeDeck.cards} />
      ) : (
        <>
      <Text style={styles.modeDescription}>Review one card at a time, flip to reveal the meaning, and mark what you know.</Text>
      <Text style={styles.filterLabel}>Word type</Text>
      <View style={styles.filterRow}>
        <Chip label="All" selected={groupFilter === 'all'} onPress={() => setGroupFilter('all')} />
        {VOCABULARY_LEARNING_GROUPS.map(group => (
          <Chip key={group} label={learningGroupLabel(group)} selected={groupFilter === group} onPress={() => setGroupFilter(group)} />
        ))}
      </View>
      {topicFilter ? (
        <View style={styles.topicFocusRow} testID="flashcards-topic-focus">
          <Text style={styles.topicFocusText}>Topic focus: {masteryTopicLabel(topicFilter)}</Text>
          <Chip label="Clear topic" selected onPress={() => setTopicFilter(null)} />
        </View>
      ) : null}

      <View style={styles.cardWrap}>
                <FlipCard
                  key={card.id}
                  front={
                    <View style={styles.cardFace}>
                      <View style={styles.faceBadgeRow}>
                        {card.jlptLevel ? <Badge label={card.jlptLevel} tone="brand" /> : null}
                        <Badge label={displayedTaxonomy} tone="info" />
                      </View>
                      <Text style={styles.cardFront}>{card.japanese}</Text>
                      <Text style={styles.cardFrontReading}>{displayedReading}</Text>
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
                  // When the user flips the card to the back face:
                  //   1. Mark the card as stage='seen' so it enters
                  //      the Daily Rush seen-pool draw (Chris's spec:
                      //      "flip = I want to recall this in Daily Rush")
                  //   2. Start the 1.5s back-face dwell timer for the
                  //      card_flipped_back telemetry event
                  onFlipChange={(nowBack) => flipHandlerRegistry.current?.onFlipChange(nowBack)}
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
        <Button fullWidth={false} style={styles.actionButton} label="Listen" variant="soft" icon="play" accessibilityLabel={`Listen to ${card.japanese}`} onPress={listenToCard} />
        <Button fullWidth={false} style={styles.actionButton} label="Practice aloud" variant="soft" icon="chat" accessibilityLabel={`Practice saying ${displayedReading} aloud`} onPress={practiceAloud} />
        <Button fullWidth={false} style={styles.actionButton} label="Previous" variant="soft" iconRight="arrow-left" onPress={showPreviousCard} />
        <Button fullWidth={false} style={styles.actionButton} label="Not yet" variant="soft" onPress={markDidNotKnow} disabled={reviewActionBusy || !srs} />
        {/* Phase 51: rating is now derived from Daily Rush outcomes,
            not from in-tab button taps. The "Mark good" button is kept
            as a transitional affordance — it routes to srs.review(..., 'hard')
            which is the SM-2 q=3 mapping (recognized). True "memorized"
            requires a Daily Rush answer below the per-card-kind baseline.
            See SKILL jt-interactional-card-stages §State transitions. */}
        <Button fullWidth={false} style={styles.actionButton} label="Mark good" iconRight="check" onPress={markGoodAndAdvance} disabled={reviewActionBusy} />
      </View>

      {/* The focused actions above replace the old four-button rating panel. */}

      <Disclosure title="Card info" icon="info" open={showInfo} onToggle={() => setShowInfo(v => !v)}>
        <View style={styles.infoList}>
          {candidateCounts ? (
              <Text style={styles.infoLine}>Candidate pool: {candidateCounts.n5} N5 + {candidateCounts.n4} N4 + {candidateCounts.n3} N3 = {candidateCounts.total}</Text>
          ) : null}
          {srCard ? (
            <Text style={styles.infoLine}>Next review in {srCard.intervalDays} day{srCard.intervalDays === 1 ? '' : 's'}</Text>
          ) : (
            <Text style={styles.infoLine}>Review: not yet rated (will create SRS card on first rating)</Text>
          )}
          <Text style={styles.infoLine}>{learningStatus}</Text>
          <Text style={styles.infoLine}>Word type: {displayedTaxonomy}</Text>
          {card.transitivity ? <Text style={styles.infoLine}>Usage: {card.transitivity}</Text> : null}
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
        </>
      )}
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
  modeSwitcher: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs, padding: ds.spacing.xs, borderRadius: ds.radius.md, backgroundColor: ds.colors.surfaceAlt },
  modeDescription: { fontSize: ds.type.caption, color: ds.colors.textMuted, lineHeight: 18 },
  filterLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs },
  topicFocusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: ds.spacing.sm },
  topicFocusText: { flex: 1, minWidth: 160, fontSize: ds.type.caption, fontWeight: '800', color: ds.colors.text },
  cardWrap: { marginBottom: ds.spacing.md, minHeight: 240 },
  faceBadgeRow: { alignSelf: 'stretch', alignItems: 'flex-start', marginBottom: ds.spacing.sm },
  cardFace: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: ds.spacing.lg,
    gap: ds.spacing.sm,
    position: 'relative',
  },
  cardFront: { fontSize: 48, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  cardFrontReading: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.primary, textAlign: 'center' },
  cardFrontRomaji: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center' },
  cardBack: { fontSize: ds.type.heading, fontWeight: '800', color: ds.colors.primary, textAlign: 'center' },
  cardBackSecondary: { fontSize: ds.type.caption, color: ds.colors.textMuted, textAlign: 'center', marginTop: ds.spacing.xs },
  cardHint: { fontSize: ds.type.micro, color: ds.colors.textMuted, marginTop: ds.spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm, marginBottom: ds.spacing.sm },
  actionButton: { flex: 1, minWidth: 140, maxWidth: 360 },
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
