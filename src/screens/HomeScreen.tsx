import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Disclosure } from '../components/Disclosure';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { HeroLogo } from '../components/HeroLogo';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { KoiPet } from '../features/koi-sensei/ui/KoiPet';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { StreakFlame } from '../components/StreakFlame';
import { WeeklyTodoBoardView } from '../components/WeeklyTodoBoardView';
import { DailyTodoBoardView } from '../components/DailyTodoBoardView';
import { AdaptiveDailyPlanCard } from '../components/AdaptiveDailyPlanCard';
import {
  getAllCourseLessons,
  getDailyLesson,
  getGrammarLessons,
  getPhraseLessons,
} from '../services/lessonService';
import { buildLessonProgression } from '../services/lessonProgressionService';
import { buildLessonInteractionPath } from '../services/lessonInteractionPathService';
import { lessonsForPlacementLevel } from '../services/placementPathService';
import { getSupportLanguageDisplayName, getSupportTranslation } from '../services/supportLanguageService';
import { useLearningContext } from '../services/learningContext';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { getAllWeekPlans } from '../services/weeklyPlansService';
import {
  buildAllTodoBoards,
  type TodoPayload,
} from '../services/weeklyTodoService';
import { emptyTodoEventCounts } from '../types/weeklyTodo';
import { buildAdaptiveDailyPlan, type AdaptiveDailyPlanTask } from '../services/adaptiveDailyPlanService';
import { track } from '../services/analyticsService';
import { buildCandidateFlashcardCards } from '../services/candidateFlashcardAdapter';
import { createFlashcardDeck } from '../services/flashcardService';
import { useUserProfileContext } from '../services/userProfileContext';
import type { FlashcardReviewCard } from '../types/flashcard';
import type { ReviewCard } from '../services/spacedRepetitionService';
import type { VocabularyLearningGroup } from '../services/vocabularyTaxonomyService';
import { buildMasteryMap } from '../services/masteryService';
import { buildDailyTodoBoard, COURSE_COMPLETE_DAILY_TODO_DEFINITIONS } from '../services/dailyTodoService';
import { useTodayDateKey } from '../hooks/useTodayDateKey';
import type { LearnerLanguage } from '../types/onboarding';
import type { LearnerProgress } from '../types/progress';
import { ds } from '../theme/designSystem';

