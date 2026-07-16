import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { FlipCard } from '../components/FlipCard';
import { Mascot } from '../components/Mascot';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ds } from '../theme/designSystem';
import { getAllCourseLessons } from '../services/lessonService';
import { lessonsForPlacementLevel } from '../services/placementPathService';
import { resolveActivePhraseWeek } from '../services/activeLessonWeekService';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { useLearningContext } from '../services/learningContext';
import { answerFlashcard, createFlashcardDeck } from '../services/flashcardService';
import { buildCandidateFlashcardCards } from '../services/candidateFlashcardAdapter';
import {
  answerDailyRushCard,
  buildDailyFlashcardRush,
  buildDailyRushProfilePatch,
  buildDailyRushRetryCard,
  buildSrsReviewTelemetry,
  getDailyRushRetryDecision,
  persistDailyRushCompletionWrites,
  summarizeDailyRush,
  timeOutDailyRushCard,
  type DailyRushAnswerResult,
  type DailyRushCard,
  type DailyRushRetryDecision,
} from '../services/dailyFlashcardRushService';
import { useUserProfileContext } from '../services/userProfileContext';
import { track } from '../services/analyticsService';
import { getRecallBaseline } from '../services/cardRecallBaseline';
import type { ReviewCard } from '../services/spacedRepetitionService';
import type { LearnerLanguage } from '../types/onboarding';
import type { FlashcardDeck, FlashcardReviewCard } from '../types/flashcard';
import { localDateKey } from '../services/dailyTodoService';
import { learningGroupLabel, taxonomyDetailLabel } from '../services/vocabularyTaxonomyService';

export const NEXT_CARD_DELAY_MS = 220;
export const DAILY_RUSH_TIMER_SECONDS = 10;

// Phase 51 Task 4 — Beru Q6 session caps. Defined as plain constants so
// they're greppable for tests / telemetry analysis without needing to
// import from the screen file.
export const DAILY_RUSH_SEEN_POOL_CAP = 20;
export const SESSION_CARD_MAX_APPEARANCES = 2;
export const SENTENCE_SOFT_CAP = 8;

type CompletionSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Phase 51 Task 4: Card-kind label used by Daily Rush. The deck's
 * `FlashcardReviewCard.kind` is optional and historically has only
 * been `'vocab' | 'kanji'`, but the seen-pool composition heuristic
 * (Beru Q6 Mod C) needs a third bucket for sentences — derived here
 * from the lessonId prefix as a best-effort signal until the deck
 * cards grow a first-class `kind: 'sentences'`.
 */
function cardKindForRush(card: FlashcardReviewCard): 'kanji' | 'vocab' | 'sentences' {
  if (card.kind === 'kanji') return 'kanji';
  // Treat example-sentence sources as the sentence bucket — these are
  // produced by exampleSentencesService and carry a recognisable
  // lessonId prefix. If a future adapter adds a `kind: 'sentences'`
  // flag, prefer that.
  if (card.lessonId === 'example-sentences' || card.lessonId.startsWith('example-')) return 'sentences';
  return 'vocab';
}

