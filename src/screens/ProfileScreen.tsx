import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { useUserProfileContext } from '../services/userProfileContext';
import { useLearningContext } from '../services/learningContext';
import { getAllLessons } from '../services/lessonService';
import { buildProgressDashboard } from '../services/progressDashboardService';
import { buildProfileProgression } from '../services/profileProgressionService';
import type { LearnerProgress } from '../types/progress';
import { ds } from '../theme/designSystem';
import type { DailyStudyMinutes, JlptTargetLevel, StudyGoal, WorkplaceProfile } from '../types/userProfile';
import type { LearnerLanguage } from '../types/onboarding';

const LANGUAGE_OPTIONS: Array<{ value: LearnerLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'tl', label: 'Filipino' },
];

const GOAL_OPTIONS: Array<{ value: StudyGoal; label: string; detail: string }> = [
  { value: 'daily-conversation', label: 'Daily conversation', detail: 'Useful phrases for everyday life.' },
  { value: 'workplace-survival', label: 'Workplace survival', detail: 'Job, shift, customer, and coworker situations.' },
  { value: 'jlpt-prep', label: 'JLPT prep', detail: 'Structured review toward a test level.' },
  { value: 'travel-basics', label: 'Travel basics', detail: 'Airport, hotel, transit, and food basics.' },
];

