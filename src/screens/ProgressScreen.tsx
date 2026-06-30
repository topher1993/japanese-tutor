import React, { useEffect, useMemo, useState } from 'react';
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
import { getAllLessons } from '../services/lessonService';
import { buildProgressDashboard, type ProgressDashboard } from '../services/progressDashboardService';
import { buildProfileProgression } from '../services/profileProgressionService';
import { buildLessonInteractionPath } from '../services/lessonInteractionPathService';
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

export function ProgressScreen({ onOpenFeedback, onOpenSources, onOpenSettings, onOpenProfile }: { onOpenFeedback?: () => void; onOpenSources?: () => void; onOpenSettings?: () => void; onOpenProfile?: () => void }) {
  const { ready, store } = useLearningContext();
  const { profile } = useUserProfileContext();
  const lessons = useMemo(() => getAllLessons(), []);
  const [dashboard, setDashboard] = useState<ProgressDashboard | null>(null);
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!ready || !store) return;
    let cancelled = false;
    Promise.all([store.getDashboard(), store.getProgress()])
      .then(([d, p]: [ProgressDashboard, LearnerProgress]) => {
        if (!cancelled) {
          setDashboard(d);
          setProgress(p);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDashboard(null);
          setProgress(null);
        }
      });
    return () => { cancelled = true; };
  }, [ready, store]);

  // Fallback dashboard so the screen never renders empty before the store loads.
  const safeProgress = progress ?? EMPTY_PROGRESS;
  const view = dashboard ?? buildProgressDashboard(safeProgress, lessons);
  const progression = buildProfileProgression(safeProgress, lessons, view, {
    dailyRushRuns: profile?.dynamic.dailyRush.totalRuns ?? 0,
    dailyRushGood: profile?.dynamic.dailyRush.totalGood ?? 0,
  });
  const tracker = createStudyPlanTracker();
  const planLevel = toStudyLevel(profile?.static.jlptTarget);
  const dailyPlan = tracker.buildDailyPlan(planLevel);
  const achievements = progression.badges.map(badge => ({
    ...badge,
    badge: PROFILE_BADGE_TO_IMAGE[badge.id] ?? 'levelUp',
  }));
  const earnedCount = achievements.filter(a => a.earned).length;
  const hasAnyProgress = view.completedLessons > 0 || view.currentStreak > 0;
  const n5Unlocked = true;
  const n4Unlocked = achievements.some(a => a.id === 'n4-unlocked' && a.earned);

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
  const progressTodoPayload = useMemo<TodoPayload>(() => ({
    todoStates: {},
    weekTodosInitialized: {},
    todoEventCounts: emptyTodoEventCounts(),
    completedLessonIds: safeProgress.completedLessonIds,
  }), [safeProgress.completedLessonIds]);
  const progressTodoBoards = useMemo(
    () => buildAllTodoBoards(getAllWeekPlans(), progressTodoPayload),
    [progressTodoPayload],
  );
  const progressTodoBoard = progressTodoBoards[progressCurrentWeek];
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
});