function todayIso(): string {
  return localDateKey();
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
export function DailyRushScreen({ supportLanguage = 'en', onBack }: { supportLanguage?: LearnerLanguage; onBack: () => void }) {
  const [date] = useState(todayIso());
  const [cardIndex, setCardIndex] = useState(0);
  const [answers, setAnswers] = useState<DailyRushAnswerResult[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(DAILY_RUSH_TIMER_SECONDS);
  const [incomingDirection, setIncomingDirection] = useState<'left' | null>(null);
  const [completionStatus, setCompletionStatus] = useState<CompletionSaveStatus>('idle');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [practiceOnlyRun, setPracticeOnlyRun] = useState(false);
  const [retryCards, setRetryCards] = useState<DailyRushCard[]>([]);
  // Keep the day's card set stable, but refresh distractors and answer order
  // every time the learner begins another run.
  const [choiceSeed, setChoiceSeed] = useState(() => String(Date.now()));
  const timerProgress = useRef(new Animated.Value(1)).current;
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedAnswerAppearanceIds = useRef(new Set<string>());
  const pendingTodoWrites = useRef(new Set<Promise<void>>());
  const completionSaveInFlight = useRef(false);
  const completionSaveAttempt = useRef(0);
  const { profile, updateProfile } = useUserProfileContext();
  // Phase 37d-1: consume the same practiceProgressStore that LessonsScreen
  // and the rest of the app use, via the LearningRepositoryProvider context.
  // Earlier 37d-1 draft opened a fresh SQLite handle here per rush completion,
  // which raced with the provider's open and double-initialized the schema —
  // replaced with the context's store accessor.
  const { store: practiceStore, srs } = useLearningContext();
  useEffect(() => () => {
    if (advanceTimerRef.current !== null) clearTimeout(advanceTimerRef.current);
  }, []);

  function trackTodoWrite(write: Promise<void>): void {
    pendingTodoWrites.current.add(write);
    void write.finally(() => pendingTodoWrites.current.delete(write));
  }
  const completedToday = profile?.dynamic.dailyRush.lastCompletedDate === date;
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);

  // Phase 51 Task 4 — SRS card state lookup. `persistedSrsCards` is a
  // snapshot of every ReviewCard row; the refId→stage map drives the
  // seen-pool filter and the pre-answer stage lookup that the
  // latency-derived outcome needs.
  const [persistedSrsCards, setPersistedSrsCards] = useState<ReviewCard[]>([]);
  useEffect(() => {
    if (!srs) return;
    let cancelled = false;
    (async () => {
      try {
        const cards = await srs.listCards();
        if (!cancelled) setPersistedSrsCards(cards);
      } catch {
        if (!cancelled) setPersistedSrsCards([]);
      }
    })();
    return () => { cancelled = true; };
  }, [srs]);

  // Phase 51 Task 4 — Per-question answer latency capture. Reset every
  // time the user advances to a new card. The `cardStartMs.current`
  // value is read inside `choose()` and the timeout useEffect.
  const cardStartMs = useRef<number>(Date.now());

  // Phase 51 Task 4 — Session appearance count per card id (refId).
  // Used to enforce SESSION_CARD_MAX_APPEARANCES and to emit
  // `card_session_capped` once a stubborn card hits the cap.
  const sessionAppearanceCounts = useRef<Map<string, number>>(new Map());
  // Track which card ids have already been session-capped so we don't
  // emit the `card_session_capped` event twice.
  const sessionCappedCardIds = useRef<Set<string>>(new Set());
  /**
   * First-answer tracker for the per-card stage transition rule
   * (Beru Q3 caveat: compute from the FIRST Daily Rush answer only).
   * Distinct from `recordedAnswerAppearanceIds` (which guards against
   * double-recording the same answer event).
   */
  const sessionAnsweredRefIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const baseDeck = createFlashcardDeck(lessonsForPlacementLevel(getAllCourseLessons(), profile?.dynamic.placement?.level));
      try {
        const candidateCards = await buildCandidateFlashcardCards(profile?.dynamic.placement?.level);
        if (!cancelled) setDeck({ ...baseDeck, cards: [...baseDeck.cards, ...candidateCards] });
      } catch {
        if (!cancelled) setDeck(baseDeck);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.dynamic.placement?.level]);

  // Build a refId → stage lookup so the seen-pool filter and the
  // pre-answer stage lookup are O(1). Default to 'seen' for cards that
  // don't yet have an SRS row (they were never reviewed in Daily Rush
  // or Flashcards — they're exactly the cohort Beru Q6 wants in the
  // rush).
  const srsStageByRefId = useMemo(() => {
    const map: Record<string, ReviewCard['stage']> = {};
    for (const row of persistedSrsCards) {
      map[row.refId] = row.stage;
    }
    return map;
  }, [persistedSrsCards]);

  const rush = useMemo(() => {
    if (!deck) return null;
    // A card stays in Daily Rush until it is memorized. Recognized cards need
    // another retrieval opportunity; otherwise they would be excluded from
    // both the new-card pool and the graduated SM-2 review queue.
    const eligibleCardIds = new Set(
      deck.cards
        .filter(card => (srsStageByRefId[card.id] ?? 'seen') !== 'memorized')
        .map(card => card.id),
    );
    return buildDailyFlashcardRush(deck, { date, supportLanguage, eligibleCardIds, choiceSeed });
  }, [choiceSeed, date, deck, srsStageByRefId, supportLanguage]);

  // Phase 51 Task 4 — Apply Beru Q6 caps + composition weighting to the
  // raw rush before any state machine starts running. We filter the
  // raw pool to cards that still need active recall, then sample proportionally to the
  // seen-pool card-kind breakdown with a hard pool cap and a soft
  // sentence cap. The derived cards array keeps the rush's id stable
  // so all the existing useEffect dependencies continue to fire.
  const effectiveRush = useMemo(() => {
    if (!rush) return null;
    const seenCards = rush.cards.filter(card => {
      const stage = srsStageByRefId[card.card.id] ?? 'seen';
      return stage !== 'memorized';
    });
    if (seenCards.length === 0) {
      return { ...rush, cards: [] };
    }

    // Composition weighting (Beru Q6 Mod C): tally the kind breakdown
    // of the seen pool, then pick a sample whose per-kind counts are
    // roughly proportional to those ratios — capped at
    // DAILY_RUSH_SEEN_POOL_CAP and SENTENCE_SOFT_CAP.
    const kindCounts: Record<'kanji' | 'vocab' | 'sentences', number> = { kanji: 0, vocab: 0, sentences: 0 };
    for (const card of seenCards) {
      const k = cardKindForRush(card.card);
      kindCounts[k] += 1;
    }
    const totalSeen = seenCards.length;
    const cap = Math.min(DAILY_RUSH_SEEN_POOL_CAP, totalSeen);

    // Target per-kind counts rounded to integers, with the sentence
    // bucket constrained by SENTENCE_SOFT_CAP.
    const targetKanji = Math.round((kindCounts.kanji / totalSeen) * cap);
    const targetSentences = Math.min(SENTENCE_SOFT_CAP, Math.round((kindCounts.sentences / totalSeen) * cap));
    const targetVocab = Math.max(0, cap - targetKanji - targetSentences);

    // Round / rebalance: if rounding leaves us short of `cap`, the
    // remaining slots go to vocab (largest bucket). If rounding puts
    // us over `cap`, trim from vocab first.
    const targets = { kanji: targetKanji, vocab: targetVocab, sentences: targetSentences };
    const overfill = (targets.kanji + targets.vocab + targets.sentences) - cap;
    if (overfill > 0) {
      targets.vocab = Math.max(0, targets.vocab - overfill);
    }
    const underfill = cap - (targets.kanji + targets.vocab + targets.sentences);
    if (underfill > 0) {
      targets.vocab += underfill;
    }

    // Walk the seen pool in order (already dueFirst sorted by the
    // builder) and pick until each bucket hits its target.
    const picked: typeof seenCards = [];
    const pickedCounts = { kanji: 0, vocab: 0, sentences: 0 };
    for (const card of seenCards) {
      if (picked.length >= cap) break;
      const k = cardKindForRush(card.card);
      if (pickedCounts[k] >= targets[k]) continue;
      picked.push(card);
      pickedCounts[k] += 1;
    }

    // Renumber positions so the UI's `position of total` chip stays
    // coherent after filtering.
    return {
      ...rush,
      cards: picked.map((card, index) => ({ ...card, position: index + 1 })),
    };
  }, [rush, srsStageByRefId]);

  const sessionCards = useMemo(
    () => [...(effectiveRush?.cards ?? []), ...retryCards],
    [effectiveRush?.cards, retryCards],
  );
  const current = sessionCards[cardIndex];
  const currentAnswer = answers.find(answer => answer.appearanceId === current?.id) ?? null;
  const summary = summarizeDailyRush(answers);
  const completionPersisted = completionStatus === 'saved';

  useEffect(() => {
    setCardIndex(0);
    setAnswers([]);
    setRetryCards([]);
    setSelectedChoiceId(null);
    setTimeLeft(DAILY_RUSH_TIMER_SECONDS);
    setCompletionStatus('idle');
    setCompletionError(null);
    completionSaveAttempt.current += 1;
    completionSaveInFlight.current = false;
    recordedAnswerAppearanceIds.current.clear();
    sessionAppearanceCounts.current.clear();
    sessionCappedCardIds.current.clear();
    sessionAnsweredRefIds.current.clear();
  }, [effectiveRush?.cards]);

  // Phase 51 Task 4 — Reset the answer-latency timer every time the
  // user advances to a new card. This runs BEFORE any early-return
  // path below, satisfying the Rules-of-Hooks constraint (Phase 50
  // lesson: all useEffect calls must sit above the early-return
  // gates).
  useEffect(() => {
    if (current?.id) {
      cardStartMs.current = Date.now();
    }
  }, [current?.id]);

  useEffect(() => {
    setTimeLeft(DAILY_RUSH_TIMER_SECONDS);
    timerProgress.setValue(1);
    setSelectedChoiceId(null);
  }, [current?.id, timerProgress]);

  useEffect(() => {
    timerProgress.stopAnimation();
    if (!effectiveRush || !current || currentAnswer || cardIndex >= sessionCards.length) {
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
  }, [cardIndex, current, currentAnswer, effectiveRush, sessionCards.length, timeLeft, timerProgress]);

  useEffect(() => {
    if (!effectiveRush || currentAnswer || cardIndex >= sessionCards.length || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(seconds => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cardIndex, currentAnswer, effectiveRush, sessionCards.length, timeLeft]);

  useEffect(() => {
    if (!effectiveRush || !current || currentAnswer || !deck || timeLeft > 0 || cardIndex >= sessionCards.length) return;
    if (recordedAnswerAppearanceIds.current.has(current.id)) return;
    const result = timeOutDailyRushCard(current);
    recordedAnswerAppearanceIds.current.add(current.id);
    setSelectedChoiceId('timeout');
    setAnswers(prev => [...prev, result]);
    answerFlashcard(deck, current.card.id, result.label, date);
    // Phase 51 Task 4 — also notify SRS of the outcome (timeout counts as
    // a wrong answer for stage purposes). Latency captured from
    // cardStartMs.current (set when this card was first shown).
    const retryDecision = handleAnswered(current, result);
    requeueMissedCard(current, retryDecision);
    // Phase 37d-2: also notify the practiceProgressStore so the flashcards
    // todo gate (UI wired in 37c) counts this review. Guarded behind
    // isTodoFeatureEnabled() so the default behavior is unchanged for
    // non-37g builds. Uses the LearningRepositoryProvider's store (opened
    // once at app boot) — do NOT open a fresh SQLite handle here.
    if (isTodoFeatureEnabled() && practiceStore) {
      trackTodoWrite((async () => {
        try {
          let weekNumber = 1;
          try {
            const progress = await practiceStore.getProgress();
            weekNumber = resolveActivePhraseWeek(progress, profile?.dynamic.placement?.level);
          } catch {
            // progress read failed — leave default weekNumber = 1
          }
          await practiceStore.recordFlashcardReview(weekNumber, current.card.id);
        } catch (err) {
          if (__DEV__) console.warn('[daily-rush] failed to record flashcard review', err);
        }
      })());
    }
    scheduleGoNext();
  }, [cardIndex, current, currentAnswer, date, deck, effectiveRush, sessionCards.length, timeLeft]);

  useEffect(() => {
    if (answers.length === 0) setPracticeOnlyRun(completedToday === true);
  }, [answers.length, completedToday]);

  useEffect(() => {
    if (
      !effectiveRush
      || effectiveRush.cards.length === 0
      || completionStatus !== 'idle'
      || completionSaveInFlight.current
      || !profile
      || cardIndex < sessionCards.length
    ) return;
    const finalSummary = summarizeDailyRush(answers);
    const profilePatch = buildDailyRushProfilePatch(profile, finalSummary, date);
    const attempt = completionSaveAttempt.current + 1;
    completionSaveAttempt.current = attempt;
    completionSaveInFlight.current = true;
    setCompletionError(null);
    setCompletionStatus('saving');

    void persistDailyRushCompletionWrites({
      persistTodo: isTodoFeatureEnabled()
        ? async () => {
          try {
            if (!practiceStore) throw new Error('Practice progress storage is unavailable.');
            let weekNumber = 1;
            try {
              const progress = await practiceStore.getProgress();
              weekNumber = resolveActivePhraseWeek(progress, profile.dynamic.placement?.level);
            } catch {
              // progress read failed — leave default weekNumber = 1
            }
            await Promise.allSettled(Array.from(pendingTodoWrites.current));
            await practiceStore.recordDailyRushComplete(weekNumber, date);
          } catch (err) {
            if (__DEV__) console.warn('[daily-rush] failed to record todo completion', err);
            throw err;
          }
        }
        : undefined,
      // Profile/XP is deliberately last. Once it succeeds there are no later
      // completion writes that can make the result card's XP claim untrue.
      persistProfile: async () => {
        try {
          await updateProfile(profilePatch);
        } catch (err) {
          if (__DEV__) console.warn('[daily-rush] failed to persist profile completion', err);
          throw err;
        }
      },
    }).then(
      () => {
        if (completionSaveAttempt.current !== attempt) return;
        completionSaveInFlight.current = false;
        setCompletionStatus('saved');
      },
      () => {
        if (completionSaveAttempt.current !== attempt) return;
        completionSaveInFlight.current = false;
        setCompletionError('Daily Rush could not be fully saved. Retry to preserve your XP and todo progress.');
        setCompletionStatus('error');
      },
    );
  }, [answers, cardIndex, completionStatus, date, effectiveRush, practiceStore, profile, sessionCards.length, updateProfile]);

  function goNext() {
    setIncomingDirection('left');
    setSelectedChoiceId(null);
    setTimeLeft(DAILY_RUSH_TIMER_SECONDS);
    setCardIndex(index => Math.min(index + 1, sessionCards.length));
  }

  function scheduleGoNext() {
    if (advanceTimerRef.current !== null) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      goNext();
    }, NEXT_CARD_DELAY_MS);
  }

  async function startAnotherRush() {
    if (srs) {
      try {
        await srs.flush();
        setPersistedSrsCards(await srs.listCards());
      } catch {
        // Keep the current stage snapshot; the next app open will hydrate it.
      }
    }
    setChoiceSeed(`${Date.now()}-${Math.random()}`);
    setAnswers([]);
    setRetryCards([]);
    recordedAnswerAppearanceIds.current.clear();
    sessionAppearanceCounts.current.clear();
    sessionCappedCardIds.current.clear();
    sessionAnsweredRefIds.current.clear();
    setCardIndex(0);
    setSelectedChoiceId(null);
    setTimeLeft(DAILY_RUSH_TIMER_SECONDS);
    setCompletionStatus('idle');
    setCompletionError(null);
    completionSaveAttempt.current += 1;
    completionSaveInFlight.current = false;
    setPracticeOnlyRun(completedToday === true);
  }

  function retryCompletionSave() {
    if (completionStatus !== 'error') return;
    setCompletionError(null);
    setCompletionStatus('idle');
  }

  /**
   * Phase 51 Task 4 — process a Daily Rush outcome (user-picked answer or
   * timeout). Computes answer latency, derives the new stage using
   * `getRecallBaseline`, routes through `srs.review()` with the canonical
   * rating, and emits the `card_stage_advanced` / `card_skipped` telemetry
   * event. Also enforces SESSION_CARD_MAX_APPEARANCES: after the 2nd miss
   * for the same card the session-capped event fires and the card is
   * marked stage='seen' for the rest of the session.
   *
   * Beru Q3 caveats baked in:
   *   - ≤ for the memorized check.
   *   - only the FIRST Daily Rush answer for a given card id drives the
   *     stage transition; subsequent re-appearances still call srs.review
   *     (so SM-2 keeps advancing the schedule) but do NOT re-emit a stage
   *     transition event.
   */
  function handleAnswered(card: DailyRushCard, result: DailyRushAnswerResult): DailyRushRetryDecision {
    const cardRefId = card.card.id;
    const cardKind = cardKindForRush(card.card);
    const baselineMs = getRecallBaseline(cardKind);
    const answerMs = Math.max(0, Date.now() - cardStartMs.current);
    const previousStage: ReviewCard['stage'] = srsStageByRefId[cardRefId] ?? 'seen';
    const isFirstAnswerForCard = !sessionAnsweredRefIds.current.has(cardRefId);
    void practiceStore?.recordMasteryEvidence({
      refId: cardRefId,
      modality: 'recognition',
      score: result.correct ? 1 : 0,
      source: 'daily-rush',
    });

    // Every miss gets one later retrieval opportunity until the configured
    // appearance cap. The final allowed miss emits the cap event and defers
    // the card; there is no unreachable third appearance.
    const previousCount = sessionAppearanceCounts.current.get(cardRefId) ?? 0;
    const retryDecision = getDailyRushRetryDecision(
      result.correct,
      previousCount,
      SESSION_CARD_MAX_APPEARANCES,
    );
    sessionAppearanceCounts.current.set(cardRefId, retryDecision.appearanceCount);
    if (retryDecision.capped && !sessionCappedCardIds.current.has(cardRefId)) {
      sessionCappedCardIds.current.add(cardRefId);
      track('card_session_capped', {
        card_id: cardRefId,
        attempts_in_session: retryDecision.appearanceCount,
        defer_to_next_session: true,
      });
    }

    // Derive the new stage + the SM-2 rating to feed into srs.review().
    //   correct + answer_ms <= baseline   → memorized (q=5 / easy)
    //   correct + answer_ms  > baseline   → recognized (q=3 / hard)
    //   wrong                             → stage reverts to 'seen' (q=2 / again)
    let nextStage: ReviewCard['stage'];
    let rating: 'easy' | 'hard' | 'again';
    if (!result.correct) {
      nextStage = 'seen';
      rating = 'again';
    } else if (answerMs <= baselineMs) {
      nextStage = 'memorized';
      rating = 'easy';
    } else {
      nextStage = 'recognized';
      rating = 'hard';
    }

    // Feed the rating through the canonical SM-2 path so persistence
    // stays in sync. We resolve (or create) the SRS row up front so
    // the in-memory mirror stays aligned with the screen state.
    void (async () => {
      if (!srs) return;
      try {
        let srsCard = persistedSrsCards.find(row => row.refId === cardRefId);
        if (!srsCard) {
          srsCard = srs.createCard(cardRefId);
        }
        const beforeReview = srs.getCard(srsCard.id) ?? srsCard;
        const afterReview = await srs.review(srsCard.id, rating);
        track('srs_review', buildSrsReviewTelemetry(cardRefId, rating, beforeReview, afterReview));
        await srs.setStage(srsCard.id, nextStage);
      } catch (err) {
        if (__DEV__) console.warn('[daily-rush] srs.review failed', err);
      }
    })();

    // Telemetry: emit card_stage_advanced when the stage actually moves.
    // Per Beru Q3 caveat, only the FIRST Daily Rush answer for a given
    // card id drives the transition. Re-appearances in the same session
    // still call srs.review above (so SM-2 keeps working) but do not
    // re-emit the stage event.
    if (isFirstAnswerForCard && nextStage !== previousStage) {
      track('card_stage_advanced', {
        card_id: cardRefId,
        from_stage: previousStage,
        to_stage: nextStage,
        answer_ms: answerMs,
        baseline_ms: baselineMs,
      });
      if (nextStage !== 'seen' && isTodoFeatureEnabled() && practiceStore) {
        void (async () => {
          try {
            let weekNumber = 1;
            try {
              weekNumber = resolveActivePhraseWeek(
                await practiceStore.getProgress(),
                profile?.dynamic.placement?.level,
              );
            } catch {
              // progress read failed — leave default weekNumber = 1
            }
            await practiceStore.recordCardStageAdvanced(weekNumber, cardRefId, nextStage);
          } catch (err) {
            if (__DEV__) console.warn('[daily-rush] failed to record stage advancement', err);
          }
        })();
      }
    }
    // On a wrong answer the screen layer emits card_skipped separately,
    // per the SKILL §Telemetry additions spec.
    if (!result.correct) {
      track('card_skipped', {
        card_id: cardRefId,
        stage_before: previousStage,
        from_screen: 'daily_rush',
      });
    }

    sessionAnsweredRefIds.current.add(cardRefId);
    return retryDecision;
  }

  function requeueMissedCard(card: DailyRushCard, decision: DailyRushRetryDecision) {
    if (!decision.requeue) return;
    setRetryCards(currentRetries => [
      ...currentRetries,
      buildDailyRushRetryCard(
        card,
        (effectiveRush?.cards.length ?? 0) + currentRetries.length + 1,
        decision.appearanceCount + 1,
      ),
    ]);
  }

  function choose(choiceId: string) {
    if (!current || !deck || currentAnswer) return;
    if (recordedAnswerAppearanceIds.current.has(current.id)) return;
    const result = answerDailyRushCard(current, choiceId);
    recordedAnswerAppearanceIds.current.add(current.id);
    setSelectedChoiceId(choiceId);
    setAnswers(prev => [...prev, result]);
    answerFlashcard(deck, current.card.id, result.label, date);
    // Phase 51 Task 4 — route the outcome through SRS + telemetry.
    const retryDecision = handleAnswered(current, result);
    requeueMissedCard(current, retryDecision);
    // Phase 37d-2: also notify the practiceProgressStore so the flashcards
    // todo gate counts this review. Guarded behind isTodoFeatureEnabled() so
    // the default behavior is unchanged for non-37g builds.
    if (isTodoFeatureEnabled() && practiceStore) {
      trackTodoWrite((async () => {
        try {
          let weekNumber = 1;
          try {
            const progress = await practiceStore.getProgress();
            weekNumber = resolveActivePhraseWeek(progress, profile?.dynamic.placement?.level);
          } catch {
            // progress read failed — leave default weekNumber = 1
          }
          await practiceStore.recordFlashcardReview(weekNumber, current.card.id);
        } catch (err) {
          if (__DEV__) console.warn('[daily-rush] failed to record flashcard review', err);
        }
      })());
    }
    scheduleGoNext();
  }

  if (!rush) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Daily Flashcard Rush" subtitle="Loading full flashcard pool..." onBack={onBack} />
      </ScreenScaffold>
    );
  }

  if (effectiveRush && effectiveRush.cards.length === 0) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Daily Flashcard Rush" subtitle="No active-recall cards due" onBack={onBack} />
        <Card tone="brand" shadow="hero" style={styles.resultHero}>
          <Mascot expression="celebrate" size={72} />
          <Text style={styles.resultTitle}>All caught up</Text>
          <Text style={styles.resultStatus}>Every current card is memorized. Scheduled reviews will appear in Flashcards when they are due.</Text>
        </Card>
        <Button label="Back" onPress={onBack} variant="soft" icon="arrow-left" />
      </ScreenScaffold>
    );
  }

  if (!current || cardIndex >= sessionCards.length) {
    const finalSummary = summarizeDailyRush(answers);
    const xpStatus = practiceOnlyRun
      ? '+0 XP'
      : completionPersisted
        ? `+${finalSummary.xpEarned} XP`
        : completionStatus === 'error'
          ? 'XP not saved'
          : 'XP pending save';
    const completionMessage = completionPersisted
      ? (practiceOnlyRun
        ? 'Completed today — extra runs are practice only.'
        : 'Daily Rush saved to your daily and weekly todos.')
      : completionStatus === 'error'
        ? completionError
        : 'Saving Daily Rush and todo progress...';
    return (
      <ScreenScaffold>
        <ScreenHeader title="Daily Flashcard Rush" subtitle={`${finalSummary.total}-card daily sprint complete`} onBack={onBack} />
        <Card tone="brand" shadow="hero" style={styles.resultHero}>
          <Mascot expression={finalSummary.good >= 7 ? 'celebrate' : 'happy'} size={72} />
          <Text style={styles.resultTitle}>{finalSummary.accuracyPercent}% correct</Text>
          <Text style={styles.resultText}>{finalSummary.good} Good • {finalSummary.again} Again • {xpStatus}</Text>
          <Text style={styles.resultStatus}>{completionMessage}</Text>
        </Card>
        {completionStatus === 'error' ? (
          <Button label="Retry save" onPress={retryCompletionSave} icon="refresh" testID="daily-rush-retry-save" />
        ) : null}
        <Button label="Do another rush" onPress={() => { void startAnotherRush(); }} iconRight="arrow-right" disabled={!completionPersisted} />
        <Button label="Back" onPress={onBack} variant="soft" icon="arrow-left" disabled={completionStatus === 'saving'} />
      </ScreenScaffold>
    );
  }

  const correctChoice = current.choices.find(choice => choice.correct);
  const timerFillWidth = timerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const timerFillColor = timeLeft <= 3 ? ds.colors.danger : timeLeft <= 5 ? ds.colors.warning : ds.colors.success;
  const rushCardCount = sessionCards.length;

  return (
    <ScreenScaffold>
      <ScreenHeader title="Daily Flashcard Rush" subtitle={completedToday ? `${answers.length}/${rushCardCount} answered • 10s per card • Completed today` : `${answers.length}/${rushCardCount} answered • 10s per card • +${summary.xpEarned} XP`} onBack={onBack} />
      <View style={styles.progressRow}>
        <Chip label={`${current.position} of ${rushCardCount}`} selected />
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
            <View style={styles.levelBadgeRow}>
              {current.card.jlptLevel ? <Badge label={current.card.jlptLevel} tone="brand" /> : null}
              <Badge
                label={current.card.partOfSpeech
                  ? taxonomyDetailLabel({ partOfSpeech: current.card.partOfSpeech, verbGroup: current.card.verbGroup })
                  : learningGroupLabel(current.card.learningGroup ?? 'expression')}
                tone="info"
              />
            </View>
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
        totalCards={rushCardCount}
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
  levelBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ds.spacing.xs },
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