const DAILY_MINUTES: DailyStudyMinutes[] = [2, 5, 10, 15, 30];
const JLPT_LEVELS: JlptTargetLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const INDUSTRIES = ['Hospitality', 'Construction', 'Manufacturing', 'Retail', 'Office', 'Healthcare'];
const ROLES = ['New hire', 'Front desk', 'Server', 'Technician', 'Care worker', 'Team lead'];
const SITUATIONS = ['Greetings', 'Clocking in', 'Asking for help', 'Safety', 'Customers', 'Schedule changes'];

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { ready, profile, updateProfile } = useUserProfileContext();
  const { ready: learningReady, store } = useLearningContext();
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!learningReady || !store) return;
    let cancelled = false;
    store.getProgress()
      .then(p => { if (!cancelled) setProgress(p); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [learningReady, store]);

  const workplace = useMemo(
    () => profile?.static.workplace ?? { industry: '', role: '', commonSituations: [] },
    [profile?.static.workplace],
  );

  async function saveProfile(label: string, update: Parameters<typeof updateProfile>[0]) {
    setSaving(true);
    setSaveMessage(null);
    try {
      await updateProfile(update);
      setSaveMessage(`${label} saved`);
    } finally {
      setSaving(false);
    }
  }

  function setWorkplace(next: WorkplaceProfile) {
    return saveProfile('Workplace profile', {
      static: { studyGoal: 'workplace-survival', workplace: next },
    });
  }

  function toggleSituation(label: string) {
    const exists = workplace.commonSituations.includes(label);
    const commonSituations = exists
      ? workplace.commonSituations.filter(item => item !== label)
      : [...workplace.commonSituations, label];
    void setWorkplace({ ...workplace, commonSituations });
  }

  if (!ready || !profile) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Profile" onBack={onBack} titleStyle={styles.backHeader} />
        <Card shadow="card">
          <Text style={styles.loading}>Loading your profile…</Text>
        </Card>
      </ScreenScaffold>
    );
  }

  const selectedGoal = GOAL_OPTIONS.find(goal => goal.value === profile.static.studyGoal) ?? GOAL_OPTIONS[0];
  const lessons = getAllLessons();
  const safeProgress = progress ?? { startedAt: '', completedLessonIds: [], quizScores: [], streak: { currentStreak: 0, longestStreak: 0 } };
  const dashboard = buildProgressDashboard(safeProgress, lessons);
  const progression = buildProfileProgression(safeProgress, lessons, dashboard);
  const earnedBadges = progression.badges.filter(badge => badge.earned).length;

  return (
    <ScreenScaffold>
      <ScreenHeader title="Profile" subtitle="Personalize your study path" onBack={onBack} titleStyle={styles.backHeader} />

      <Card tone="brand" shadow="hero">
        <Text style={styles.heroLabel}>Learner profile</Text>
        <Text style={styles.heroTitle}>{selectedGoal.label}</Text>
        <Text style={styles.heroBody}>{selectedGoal.detail}</Text>
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroMeta}>{profile.static.supportLanguage.toUpperCase()}</Text>
          <Text style={styles.heroMeta}>{profile.static.dailyStudyMinutes} min/day</Text>
          <Text style={styles.heroMeta}>{profile.static.jlptTarget ?? 'N5'}</Text>
        </View>
      </Card>


      <Card shadow="card">
        <Text style={styles.sectionLabel}>Achievement progress</Text>
        <View style={styles.progressStatRow}>
          <View style={styles.progressStat}>
            <Text style={styles.progressValue}>{progression.xp}</Text>
            <Text style={styles.progressLabel}>XP</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={styles.progressValue}>Lv {progression.level}</Text>
            <Text style={styles.progressLabel}>Level</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={styles.progressValue}>{earnedBadges}/{progression.badges.length}</Text>
            <Text style={styles.progressLabel}>Badges</Text>
          </View>
        </View>
        <Text style={styles.help}>Next milestone: {progression.nextMilestone.label}</Text>
      </Card>

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Recent study history</Text>
        {progression.recentHistory.length > 0 ? progression.recentHistory.map(item => (
          <View key={item.id} style={styles.historyRow}>
            <Text style={styles.historyTitle}>{item.title}</Text>
            <Text style={styles.historyMeta}>{item.level}{typeof item.score === 'number' ? ` • ${item.score}%` : ''}</Text>
          </View>
        )) : (
          <Text style={styles.help}>Complete a lesson to start your history.</Text>
        )}
      </Card>

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Next milestone</Text>
        <Text style={styles.help}>{progression.nextMilestone.label}</Text>
        <View style={styles.badgeList}>
          {progression.badges.map(badge => (
            <Chip key={badge.id} label={badge.label} selected={badge.earned} />
          ))}
        </View>
      </Card>

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Helper language</Text>
        <Text style={styles.help}>Choose the language used for support translations across lessons and flashcards.</Text>
        <View style={styles.chipRow}>
          {LANGUAGE_OPTIONS.map(option => (
            <Chip
              key={option.value}
              label={option.label}
              selected={profile.static.supportLanguage === option.value}
              onPress={() => void saveProfile('Helper language', { static: { supportLanguage: option.value } })}
            />
          ))}
        </View>
      </Card>

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Study goal</Text>
        <View style={styles.goalList}>
          {GOAL_OPTIONS.map(goal => (
            <Card
              key={goal.value}
              tone={profile.static.studyGoal === goal.value ? 'brand' : 'soft'}
              shadow="none"
              onPress={() => void saveProfile('Study goal', {
                static: {
                  studyGoal: goal.value,
                  workplace: goal.value === 'workplace-survival' ? workplace : null,
                },
              })}
            >
              <Text style={[styles.goalTitle, profile.static.studyGoal === goal.value && styles.goalTitleActive]}>{goal.label}</Text>
              <Text style={[styles.goalDetail, profile.static.studyGoal === goal.value && styles.goalDetailActive]}>{goal.detail}</Text>
            </Card>
          ))}
        </View>
      </Card>

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Daily target</Text>
        <View style={styles.chipRow}>
          {DAILY_MINUTES.map(minutes => (
            <Chip
              key={minutes}
              label={`${minutes} min`}
              selected={profile.static.dailyStudyMinutes === minutes}
              onPress={() => void saveProfile('Daily target', { static: { dailyStudyMinutes: minutes } })}
            />
          ))}
        </View>
      </Card>

      <Card shadow="card">
        <Text style={styles.sectionLabel}>JLPT target</Text>
        <View style={styles.chipRow}>
          {JLPT_LEVELS.map(level => (
            <Chip
              key={level}
              label={level}
              selected={profile.static.jlptTarget === level}
              onPress={() => void saveProfile('JLPT target', { static: { jlptTarget: level } })}
            />
          ))}
        </View>
      </Card>

      {profile.static.studyGoal === 'workplace-survival' ? (
        <Card shadow="card">
          <Text style={styles.sectionLabel}>Workplace context</Text>
          <Text style={styles.help}>Keep this structured so the app can recommend practical workplace phrases later.</Text>
          <Text style={styles.subLabel}>Industry</Text>
          <View style={styles.chipRow}>
            {INDUSTRIES.map(industry => (
              <Chip
                key={industry}
                label={industry}
                selected={workplace.industry === industry}
                onPress={() => void setWorkplace({ ...workplace, industry })}
              />
            ))}
          </View>
          <Text style={styles.subLabel}>Role</Text>
          <View style={styles.chipRow}>
            {ROLES.map(role => (
              <Chip
                key={role}
                label={role}
                selected={workplace.role === role}
                onPress={() => void setWorkplace({ ...workplace, role })}
              />
            ))}
          </View>
          <Text style={styles.subLabel}>Common situations</Text>
          <View style={styles.chipRow}>
            {SITUATIONS.map(situation => (
              <Chip
                key={situation}
                label={situation}
                selected={workplace.commonSituations.includes(situation)}
                onPress={() => toggleSituation(situation)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Status</Text>
        <Text style={styles.help}>{saving ? 'Saving…' : saveMessage ?? 'Changes save as soon as you tap a choice.'}</Text>
        <Button label="Back to progress" onPress={onBack} variant="secondary" icon="arrow-left" />
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  backHeader: { fontSize: ds.type.body },
  loading: { fontSize: ds.type.body, color: ds.colors.textMuted },
  heroLabel: { fontSize: ds.type.caption, color: ds.colors.brandInk, opacity: 0.85, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { fontSize: ds.type.title, color: ds.colors.brandInk, fontWeight: '900', marginTop: ds.spacing.xs },
  heroBody: { fontSize: ds.type.body, color: ds.colors.brandInk, opacity: 0.9, marginTop: ds.spacing.xs, lineHeight: 22 },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm, marginTop: ds.spacing.md },
  heroMeta: { fontSize: ds.type.caption, color: ds.colors.brandDark, fontWeight: '900', backgroundColor: ds.colors.brandInk, borderRadius: ds.radius.pill, paddingHorizontal: ds.spacing.sm, paddingVertical: ds.spacing.xs },
  sectionLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase', marginBottom: ds.spacing.xs },
  subLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.md, marginBottom: ds.spacing.xs },
  help: { fontSize: ds.type.body, color: ds.colors.textMuted, lineHeight: 22, marginBottom: ds.spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm },
  goalList: { gap: ds.spacing.sm, marginTop: ds.spacing.sm },
  goalTitle: { fontSize: ds.type.body, color: ds.colors.text, fontWeight: '900' },
  goalTitleActive: { color: ds.colors.brandInk },
  goalDetail: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  goalDetailActive: { color: ds.colors.brandInk, opacity: 0.9 },
  progressStatRow: { flexDirection: 'row', gap: ds.spacing.sm, marginVertical: ds.spacing.sm },
  progressStat: { flex: 1, backgroundColor: ds.colors.surfaceAlt, borderRadius: ds.radius.md, padding: ds.spacing.sm, alignItems: 'center' },
  progressValue: { fontSize: ds.type.heading, color: ds.colors.primary, fontWeight: '900' },
  progressLabel: { fontSize: ds.type.micro, color: ds.colors.textMuted, fontWeight: '900', textTransform: 'uppercase', marginTop: ds.spacing.xs },
  historyRow: { borderBottomWidth: 1, borderBottomColor: ds.colors.divider, paddingVertical: ds.spacing.sm },
  historyTitle: { fontSize: ds.type.body, color: ds.colors.text, fontWeight: '900' },
  historyMeta: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs },
  badgeList: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs },
});
