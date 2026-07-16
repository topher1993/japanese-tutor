import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BadgeImage, type BadgeKey } from '../components/BadgeImage';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Disclosure } from '../components/Disclosure';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { Icon } from '../components/Icon';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { StreakFlame } from '../components/StreakFlame';
import {
  getAllCourseLessons,
  getGrammarLessons,
  getPhraseLessons,
} from '../services/lessonService';
import { buildProgressDashboard, type ProgressDashboard } from '../services/progressDashboardService';
import { buildProfileProgression } from '../services/profileProgressionService';
import { buildLessonInteractionPath } from '../services/lessonInteractionPathService';
import { lessonsForPlacementLevel, placementLevelToCourseLevel } from '../services/placementPathService';
import { buildLessonProgression } from '../services/lessonProgressionService';
import { createStudyPlanTracker, type StudyLevel } from '../services/studyPlanService';
import { useLearningContext } from '../services/learningContext';
import { useUserProfileContext } from '../services/userProfileContext';
import { isTodoFeatureEnabled } from '../services/practiceProgressStore';
import { getAllWeekPlans } from '../services/weeklyPlansService';
import {
  buildAllTodoBoards,
  type TodoPayload,
} from '../services/weeklyTodoService';
import { emptyTodoEventCounts } from '../types/weeklyTodo';
import { ds } from '../theme/designSystem';
import type { LearnerProgress } from '../types/progress';
import type { JlptTargetLevel } from '../types/userProfile';
import { buildAdaptiveLearningSnapshot, type AdaptiveLearningSnapshot } from '../services/adaptiveLearningService';
import { buildDailyTodoBoard, COURSE_COMPLETE_DAILY_TODO_DEFINITIONS } from '../services/dailyTodoService';
import { useTodayDateKey } from '../hooks/useTodayDateKey';
import { MasteryMapCard } from '../components/MasteryMapCard';
import { buildCandidateFlashcardCards } from '../services/candidateFlashcardAdapter';
import { createFlashcardDeck } from '../services/flashcardService';
import { buildMasteryMap, buildMasterySnapshot } from '../services/masteryService';
import { track } from '../services/analyticsService';
import type { FlashcardReviewCard } from '../types/flashcard';
import type { ReviewCard } from '../services/spacedRepetitionService';
import type { VocabularyLearningGroup } from '../services/vocabularyTaxonomyService';

const EMPTY_PROGRESS: LearnerProgress = {
  startedAt: '',
  completedLessonIds: [],
  quizScores: [],
  streak: { currentStreak: 0, longestStreak: 0 },
};

const PROFILE_BADGE_TO_IMAGE: Record<string, BadgeKey> = {
  'first-lesson': 'firstLesson',
  'seven-day-streak': 'streak7',
  'daily-rush-starter': 'levelUp',
  'perfect-quiz': 'perfectQuiz',
  'n4-unlocked': 'jlptN4',
};

const JLPT_LEVELS: StudyLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

function toStudyLevel(level: JlptTargetLevel | null | undefined): StudyLevel {
  return JLPT_LEVELS.includes(level as StudyLevel) ? (level as StudyLevel) : 'N5';
}