export function HomeScreen({
  supportLanguage = 'en',
  onStartLesson,
  onReviewDue,
  onPracticeWeak,
  onOpenDailyRush,
  onOpenFlashcards,
  onOpenSentenceLab,
  onOpenQuiz,
  onOpenLesson,
  onOpenKanji,
  onOpenExampleSentences,
  onPracticeWordGroup,
  onOpenPlacement,
  onOpenKoiSensei,
}: {
  supportLanguage?: LearnerLanguage;
  onStartLesson?: () => void;
  onReviewDue?: () => void;
  onPracticeWeak?: () => void;
  onOpenDailyRush?: () => void;
  onOpenFlashcards?: () => void;
  onOpenSentenceLab?: () => void;
  onOpenQuiz?: () => void;
  onOpenLesson?: (lessonId?: string) => void;
  onOpenKanji?: () => void;
  onOpenExampleSentences?: () => void;
  onPracticeWordGroup?: (group: VocabularyLearningGroup) => void;
  onOpenPlacement?: () => void;
  onOpenKoiSensei?: () => void;
}) {
  // Phase 30: read progress so the daily lesson copy reflects the
  // learner's actual completion state instead of always defaulting to
  // Week 1 Day 1.
  const { ready, store, srs } = useLearningContext();
  const { profile, updateProfile } = useUserProfileContext();
  const subscribeExtended = useCallback(
    (listener: () => void) => store?.subscribeExtendedProgress?.(listener) ?? (() => undefined),
    [store],
  );
  const getExtendedRevision = useCallback(
    () => store?.getExtendedProgressRevision?.() ?? 0,
    [store],
  );
  const extendedRevision = useSyncExternalStore(subscribeExtended, getExtendedRevision, () => 0);
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [extendedProgress, setExtendedProgress] = useState(() => ({
    todoStates: {},
    weekTodosInitialized: {},
    todoEventCounts: emptyTodoEventCounts(),
  }));
  useEffect(() => {
    if (!ready || !store) return;
    let cancelled = false;
    store.ready()
      .then(async () => ({ progress: await store.getProgress(), extended: store.getExtendedProgress() }))
      .then(({ progress: nextProgress, extended }) => {
        if (!cancelled) {
          setProgress(nextProgress);
          setExtendedProgress(extended);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [ready, store]);
  const placementLevel = profile?.dynamic.placement?.level;
  const lesson = getDailyLesson(progress ?? undefined, placementLevel);
  const phrase = lesson.lesson.items[0];
  const primaryTranslation = getSupportTranslation(phrase, supportLanguage);
  const lessons = useMemo(
    () => lessonsForPlacementLevel(getPhraseLessons(), placementLevel),
    [placementLevel],
  );
  const totalLessons = lessons.length;
  const completedLessons = lessons.filter(item => progress?.completedLessonIds.includes(item.id)).length;
  const grammarLessons = getGrammarLessons();
  const completedGrammarLessons = grammarLessons.filter(lesson => progress?.completedLessonIds.includes(lesson.id)).length;
    const [showHelp, setShowHelp] = useState(false);
    // P0-02 + P0-03 fix: StreakFlame now reads from the persistent store, not a hardcoded 3.
    const [streak, setStreak] = useState<number>(0);
    const [dueCount, setDueCount] = useState<number>(0);
    const [srsRows, setSrsRows] = useState<ReviewCard[]>([]);
    const [taxonomyCards, setTaxonomyCards] = useState<FlashcardReviewCard[]>(() => createFlashcardDeck(getAllCourseLessons()).cards);
    useEffect(() => {
      if (!ready || !store) return;
      let cancelled = false;
      Promise.all([
        store.getDashboard().then(d => d.currentStreak),
        srs ? srs.dueCount() : Promise.resolve(0),
        srs ? srs.listCards() : Promise.resolve([]),
        buildCandidateFlashcardCards(placementLevel).catch(() => []),
      ])
        .then(([s, d, cards, candidates]) => {
          if (!cancelled) {
            setStreak(s);
            setDueCount(d);
            setSrsRows(cards);
            setTaxonomyCards([...createFlashcardDeck(lessonsForPlacementLevel(getAllCourseLessons(), placementLevel)).cards, ...candidates]);
          }
        })
        .catch(() => { if (!cancelled) { setStreak(0); setDueCount(0); setSrsRows([]); } });
      return () => { cancelled = true; };
    }, [ready, store, srs, placementLevel]);
  const nextActionLabel = dueCount > 0
    ? `Review ${dueCount} due card${dueCount === 1 ? '' : 's'}`
    : completedLessons === 0
      ? "Start your first lesson"
      : "Continue today's lesson";
  const nextActionDetail = dueCount > 0
    ? 'Clear due review first, then do your lesson or Daily Rush.'
    : 'Finish one lesson, then use Daily Rush for quick recall.';

  // Phase 37e: build the per-week todo board for the current week, mirroring
  // the 37c LessonsScreen pattern. Gated behind `isTodoFeatureEnabled()` so
  // the flag-off default learner experience (replaced "Today's focus" Card)
  // is unchanged. When 37g flips the flag this new feed renders in place of
  // the legacy "Today's focus" Card. Proposal §8 phase-37e.
  const emptyProgress: LearnerProgress = {
    startedAt: '',
    completedLessonIds: [],
    quizScores: [],
    streak: { currentStreak: 0, longestStreak: 0 },
  };
  const homeProgress = progress ?? emptyProgress;
  const lessonPath = useMemo(
    () => buildLessonInteractionPath(lessons, homeProgress, placementLevel),
    [lessons, homeProgress, placementLevel],
  );
  const progression = buildLessonProgression(lessonPath.currentWeek.week);
  const currentWeekIndex = progression.currentWeekDetails().weekNumber;
  const todoPayload = useMemo<TodoPayload>(() => {
    const liveExtended = store?.getExtendedProgress() ?? extendedProgress;
    return {
      todoStates: liveExtended.todoStates,
      weekTodosInitialized: liveExtended.weekTodosInitialized,
      todoEventCounts: liveExtended.todoEventCounts,
      completedLessonIds: homeProgress.completedLessonIds,
    };
  }, [extendedProgress, extendedRevision, homeProgress.completedLessonIds, store]);
  const todoBoards = useMemo(
    () => buildAllTodoBoards(getAllWeekPlans(), todoPayload, 'all', currentWeekIndex),
    [todoPayload, currentWeekIndex],
  );
  const homeTodoBoard = todoBoards[currentWeekIndex];
  const todayDate = useTodayDateKey();
  const dailyTodoBoard = useMemo(
    () => buildDailyTodoBoard(
      todayDate,
      todoPayload.todoEventCounts.dailyActivity?.[todayDate],
      lesson.isCourseComplete ? COURSE_COMPLETE_DAILY_TODO_DEFINITIONS : undefined,
    ),
    [lesson.isCourseComplete, todayDate, todoPayload.todoEventCounts.dailyActivity],
  );
  const masteryMap = useMemo(() => buildMasteryMap({
    flashcards: taxonomyCards,
    srsCards: srsRows,
    evidence: todoPayload.todoEventCounts.masteryEvidence ?? [],
    snapshots: todoPayload.todoEventCounts.masterySnapshots ?? [],
  }), [srsRows, taxonomyCards, todoPayload.todoEventCounts.masteryEvidence, todoPayload.todoEventCounts.masterySnapshots]);
  const adaptivePlan = useMemo(() => buildAdaptiveDailyPlan({
    date: todayDate,
    budgetMinutes: profile?.static.dailyStudyMinutes ?? 10,
    srsCards: srsRows,
    flashcards: taxonomyCards,
    dailyActivity: todoPayload.todoEventCounts.dailyActivity?.[todayDate],
    lessonTitle: lesson.lesson.title,
    courseComplete: lesson.isCourseComplete,
    masteryMap,
  }), [lesson.isCourseComplete, lesson.lesson.title, masteryMap, profile?.static.dailyStudyMinutes, srsRows, taxonomyCards, todayDate, todoPayload.todoEventCounts.dailyActivity]);
  const homeTodosEnabled = isTodoFeatureEnabled();
  const homeIncompleteTodos = homeTodoBoard
    ? homeTodoBoard.todos.filter(status => !status.completed)
    : [];
  // Map a ctaRoute to a Home-action. HomeScreen only owns onStartLesson and
  // onOpenDailyRush (wired via App.tsx); other destinations fall back to
  // opening today's lesson. Mirrors the spec: "Today's active todos … with
  // per-todo CTA that deep-links to the relevant screen via ctaRoute".
  function handleHomeTodoCta(ctaRoute: import('../services/weeklyTodoService').TodoCtaRoute): void {
    switch (ctaRoute.screen) {
      case 'daily-rush':
        onOpenDailyRush?.();
        return;
      case 'lesson':
        onOpenLesson?.(ctaRoute.params?.lessonId);
        return;
      case 'lessons':
        onStartLesson?.();
        return;
      case 'flashcards':
        onOpenFlashcards?.();
        return;
      case 'quiz':
        onOpenQuiz?.();
        return;
      case 'kanji':
        onOpenKanji?.();
        return;
      case 'example-sentences':
        onOpenExampleSentences?.();
        return;
      default:
        onStartLesson?.();
        return;
    }
  }

  function handleDailyTodoCta(kind: import('../services/dailyTodoService').DailyTodoKind): void {
    if (kind === 'daily-rush') {
      onOpenDailyRush?.();
    } else if (kind === 'flashcards') {
      onOpenFlashcards?.();
    } else if (kind === 'quiz') {
      onOpenQuiz?.();
    } else {
      onStartLesson?.();
    }
  }

  function handleAdaptiveTask(task: AdaptiveDailyPlanTask): void {
    track('adaptive_plan_task_opened', {
      route: task.route,
      minutes: task.minutes,
      target: task.target,
      learning_group: task.learningGroup,
    });
    switch (task.route) {
      case 'flashcards-due':
        onReviewDue?.();
        return;
      case 'flashcards-weak':
        if (task.learningGroup && onPracticeWordGroup) onPracticeWordGroup(task.learningGroup);
        else onPracticeWeak?.();
        return;
      case 'sentence-lab':
        onOpenSentenceLab?.();
        return;
      case 'lesson':
        onStartLesson?.();
        return;
      case 'daily-rush':
        onOpenDailyRush?.();
        return;
      case 'quiz':
        onOpenQuiz?.();
        return;
      case 'new-vocabulary':
      default:
        onOpenFlashcards?.();
    }
  }

  return (
      <ScreenScaffold>
        <HeroLogo size={120} subtitle="まいにち、にほんごをべんきょうしよう" tone="muted" />

        <View style={styles.greetingRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Koi Sensei, your Japanese training companion"
            disabled={!onOpenKoiSensei}
            onPress={onOpenKoiSensei}
            style={({ pressed }) => [styles.mascotButton, pressed && styles.mascotButtonPressed]}
            testID="home-koi-mascot"
          >
            <KoiPet expression="base" size={64} />
          </Pressable>
          <View style={styles.greetingText}>
            <ScreenHeader
              title="Home"
              subtitle={`${getSupportLanguageDisplayName(supportLanguage)} • ${lesson.lesson.title}`}
            />
          </View>
        </View>

      {onOpenKoiSensei ? (
        <Card shadow="hero" tone="brand" style={styles.koiCard}>
          <View style={styles.koiHeader}>
            <KoiPet expression="happy" size={58} />
            <View style={styles.koiCopy}>
              <Text style={styles.koiLabel}>NEW IN VERSION 2.0</Text>
              <Text style={styles.koiTitle}>Meet Koi Sensei</Text>
              <Text style={styles.koiHint}>Ask Japanese questions and grow your N5–N1 training companion.</Text>
            </View>
          </View>
          <Button
            label="Open Koi Sensei"
            icon="chat"
            onPress={onOpenKoiSensei}
            variant="secondary"
            testID="home-open-koi-sensei"
          />
        </Card>
      ) : null}

      <StreakFlame days={streak} />
      <AdaptiveDailyPlanCard plan={adaptivePlan} onTaskPress={handleAdaptiveTask} />
      <Card shadow="card" style={styles.todayTodosCard}>
        <View style={styles.todayTodosHeader}>
          <View style={styles.todayTodosCopy}>
            <Text style={styles.todayTodosLabel}>Grammar rules</Text>
            <Text style={styles.todayTodosTitle}>{completedGrammarLessons} / {grammarLessons.length} complete</Text>
            <Text style={styles.todayTodosDetail}>Grammar and conjugation progress is tracked separately from phrase lessons.</Text>
          </View>
        </View>
      </Card>
      {/* Phase 37e: when `isTodoFeatureEnabled()` is true (gated to 37g
          rollout) the home screen replaces its existing "Today's focus"
          Card with a "Today's todos" feed drawn from
          buildAllTodoBoards[currentWeek]. In flag-off default mode the
          legacy "Today's focus" Card still renders so the existing
          learner-visible behavior is preserved. Proposal §8 phase-37e +
          §11.2. */}
      {homeTodosEnabled ? (
        <>
        <DailyTodoBoardView board={dailyTodoBoard} onTodoPress={handleDailyTodoCta} />
        <Card shadow="card" style={styles.todayTodosCard}>
          <View style={styles.todayTodosHeader}>
            <View style={styles.todayTodosIcon}>
              <Icon name="learn" size={18} />
            </View>
            <View style={styles.todayTodosCopy}>
              <Text style={styles.todayTodosLabel}>Today's todos</Text>
              <Text style={styles.todayTodosTitle}>Week {currentWeekIndex} — keep going</Text>
              <Text style={styles.todayTodosDetail}>
                {homeIncompleteTodos.length === 0
                  ? 'Nothing left for this week — you can advance.'
                  : `${homeIncompleteTodos.length} todo${homeIncompleteTodos.length === 1 ? '' : 's'} left to finish this week.`}
              </Text>
            </View>
          </View>
          {homeTodoBoard ? (
            <WeeklyTodoBoardView
              board={homeTodoBoard}
              onTodoPress={handleHomeTodoCta}
            />
          ) : (
            <Text style={styles.todayTodosEmpty}>No board built for Week {currentWeekIndex} yet.</Text>
          )}
        </Card>
        </>
      ) : (
        <Card shadow="card" style={styles.todayFocusCard}>
          <View style={styles.todayFocusHeader}>
            <View style={styles.todayFocusIcon}>
              <Icon name="learn" size={18} />
            </View>
            <View style={styles.todayFocusCopy}>
              <Text style={styles.todayFocusLabel}>Today's focus</Text>
              <Text style={styles.todayFocusTitle}>{nextActionLabel}</Text>
              <Text style={styles.todayFocusDetail}>{nextActionDetail}</Text>
            </View>
          </View>
          <View style={styles.todayStatsRow}>
            <Text style={styles.todayStat}>{completedLessons}/{totalLessons} lessons</Text>
            <Text style={styles.todayStat}>30 min plan</Text>
            <Text style={styles.todayStat}>10-card Rush</Text>
          </View>
        </Card>
      )}
      {streak >= 3 ? (
        <View style={styles.streakCelebrate}>
          <Mascot expression="happy" size={56} />
          <Text style={styles.streakCelebrateText}>{streak} days in a row — keep it up!</Text>
        </View>
      ) : null}
      {dueCount > 0 ? (
        <Card shadow="card" style={styles.reviewCard}>
          <Text style={styles.reviewHeadline}>{dueCount} card{dueCount === 1 ? '' : 's'} due for review</Text>
          <Text style={styles.reviewHint}>Tap below to start your review session now.</Text>
          {onReviewDue ? (
            <Button
              label={`Review ${dueCount} due card${dueCount === 1 ? '' : 's'} now`}
              onPress={onReviewDue}
              iconRight="arrow-right"
              variant="primary"
              testID="home-review-due-cta"
              style={styles.reviewCta}
            />
          ) : null}
        </Card>
      ) : null}


      <Card shadow="card" style={styles.dailyRushCard}>
        <View style={styles.dailyRushHeader}>
          <Mascot expression="celebrate" size={52} />
          <View style={styles.dailyRushCopy}>
            <Text style={styles.dailyRushTitle}>Daily Flashcard Rush</Text>
            <Text style={styles.dailyRushHint}>10 quick cards • 4 choices • Good/Again review labels.</Text>
          </View>
        </View>
        {onOpenDailyRush ? (
          <Button
            label="Start Daily Rush"
            onPress={onOpenDailyRush}
            iconRight="arrow-right"
            testID="home-daily-rush-cta"
            style={styles.dailyRushCta}
          />
        ) : null}
      </Card>

      <Card shadow="card" style={styles.sentenceLabCard}>
        <View style={styles.dailyRushHeader}>
          <Icon name="play" size={28} />
          <View style={styles.dailyRushCopy}>
            <Text style={styles.dailyRushTitle}>Listening & Sentence Lab</Text>
            <Text style={styles.dailyRushHint}>Hear real sentences, rebuild them, and revisit mistakes with spaced review.</Text>
          </View>
        </View>
        {onOpenSentenceLab ? (
          <Button
            label="Start Sentence Lab"
            onPress={onOpenSentenceLab}
            iconRight="arrow-right"
            variant="secondary"
            testID="home-sentence-lab-cta"
            style={styles.dailyRushCta}
          />
        ) : null}
      </Card>

      <Card tone="brand" shadow="hero" style={styles.lessonHero}>
        <View style={styles.lessonLabelRow}>
          <Text style={styles.lessonLabel}>Today's lesson</Text>
          <View style={styles.lessonBadge}>
            <Text style={styles.lessonBadgeText}>{lesson.lesson.level} • Week {lesson.lesson.week} • {lesson.lessonsDoneThisWeek}/{lesson.lessonsTotalThisWeek} done</Text>
          </View>
        </View>
        <Text style={styles.lessonTitle}>{phrase.japanese}</Text>
        <Text style={styles.lessonRomaji}>{phrase.romaji}</Text>
        <View style={styles.lessonDivider} />
        <Text style={styles.lessonTranslation}>
          {primaryTranslation.label}: {primaryTranslation.text}
        </Text>
      </Card>

      <Button
        label="Start today's lesson"
        onPress={() => { if (onStartLesson) onStartLesson(); }}
        iconRight="arrow-right"
        testID="home-start-button"
      />

      {!profile?.dynamic.placement && !profile?.dynamic.placementPromptDismissed && onOpenPlacement ? (
        <Card tone="warm" shadow="card">
          <Text style={styles.todayFocusLabel}>Find your starting level</Text>
          <Text style={styles.todayFocusDetail}>Take a short Japanese check so your lessons start at the right level.</Text>
          <Button label="Evaluate my level" onPress={onOpenPlacement} icon="star" />
          <Button
            label="Skip for now"
            onPress={() => {
              track('placement_skipped', { source: 'home' });
              void updateProfile({ dynamic: { placementPromptDismissed: true } });
            }}
            variant="soft"
          />
        </Card>
      ) : null}

      <Disclosure title="Need help?" icon="help" open={showHelp} onToggle={() => setShowHelp(v => !v)}>
        <View style={styles.helpList}>
          <HelpLine icon="learn" label='"Lessons" — pick a topic' />
          <HelpLine icon="practice" label='"Flashcards" — review flashcards' />
          <HelpLine icon="test" label='"Quiz" — listening, sentence building, fill-in, and choice practice' />
          <HelpLine icon="progress" label='"Progress" — your streak and stats' />
        </View>
        {/* Phase 45 Tier-2: home empty-state illustration (resolves the dead-wire import).
            The home empty state is the "fresh start" visual — a doorway with three rooms
            (less / flashcards / progress). Rendered inside the help disclosure so it doesn't
            add visual noise to the main home flow, but the dead import is now actually used. */}
        <View style={styles.helpArt}>
          <EmptyStateArt screen="home" size={180} />
        </View>
        {onOpenPlacement ? (
          <Button label="Take the placement test" onPress={onOpenPlacement} variant="soft" icon="star" />
        ) : null}
      </Disclosure>
    </ScreenScaffold>
  );
}

function HelpLine({ icon, label }: { icon: React.ComponentProps<typeof Icon>['name']; label: string }) {
  return (
    <View style={styles.helpLine}>
      <Icon name={icon} size={16} />
      <Text style={styles.helpLineText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabletContent: {
    width: '100%',
    maxWidth: 1800,
    alignSelf: 'center',
    paddingHorizontal: ds.spacing.xl,
    paddingTop: ds.spacing.lg,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.md },
  greetingText: { flex: 1, minWidth: 0 },
  mascotButton: { minWidth: ds.touch.min, minHeight: ds.touch.min, alignItems: 'center', justifyContent: 'center' },
  mascotButtonPressed: { opacity: 0.82 },
  koiCard: { gap: ds.spacing.md, padding: ds.spacing.lg },
  koiHeader: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.md },
  koiCopy: { flex: 1, minWidth: 0 },
  koiLabel: { color: ds.colors.warmSoft, fontSize: ds.type.micro, fontWeight: '900', letterSpacing: 0.7 },
  koiTitle: { color: ds.colors.brandInk, fontSize: ds.type.title, fontWeight: '900', marginTop: ds.spacing.xs },
  koiHint: { color: ds.colors.brandInk, fontSize: ds.type.caption, lineHeight: 19, marginTop: ds.spacing.xs, opacity: 0.92 },
  streakCelebrate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.spacing.sm,
    backgroundColor: ds.colors.successSoft,
    padding: ds.spacing.sm,
    borderRadius: ds.radius.md,
  },
  streakCelebrateText: { fontSize: ds.type.body, fontWeight: '800', color: ds.colors.text, flexShrink: 1 },
  todayFocusCard: { gap: ds.spacing.sm, borderLeftWidth: 4, borderLeftColor: ds.colors.primary },
  todayFocusHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm },
  todayFocusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ds.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayFocusCopy: { flex: 1, minWidth: 0 },
  todayFocusLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  todayFocusTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.xs },
  todayFocusDetail: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  todayTodosCard: { gap: ds.spacing.sm, borderLeftWidth: 4, borderLeftColor: ds.colors.primary },
  todayTodosHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm },
  todayTodosIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ds.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayTodosCopy: { flex: 1, minWidth: 0 },
  todayTodosLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  todayTodosTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.xs },
  todayTodosDetail: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  todayTodosEmpty: { fontSize: ds.type.caption, color: ds.colors.textMuted, lineHeight: 18 },
  todayStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs, marginTop: ds.spacing.xs },
  todayStat: {
    fontSize: ds.type.micro,
    fontWeight: '900',
    color: ds.colors.text,
    backgroundColor: ds.colors.surfaceMuted,
    paddingHorizontal: ds.spacing.sm,
    paddingVertical: ds.spacing.xs,
    borderRadius: ds.radius.sm,
  },
  lessonHero: { padding: ds.spacing.lg, gap: ds.spacing.sm },
  lessonLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ds.spacing.xs },
  lessonLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.brandInk, opacity: 0.85, textTransform: 'uppercase' },
  lessonBadge: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: ds.spacing.sm, paddingVertical: ds.spacing.xs, borderRadius: ds.radius.sm },
  lessonBadgeText: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.brandInk },
  lessonTitle: { fontSize: 32, fontWeight: '900', color: ds.colors.brandInk, lineHeight: 40, flexShrink: 1 },
  lessonRomaji: { fontSize: ds.type.heading, color: ds.colors.brandInk, opacity: 0.85, marginTop: ds.spacing.xs, flexShrink: 1 },
  lessonDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: ds.spacing.sm },
  lessonTranslation: { fontSize: ds.type.body, color: ds.colors.brandInk, fontWeight: '800', flexShrink: 1, lineHeight: 22 },
  helpList: { gap: ds.spacing.xs },
  helpLine: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm },
  helpLineText: { fontSize: ds.type.body, color: ds.colors.text, flexShrink: 1 },
  helpArt: { alignItems: 'center', justifyContent: 'center', marginTop: ds.spacing.md, marginBottom: ds.spacing.sm },
  backHeader: { fontSize: ds.type.body },
  reviewCard: { padding: ds.spacing.md, gap: ds.spacing.xs, borderLeftWidth: 4, borderLeftColor: ds.colors.primary },
  reviewHeadline: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text },
  reviewHint: { fontSize: ds.type.caption, color: ds.colors.textMuted },
  reviewCta: { marginTop: ds.spacing.sm, alignSelf: 'flex-start' },
  dailyRushCard: { gap: ds.spacing.sm, borderLeftWidth: 4, borderLeftColor: ds.colors.warm },
  sentenceLabCard: { gap: ds.spacing.sm, borderLeftWidth: 4, borderLeftColor: ds.colors.info },
  dailyRushHeader: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm },
  dailyRushCopy: { flex: 1, minWidth: 0 },
  dailyRushTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text },
  dailyRushHint: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  dailyRushCta: { marginTop: ds.spacing.xs },
  adaptiveCard: { gap: ds.spacing.sm, borderLeftWidth: 4, borderLeftColor: ds.colors.success },
  adaptiveHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm },
  adaptiveCopy: { flex: 1, minWidth: 0 },
  adaptiveLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.success, textTransform: 'uppercase' },
  adaptiveTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.xs },
  adaptiveDetail: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs },
  adaptiveScore: { alignItems: 'center', backgroundColor: ds.colors.successSoft, borderRadius: ds.radius.md, paddingHorizontal: ds.spacing.sm, paddingVertical: ds.spacing.xs },
  adaptiveScoreValue: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.success },
  adaptiveScoreLabel: { fontSize: ds.type.micro, color: ds.colors.textMuted },
});
