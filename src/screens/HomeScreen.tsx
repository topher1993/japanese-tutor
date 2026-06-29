import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Disclosure } from '../components/Disclosure';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { HeroLogo } from '../components/HeroLogo';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { StreakFlame } from '../components/StreakFlame';
import { getDailyLesson } from '../services/lessonService';
import { getSupportLanguageDisplayName, getSupportTranslation } from '../services/supportLanguageService';
import { useLearningContext } from '../services/learningContext';
import type { LearnerLanguage } from '../types/onboarding';
import type { LearnerProgress } from '../types/progress';
import { PlacementTestPanel } from './PlacementTestPanel';
import { ds } from '../theme/designSystem';

export function HomeScreen({
  supportLanguage = 'en',
  onStartLesson,
  onReviewDue,
  onOpenDailyRush,
}: {
  supportLanguage?: LearnerLanguage;
  onStartLesson?: () => void;
  onReviewDue?: () => void;
  onOpenDailyRush?: () => void;
}) {
  // Phase 30: read progress so the daily lesson copy reflects the
  // learner's actual completion state instead of always defaulting to
  // Week 1 Day 1.
  const { ready, store, srs } = useLearningContext();
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  useEffect(() => {
    if (!ready || !store) return;
    let cancelled = false;
    store.getProgress()
      .then((p) => { if (!cancelled) setProgress(p); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [ready, store]);
  const lesson = getDailyLesson(progress ?? undefined);
  const phrase = lesson.lesson.items[0];
  const primaryTranslation = getSupportTranslation(phrase, supportLanguage);
    const [showPlacement, setShowPlacement] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    // P0-02 + P0-03 fix: StreakFlame now reads from the persistent store, not a hardcoded 3.
    const [streak, setStreak] = useState<number>(0);
    const [dueCount, setDueCount] = useState<number>(0);
    useEffect(() => {
      if (!ready || !store) return;
      let cancelled = false;
      Promise.all([
        store.getDashboard().then(d => d.currentStreak),
        srs ? srs.dueCount() : Promise.resolve(0),
      ])
        .then(([s, d]) => { if (!cancelled) { setStreak(s); setDueCount(d); } })
        .catch(() => { if (!cancelled) { setStreak(0); setDueCount(0); } });
      return () => { cancelled = true; };
    }, [ready, store, srs]);

  if (showPlacement) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Back" onBack={() => setShowPlacement(false)} titleStyle={styles.backHeader} />
        <PlacementTestPanel onComplete={() => undefined} />
      </ScreenScaffold>
    );
  }

  return (
      <ScreenScaffold>
        <HeroLogo size={120} subtitle="まいにち、にほんごをべんきょうしよう" tone="muted" />

        <View style={styles.greetingRow}>
          <Mascot expression="base" size={64} />
          <View style={styles.greetingText}>
            <ScreenHeader
              title="Home"
              subtitle={`${getSupportLanguageDisplayName(supportLanguage)} • ${lesson.lesson.title}`}
            />
          </View>
        </View>

      <StreakFlame days={streak} />
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

      <Disclosure title="Need help?" icon="help" open={showHelp} onToggle={() => setShowHelp(v => !v)}>
        <View style={styles.helpList}>
          <HelpLine icon="learn" label='"Lessons" — pick a topic' />
          <HelpLine icon="practice" label='"Flashcards" — review flashcards' />
          <HelpLine icon="test" label='"Quiz" — quick self-check' />
          <HelpLine icon="progress" label='"Progress" — your streak and stats' />
        </View>
        <Button label="Take the placement test" onPress={() => setShowPlacement(true)} variant="soft" icon="star" />
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
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.md },
  greetingText: { flex: 1, minWidth: 0 },
  streakCelebrate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.spacing.sm,
    backgroundColor: ds.colors.successSoft,
    padding: ds.spacing.sm,
    borderRadius: ds.radius.md,
  },
  streakCelebrateText: { fontSize: ds.type.body, fontWeight: '800', color: ds.colors.text, flexShrink: 1 },
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
  backHeader: { fontSize: ds.type.body },
  reviewCard: { padding: ds.spacing.md, gap: ds.spacing.xs, borderLeftWidth: 4, borderLeftColor: ds.colors.primary },
  reviewHeadline: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text },
  reviewHint: { fontSize: ds.type.caption, color: ds.colors.textMuted },
  reviewCta: { marginTop: ds.spacing.sm, alignSelf: 'flex-start' },
  dailyRushCard: { gap: ds.spacing.sm, borderLeftWidth: 4, borderLeftColor: ds.colors.warm },
  dailyRushHeader: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm },
  dailyRushCopy: { flex: 1, minWidth: 0 },
  dailyRushTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text },
  dailyRushHint: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs, lineHeight: 18 },
  dailyRushCta: { marginTop: ds.spacing.xs },
});