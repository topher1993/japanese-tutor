import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { advanceOnboarding, getCurrentOnboardingStep, getDefaultOnboardingState, selectLearnerLanguage } from '../services/onboardingService';
// Phase 44.4: per-step view events power the PostHog onboarding funnel.
// Each step transition fires `onboarding_step_viewed` so we can
// measure drop-off at each step (welcome → language → workplace-goal
// → daily-habit). No PII in the payload — step is a typed enum.
import { track } from '../services/analyticsService';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Illustration } from '../components/Illustration';
import { Mascot } from '../components/Mascot';
import { ds } from '../theme/designSystem';

type OnboardingStepId = 'welcome' | 'language' | 'workplace-goal' | 'daily-habit';

const STEP_VISUALS: Record<OnboardingStepId, { emoji: string; tone: 'brand' | 'warm' | 'success' | 'info' }> = {
  'welcome':        { emoji: '👋', tone: 'brand' },
  'language':       { emoji: '🌐', tone: 'info' },
  'workplace-goal': { emoji: '🛠️', tone: 'warm' },
  'daily-habit':    { emoji: '🔥', tone: 'success' },
};

/** Map onboarding step → which illustration scene to render (null = no illustration). */
const STEP_ILLUSTRATION: Partial<Record<OnboardingStepId, 'welcome' | 'workplace' | 'habit'>> = {
  welcome: 'welcome',
  'workplace-goal': 'workplace',
  'daily-habit': 'habit',
};

export function OnboardingScreen({ onDone, initialStepId }: { onDone: (language: 'en' | 'vi' | 'tl') => void; initialStepId?: OnboardingStepId }) {
  const [state, setState] = useState({ ...getDefaultOnboardingState(), currentStepId: initialStepId ?? 'welcome' });
  const step = getCurrentOnboardingStep(state);
  const visual = STEP_VISUALS[step.id as OnboardingStepId];
  const illustrationScene = STEP_ILLUSTRATION[step.id as OnboardingStepId];

  // Phase 44.4: fire onboarding_step_viewed when the user arrives at
  // a step. Keyed on step.id so each step fires exactly once per
  // visit (no re-fires on re-render). The funnel in PostHog uses
  // these events to compute drop-off per step.
  useEffect(() => {
    track('onboarding_step_viewed', { step: step.id });
    // We intentionally depend only on step.id — track() is no-op in
    // test mode and the dep on step.id is enough to catch every
    // step transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  function next() {
    const advanced = advanceOnboarding(state);
    if (advanced.completed) onDone(advanced.language);
    else setState(advanced);
  }

  return (
    <ScreenScaffold>
      <View style={styles.shell}>
        <View style={styles.brandRow}>
          <Text style={styles.brandEmoji}>日本語</Text>
          <Text style={styles.brandName}>Tutor</Text>
        </View>

        <Card tone="brand" shadow="hero" style={styles.hero}>
          {illustrationScene ? (
            <View style={styles.illustrationWrap}>
              <Illustration
                scene={illustrationScene}
                height={220}
                accessibilityLabel={`Illustration for ${step.title}`}
              />
            </View>
          ) : step.id === 'language' ? (
            <View style={styles.mascotWrap}>
              <Mascot expression="happy" size={140} framed />
            </View>
          ) : (
            <View style={[styles.emojiBubble, { backgroundColor: visualToneBg(visual.tone) }]}>
              <Text style={styles.emoji}>{visual.emoji}</Text>
            </View>
          )}
          <Text style={styles.heroTitle}>{step.title}</Text>
          <Text style={styles.heroBody}>{step.body}</Text>

          {step.id === 'language' && (
            <View style={styles.chipRow}>
              {(['en', 'vi', 'tl'] as const).map(lang => (
                <Chip
                  key={lang}
                  label={LANGUAGE_LABELS[lang]}
                  selected={state.language === lang}
                  onPress={() => setState(selectLearnerLanguage(state, lang))}
                />
              ))}
            </View>
          )}
        </Card>

        <Button label={step.cta} onPress={next} variant="primary" iconRight="arrow-right" />

        <View style={styles.dotsRow}>
          {STEP_ORDER.map((id, idx) => (
            <View
              key={id}
              style={[styles.dot, idx <= stepIndex(state.currentStepId as OnboardingStepId) && styles.dotActive]}
            />
          ))}
        </View>
      </View>
    </ScreenScaffold>
  );
}

const LANGUAGE_LABELS = { en: 'English', vi: 'Tiếng Việt', tl: 'Filipino' } as const;
const STEP_ORDER: OnboardingStepId[] = ['welcome', 'language', 'workplace-goal', 'daily-habit'];

function stepIndex(id: OnboardingStepId): number {
  return STEP_ORDER.indexOf(id);
}

function visualToneBg(tone: 'brand' | 'warm' | 'success' | 'info'): string {
  switch (tone) {
    case 'warm':    return ds.colors.warmSoft;
    case 'success': return ds.colors.successSoft;
    case 'info':    return ds.colors.infoSoft;
    default:        return ds.colors.brandSoft;
  }
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: ds.spacing.lg,
    paddingBottom: ds.spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: ds.spacing.xs,
    marginBottom: ds.spacing.xs,
    paddingTop: ds.spacing.sm,
  },
  brandEmoji: { fontSize: 22, fontWeight: '900', color: ds.colors.brand },
  brandName: { fontSize: 18, fontWeight: '900', color: ds.colors.text },
  hero: { paddingVertical: ds.spacing.lg, gap: ds.spacing.md, backgroundColor: ds.colors.surface },
  emojiBubble: {
    width: 88, height: 88, borderRadius: 44, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 44 },
  illustrationWrap: { alignItems: 'center', marginVertical: ds.spacing.xs },
  mascotWrap: { alignItems: 'center', marginVertical: ds.spacing.xs },
  heroTitle: { fontSize: ds.type.display - 2, fontWeight: '900', color: ds.colors.text, textAlign: 'center', flexShrink: 1 },
  heroBody: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center', lineHeight: 22, flexShrink: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: ds.spacing.sm, marginTop: ds.spacing.xs },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: ds.spacing.xs, marginTop: ds.spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ds.colors.border },
  dotActive: { backgroundColor: ds.colors.brand, width: 24 },
});

// referenced to keep tree-shake honest; Icon is re-exported by other modules but kept here for future use
export type { IconName } from '../components/Icon';
