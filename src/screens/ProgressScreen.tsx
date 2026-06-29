import React, { useEffect, useState } from 'react';
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
import { createStudyPlanTracker, type StudyLevel } from '../services/studyPlanService';
import { useLearningContext } from '../services/learningContext';
import { ds } from '../theme/designSystem';

interface Achievement {
  badge: BadgeKey;
  title: string;
  description: string;
  earned: boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  { badge: 'firstLesson', title: 'First Lesson', description: 'Complete your first lesson', earned: true },
  { badge: 'firstKanji', title: 'First Kanji', description: 'Learn your first kanji character', earned: true },
  { badge: 'streak7', title: '7-Day Streak', description: 'Practice 7 days in a row', earned: true },
  { badge: 'streak30', title: '30-Day Streak', description: 'Practice 30 days in a row', earned: false },
  { badge: 'vocab100', title: '100 Vocabulary', description: 'Learn 100 vocabulary words', earned: false },
  { badge: 'levelUp', title: 'Level Up', description: 'Reach a new JLPT level', earned: false },
  { badge: 'survivalComplete', title: 'Survival Pack', description: 'Complete the workplace survival pack', earned: false },
  { badge: 'perfectQuiz', title: 'Perfect Quiz', description: 'Score 100% on a quiz', earned: false },
];

const JLPT_BADGES: { badge: BadgeKey; label: string; unlocked: boolean }[] = [
  { badge: 'jlptN5', label: 'N5', unlocked: true },
  { badge: 'jlptN4', label: 'N4', unlocked: false },
];

export function ProgressScreen({ onOpenFeedback, onOpenSources, onOpenSettings, onOpenProfile }: { onOpenFeedback?: () => void; onOpenSources?: () => void; onOpenSettings?: () => void; onOpenProfile?: () => void }) {
  const { ready, store } = useLearningContext();
  const [dashboard, setDashboard] = useState<ProgressDashboard | null>(null);

  useEffect(() => {
    if (!ready || !store) return;
    let cancelled = false;
    store.getDashboard()
      .then((d: ProgressDashboard) => { if (!cancelled) setDashboard(d); })
      .catch(() => { if (!cancelled) setDashboard(null); });
    return () => { cancelled = true; };
  }, [ready, store]);

  // Fallback dashboard so the screen never renders empty before the store loads.
  const view = dashboard ?? buildProgressDashboard(
    { startedAt: '', completedLessonIds: [], quizScores: [], streak: { currentStreak: 0, longestStreak: 0 } },
    getAllLessons(),
  );
  const tracker = createStudyPlanTracker();
  const dailyPlan = tracker.buildDailyPlan('N5');
  const levels: StudyLevel[] = ['N5', 'N4', 'N3', 'N2'];
  const [showMore, setShowMore] = useState(false);

  const earnedCount = ACHIEVEMENTS.filter(a => a.earned).length;
  const hasAnyProgress = view.completedLessons > 0 || view.currentStreak > 0;

  return (
    <ScreenScaffold>
      <ScreenHeader title="Progress" subtitle={`${view.completedLessons} of ${view.totalLessons} lessons done`} />

      {!hasAnyProgress ? (
        <View style={styles.emptyWrap}>
          <EmptyStateArt screen="progress" size={220} />
          <Text style={styles.emptyTitle}>Your journey starts here</Text>
          <Text style={styles.emptyBody}>Complete your first lesson to start collecting badges.</Text>
        </View>
      ) : (
        <>
          <StreakFlame days={view.currentStreak} />

          <Card shadow="card">
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Today's plan</Text>
              <Text style={styles.sectionMeta}>{dailyPlan.totalMinutes} min</Text>
            </View>
            <View style={styles.taskList}>
              {dailyPlan.tasks.map(task => (
                <View key={task.id} style={styles.taskRow}>
                  <View style={styles.taskCheck}>
                    <Icon name="check" size={14} />
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
              {levels.map(level => (
                <Chip
                  key={level}
                  label={level}
                  selected={level === dailyPlan.level}
                />
              ))}
            </View>
            <Text style={styles.levelHint}>Currently studying {dailyPlan.level}</Text>
          </Card>

          <Card shadow="card">
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Achievements</Text>
              <Text style={styles.sectionMeta}>{earnedCount} of {ACHIEVEMENTS.length}</Text>
            </View>
            <View style={styles.badgeGrid}>
              {ACHIEVEMENTS.map(a => (
                <View key={a.badge} style={styles.badgeItem}>
                  <BadgeImage badge={a.badge} size={56} earned={a.earned} />
                  <Text style={styles.badgeTitle} numberOfLines={2}>{a.title}</Text>
                  <Text style={styles.badgeDesc} numberOfLines={2}>{a.description}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card shadow="card">
            <Text style={styles.sectionLabel}>JLPT levels</Text>
            <View style={styles.jlptRow}>
              {JLPT_BADGES.map(b => (
                <View key={b.badge} style={styles.jlptItem}>
                  <BadgeImage badge={b.badge} size={64} earned={b.unlocked} />
                  <Text style={styles.jlptLabel}>{b.label}</Text>
                </View>
              ))}
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
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ds.spacing.sm },
  sectionLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  sectionMeta: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.textMuted },
  taskList: { gap: ds.spacing.xs },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, paddingVertical: ds.spacing.sm, paddingHorizontal: ds.spacing.xs },
  taskCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: ds.colors.successSoft, alignItems: 'center', justifyContent: 'center',
  },
  taskTitle: { flex: 1, fontSize: ds.type.body, color: ds.colors.text, fontWeight: '700', flexShrink: 1 },
  taskMeta: { fontSize: ds.type.caption, color: ds.colors.primary, fontWeight: '900' },
  levelRow: { flexDirection: 'row', gap: ds.spacing.xs, marginTop: ds.spacing.md, marginBottom: ds.spacing.sm },
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