export function ProgressScreen({ onOpenFeedback, onOpenSources, onOpenSettings, onOpenProfile, onPracticeWordGroup, onPracticeTopic, onPracticeWeak, onOpenGrammar }: { onOpenFeedback?: () => void; onOpenSources?: () => void; onOpenSettings?: () => void; onOpenProfile?: () => void; onPracticeWordGroup?: (group: VocabularyLearningGroup) => void; onPracticeTopic?: (topic: string) => void; onPracticeWeak?: () => void; onOpenGrammar?: () => void }) {
  const { ready, store, srs, durable } = useLearningContext();
  const subscribeExtended = useCallback(
    (listener: () => void) => store?.subscribeExtendedProgress?.(listener) ?? (() => undefined),
    [store],
  );
  const getExtendedRevision = useCallback(
    () => store?.getExtendedProgressRevision?.() ?? 0,
    [store],
  );
  const extendedRevision = useSyncExternalStore(subscribeExtended, getExtendedRevision, () => 0);
  const { profile } = useUserProfileContext();
  const lessons = useMemo(
    () => lessonsForPlacementLevel(getPhraseLessons(), profile?.dynamic.placement?.level),
    [profile?.dynamic.placement?.level],
  );
  const grammarLessons = useMemo(() => getGrammarLessons(), []);
  const [dashboard, setDashboard] = useState<ProgressDashboard | null>(null);
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [adaptiveSnapshot, setAdaptiveSnapshot] = useState<AdaptiveLearningSnapshot>(() => buildAdaptiveLearningSnapshot([]));
  const [srsRows, setSrsRows] = useState<ReviewCard[]>([]);
  const [masteryCards, setMasteryCards] = useState<FlashcardReviewCard[]>(() => createFlashcardDeck(getAllCourseLessons()).cards);

  useEffect(() => {
    if (!ready || !store) return;
    let cancelled = false;
    Promise.all([
      store.getDashboard(),
      store.getProgress(),
      srs ? srs.listCards() : Promise.resolve([]),
      buildCandidateFlashcardCards(profile?.dynamic.placement?.level).catch(() => []),
    ])
      .then(([d, p, cards, candidates]: [ProgressDashboard, LearnerProgress, ReviewCard[], FlashcardReviewCard[]]) => {
        if (!cancelled) {
          setDashboard(d);
          setProgress(p);
          setAdaptiveSnapshot(buildAdaptiveLearningSnapshot(cards));
          setSrsRows(cards);
          setMasteryCards([...createFlashcardDeck(lessonsForPlacementLevel(getAllCourseLessons(), profile?.dynamic.placement?.level)).cards, ...candidates]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDashboard(null);
          setProgress(null);
          setAdaptiveSnapshot(buildAdaptiveLearningSnapshot([]));
          setSrsRows([]);
        }
      });
    return () => { cancelled = true; };
  }, [ready, store, srs, profile?.dynamic.placement?.level]);

  // Always derive the visible dashboard from the latest progress snapshot.
  // `getDashboard()` and `getProgress()` can resolve in different orders on
  // native cold starts; preferring the separately hydrated progress snapshot
  // prevents the header from remaining at 0/36 after a lesson completion.
  const safeProgress = progress ?? EMPTY_PROGRESS;
  const progressView = buildProgressDashboard(safeProgress, lessons);
  const view = {
    ...progressView,
    currentStreak: dashboard?.currentStreak ?? progressView.currentStreak,
    longestStreak: dashboard?.longestStreak ?? progressView.longestStreak,
  };
  const progression = buildProfileProgression(safeProgress, lessons, view, {
    dailyRushRuns: profile?.dynamic.dailyRush.totalRuns ?? 0,
    dailyRushGood: profile?.dynamic.dailyRush.totalGood ?? 0,
  });
  const tracker = createStudyPlanTracker();
  const planLevel = profile?.dynamic.placement
    ? placementLevelToCourseLevel(profile.dynamic.placement.level)
    : toStudyLevel(profile?.static.jlptTarget);
  const dailyPlan = tracker.buildDailyPlan(planLevel);
  const achievements = progression.badges.map(badge => ({
    ...badge,
    badge: PROFILE_BADGE_TO_IMAGE[badge.id] ?? 'levelUp',
  }));
  const earnedCount = achievements.filter(a => a.earned).length;
  const hasAnyProgress = view.completedLessons > 0 || view.currentStreak > 0;
  const n5Unlocked = true;
  const n4Unlocked = achievements.some(a => a.id === 'n4-unlocked' && a.earned);
  const completedGrammarLessons = grammarLessons.filter(lesson => safeProgress.completedLessonIds.includes(lesson.id)).length;

  // Phase 37e: build the per-week todo board for the current week so the
  // Progress tab can show a "Week N todos: X/Y complete" widget. Mirrors
  // the 37c/37d lesson+path derivation pattern. Gated behind
  // `isTodoFeatureEnabled()` so default flag-off behavior is unchanged.
  const lessonPath = useMemo(
    () => buildLessonInteractionPath(lessons, safeProgress),
    [lessons, safeProgress],
  );
  const lessonProgression = buildLessonProgression(lessonPath.currentWeek.week);
  const progressCurrentWeek = lessonProgression.currentWeekDetails().weekNumber;
  const progressTodoPayload = useMemo<TodoPayload>(() => {
    const extended = store?.getExtendedProgress() as {
      todoStates?: TodoPayload['todoStates'];
      weekTodosInitialized?: TodoPayload['weekTodosInitialized'];
      todoEventCounts?: TodoPayload['todoEventCounts'];
    } | undefined;
    return ({
    todoStates: extended?.todoStates ?? {},
    weekTodosInitialized: extended?.weekTodosInitialized ?? {},
    todoEventCounts: extended?.todoEventCounts ?? emptyTodoEventCounts(),
    completedLessonIds: safeProgress.completedLessonIds,
    });
  }, [extendedRevision, safeProgress.completedLessonIds, store]);
  const quizHistory = [...(progressTodoPayload.todoEventCounts.quizHistory ?? [])]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, 5);
  const quizModeLabels = { mixed: 'Mixed', listening: 'Listening', builder: 'Sentence building', fillBlank: 'Fill in the blank' };
  const progressTodoBoards = useMemo(
    () => buildAllTodoBoards(getAllWeekPlans(), progressTodoPayload, 'all', progressCurrentWeek),
    [progressCurrentWeek, progressTodoPayload],
  );
  const progressTodoBoard = progressTodoBoards[progressCurrentWeek];
  const todayDate = useTodayDateKey();
  const dailyTodoBoard = useMemo(
    () => buildDailyTodoBoard(
      todayDate,
      progressTodoPayload.todoEventCounts.dailyActivity?.[todayDate],
      view.totalLessons > 0 && view.completedLessons >= view.totalLessons
        ? COURSE_COMPLETE_DAILY_TODO_DEFINITIONS
        : undefined,
    ),
    [progressTodoPayload.todoEventCounts.dailyActivity, todayDate, view.completedLessons, view.totalLessons],
  );
  const masteryMap = useMemo(() => buildMasteryMap({
    flashcards: masteryCards,
    srsCards: srsRows,
    evidence: progressTodoPayload.todoEventCounts.masteryEvidence ?? [],
    snapshots: progressTodoPayload.todoEventCounts.masterySnapshots ?? [],
  }), [masteryCards, progressTodoPayload.todoEventCounts.masteryEvidence, progressTodoPayload.todoEventCounts.masterySnapshots, srsRows]);
  useEffect(() => {
    if (!ready || !store || masteryMap.items.length === 0) return;
    const snapshot = buildMasterySnapshot(masteryMap, todayDate);
    const existing = progressTodoPayload.todoEventCounts.masterySnapshots?.find(item => item.date === todayDate);
    const sameGroups = JSON.stringify(existing?.groupScores ?? {}) === JSON.stringify(snapshot.groupScores);
    if (existing?.overallScore === snapshot.overallScore && sameGroups) return;
    void store.recordMasterySnapshot(snapshot).catch(() => undefined);
  }, [masteryMap, progressTodoPayload.todoEventCounts.masterySnapshots, ready, store, todayDate]);
  function handleMasteryFocus(group: VocabularyLearningGroup): void {
    const summary = masteryMap.groups.find(item => item.group === group);
    track('mastery_focus_opened', { group, score: summary?.score ?? 0, weakest_modality: summary?.weakestModality });
    onPracticeWordGroup?.(group);
  }
  function handleMasteryTopicFocus(topic: string): void {
    const summary = masteryMap.topics.find(item => item.topic === topic);
    track('mastery_focus_opened', { topic, score: summary?.score ?? 0, weakest_modality: summary?.weakestModality });
    onPracticeTopic?.(topic);
  }
  function handleMasteryWeakFocus(): void {
    track('mastery_focus_opened', { focus: 'weak-items', score: masteryMap.overallScore, weakest_modality: masteryMap.weakestModality });
    onPracticeWeak?.();
  }
  const progressTodosEnabled = isTodoFeatureEnabled();
  const progressTodosLabel = progressTodoBoard
    ? `Week ${progressCurrentWeek} todos: ${progressTodoBoard.completedCount} / ${progressTodoBoard.totalCount} complete`
    : `Week ${progressCurrentWeek} todos: 0 / 0 complete`;
  const progressTodosHelper = progressTodoBoard
    ? progressTodoBoard.isLegacyWeek
      ? 'Completed before weekly todos were introduced'
      : progressTodoBoard.totalCount === 0
        ? 'No todos authored for this week yet.'
        : progressTodoBoard.allDone
          ? 'All todos complete — next week unlocked.'
          : 'Keep completing the weekly todos to advance.'
    : 'No board built for this week.';

  return (
    <ScreenScaffold>
      <ScreenHeader title="Progress" subtitle={`${view.completedLessons} of ${view.totalLessons} lessons done`} />
      <Text style={styles.storageHint}>{durable ? 'Progress synced to this device' : 'Offline session — progress will stay on this device for now'}</Text>

      {hasAnyProgress ? null : (
        <View style={styles.emptyWrap}>
          <EmptyStateArt screen="progress" size={180} />
          <Text style={styles.emptyTitle}>Your journey starts here</Text>
          <Text style={styles.emptyBody}>You can still open your plan, achievements, profile, settings, and sources before completing a daily task.</Text>
        </View>
      )}

      <StreakFlame days={view.currentStreak} />

      <Card shadow="card">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Course progress</Text>
          <Text style={styles.sectionMeta}>{view.completionPercent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, view.completionPercent))}%` }]} />
        </View>
        <Text style={styles.levelHint}>{view.nextRecommendedLesson ? `Next: ${view.nextRecommendedLesson.title}` : 'All bundled lessons complete.'}</Text>
      </Card>

      <Card shadow="card">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Grammar rules</Text>
          <Text style={styles.sectionMeta}>{completedGrammarLessons} / {grammarLessons.length}</Text>
        </View>
        <Text style={styles.levelHint}>Adjectives, particles, verb forms, conditions, and other v1.1 grammar rules.</Text>
        {onOpenGrammar ? <Button label="Review grammar rules" variant="secondary" onPress={onOpenGrammar} iconRight="arrow-right" /> : null}
      </Card>

      <Card shadow="card">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Quiz history</Text>
          <Text style={styles.sectionMeta}>{quizHistory.length > 0 ? `${quizHistory.length} recent` : 'No attempts'}</Text>
        </View>
        {quizHistory.length > 0 ? quizHistory.map(entry => (
          <View key={entry.id} style={styles.historyRow}>
            <Text style={styles.levelHint}>{quizModeLabels[entry.mode]} · {entry.source}</Text>
            <Text style={styles.sectionMeta}>{entry.score} / {entry.total}</Text>
          </View>
        )) : <Text style={styles.levelHint}>Complete a quiz to build a mode-specific history.</Text>}
      </Card>

      <Card shadow="card">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Memory health</Text>
          <Text style={styles.sectionMeta}>{adaptiveSnapshot.retentionPercent}% retention</Text>
        </View>
        <Text style={styles.levelHint}>
          {adaptiveSnapshot.dueCards} due • {adaptiveSnapshot.weakCards} strengthening • {adaptiveSnapshot.memorizedCards} memorized
        </Text>
        <Text style={styles.levelHint}>The next session is chosen from your current recall state.</Text>
      </Card>

      <MasteryMapCard
        map={masteryMap}
        onFocusGroup={onPracticeWordGroup ? handleMasteryFocus : undefined}
        onFocusTopic={onPracticeTopic ? handleMasteryTopicFocus : undefined}
        onPracticeWeak={onPracticeWeak ? handleMasteryWeakFocus : undefined}
      />

      {/* Phase 37e: render the "Week N todos" widget only when
          `isTodoFeatureEnabled()` is true so the default learner experience
          (flag=false) is unchanged. When the flag flips in 37g this becomes
          a visible source of progression alongside Course progress. */}
      {progressTodosEnabled && progressTodoBoard ? (
        <Card shadow="card">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Weekly todos</Text>
            <Text style={styles.sectionMeta}>
              {progressTodoBoard.completedCount} / {progressTodoBoard.totalCount}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressTodoBoard.totalCount === 0
                    ? 0
                    : Math.min(100, Math.max(0, Math.round((progressTodoBoard.completedCount / progressTodoBoard.totalCount) * 100)))}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.levelHint}>{progressTodosLabel} • {progressTodosHelper}</Text>
        </Card>
      ) : null}

      {progressTodosEnabled ? (
        <Card shadow="card">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Daily todos</Text>
            <Text style={styles.sectionMeta}>{dailyTodoBoard.completedCount} / {dailyTodoBoard.totalCount}</Text>
          </View>
          <Text style={styles.levelHint}>
            {dailyTodoBoard.allDone ? 'All daily goals complete — great work!' : 'Complete these focused goals today.'}
          </Text>
          {dailyTodoBoard.todos.map(status => (
            <View key={status.todo.id} style={styles.taskRow}>
              <View style={styles.taskCheck}>
                <Icon name={status.completed ? 'check' : 'book'} size={14} />
              </View>
              <Text style={styles.taskTitle}>{status.todo.title}</Text>
              <Text style={styles.taskMeta}>{status.progress}/{status.target}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card shadow="card">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Today's plan</Text>
          <Text style={styles.sectionMeta}>{dailyPlan.totalMinutes} min</Text>
        </View>
        <View style={styles.taskList}>
          {dailyPlan.tasks.map(task => (
            <View key={task.id} style={styles.taskRow}>
              <View style={styles.taskCheck}>
                <Icon name="book" size={14} />
              </View>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskMeta}>{task.minutes} min</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Your level</Text>
        <View style={styles.levelRow}>
          {JLPT_LEVELS.map(level => (
            <Chip
              key={level}
              label={level}
              selected={level === dailyPlan.level}
            />
          ))}
        </View>
        <Text style={styles.levelHint}>Currently studying {dailyPlan.level} • Level {progression.level} • {progression.nextMilestone.label}</Text>
      </Card>

      <Card shadow="card">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Achievements</Text>
          <Text style={styles.sectionMeta}>{earnedCount} of {achievements.length}</Text>
        </View>
        <View style={styles.badgeGrid}>
          {achievements.map(a => (
            <View key={a.id} style={styles.badgeItem}>
              <BadgeImage badge={a.badge} size={56} earned={a.earned} />
              <Text style={styles.badgeTitle} numberOfLines={2}>{a.label}</Text>
              <Text style={styles.badgeDesc} numberOfLines={2}>{a.description}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card shadow="card">
        <Text style={styles.sectionLabel}>JLPT levels</Text>
        <View style={styles.jlptRow}>
          <View style={styles.jlptItem}>
            <BadgeImage badge="jlptN5" size={64} earned={n5Unlocked} />
            <Text style={styles.jlptLabel}>N5</Text>
          </View>
          <View style={styles.jlptItem}>
            <BadgeImage badge="jlptN4" size={64} earned={n4Unlocked} />
            <Text style={styles.jlptLabel}>N4</Text>
          </View>
        </View>
      </Card>

      <Disclosure title="More tools" icon="more" open={showMore} onToggle={() => setShowMore(v => !v)}>
        {onOpenProfile ? (
          <Button label="Edit learner profile" onPress={onOpenProfile} variant="soft" icon="settings" testID="progress-open-profile" />
        ) : null}
        {onOpenFeedback ? (
          <Button label="Send feedback" onPress={onOpenFeedback} variant="soft" icon="feedback" />
        ) : null}
        {onOpenSources ? (
          <Button label="Sources & credits" onPress={onOpenSources} variant="soft" icon="book" />
        ) : null}
        {onOpenSettings ? (
          <Button label="Settings" onPress={onOpenSettings} variant="soft" icon="settings" testID="progress-open-settings" />
        ) : null}
      </Disclosure>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ds.spacing.sm },
  sectionLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  sectionMeta: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.textMuted },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: ds.spacing.sm, paddingVertical: ds.spacing.xs },
  progressTrack: { height: ds.spacing.sm, borderRadius: ds.radius.pill, backgroundColor: ds.colors.surfaceAlt, overflow: 'hidden', marginBottom: ds.spacing.sm },
  progressFill: { height: '100%', borderRadius: ds.radius.pill, backgroundColor: ds.colors.success },
  taskList: { gap: ds.spacing.xs },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, paddingVertical: ds.spacing.sm, paddingHorizontal: ds.spacing.xs },
  taskCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: ds.colors.successSoft, alignItems: 'center', justifyContent: 'center',
  },
  taskTitle: { flex: 1, fontSize: ds.type.body, color: ds.colors.text, fontWeight: '700', flexShrink: 1 },
  taskMeta: { fontSize: ds.type.caption, color: ds.colors.primary, fontWeight: '900' },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs, marginTop: ds.spacing.md, marginBottom: ds.spacing.sm },
  levelHint: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.md, marginTop: ds.spacing.sm },
  badgeItem: { width: '22%', minWidth: 70, alignItems: 'center', gap: ds.spacing.xs },
  badgeTitle: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  badgeDesc: { fontSize: ds.type.micro, color: ds.colors.textMuted, textAlign: 'center' },
  jlptRow: { flexDirection: 'row', gap: ds.spacing.lg, marginTop: ds.spacing.md },
  jlptItem: { alignItems: 'center', gap: ds.spacing.xs },
  jlptLabel: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.primary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ds.spacing.md, paddingVertical: ds.spacing.xl },
  emptyTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  emptyBody: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center', flexShrink: 1, paddingHorizontal: ds.spacing.lg },
  storageHint: { fontSize: ds.type.micro, color: ds.colors.textMuted, textAlign: 'center', marginBottom: ds.spacing.sm },
});
