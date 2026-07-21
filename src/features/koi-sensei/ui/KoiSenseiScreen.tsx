import React from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { ScreenScaffold } from '../../../components/ScreenScaffold';
import { ds } from '../../../theme/designSystem';
import type { LearnerLanguage } from '../../../types/onboarding';
import { useKoiSenseiContext } from '../KoiSenseiContext';
import { trackKoiEvent } from '../analytics';
import {
  createDefaultKoiProgression,
  getKoiEffectProfile,
  getKoiRankStars,
  getKoiUnlockedCosmetics,
  type KoiEffectProfile,
  type KoiProgressionStateV1,
} from '../domain';
import {
  KoiCarePanel,
  KoiClosetPanel,
  KoiDojoPanel,
  KoiLeaguePanel,
  KoiSettingsPanel,
} from './KoiExperiencePanels';
import { KoiChatPanel } from './KoiChatPanel';
import { KoiAvatarStage } from './KoiAvatarStage';
import { KoiRankEffectLayer } from './KoiRankEffectLayer';

export type KoiHubRoute = 'home' | 'chat' | 'care' | 'closet' | 'dojo' | 'league' | 'settings';

export interface KoiSenseiScreenProps {
  supportLanguage: LearnerLanguage;
  onBack: () => void;
}

const ROUTES: ReadonlyArray<{ id: Exclude<KoiHubRoute, 'home'>; label: string; description: string }> = [
  { id: 'chat', label: 'Talk', description: 'Ask Japanese-learning questions' },
  { id: 'dojo', label: 'Vocab Dojo', description: 'Practice due and weak words' },
  { id: 'care', label: 'Care', description: 'Build a calm, non-decaying bond' },
  { id: 'closet', label: 'Closet', description: 'Wear mastery-earned items' },
  { id: 'league', label: 'League', description: 'Join a gentle study cohort' },
  { id: 'settings', label: 'Settings', description: 'Voice, motion, data, and account' },
];

const ROUTE_TITLES: Record<KoiHubRoute, string> = {
  home: 'Koi Sensei',
  chat: 'Talk with Koi',
  care: 'Care',
  closet: 'Mastery Closet',
  dojo: 'Vocab Dojo',
  league: 'Weekly League',
  settings: 'Koi Settings',
};

export function KoiSenseiScreen({ supportLanguage, onBack }: KoiSenseiScreenProps) {
  const [route, setRoute] = React.useState<KoiHubRoute>('home');
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const trackedOpen = React.useRef(false);
  const koi = useKoiSenseiContext();
  const progression = koi.state?.petSnapshot?.progression ?? createDefaultKoiProgression();
  const rank = progression.currentRank;
  const stars = getKoiRankStars(progression);
  const effect = getKoiEffectProfile(rank, stars, {
    effectPreference: koi.state?.preferences.effectPreference ?? 'full',
    avatarMode: koi.state?.preferences.avatarMode ?? '3d',
    reducedMotion,
    lowPowerMode: false,
  });

  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  React.useEffect(() => {
    if (trackedOpen.current) return;
    trackedOpen.current = true;
    trackKoiEvent('koi_hub_opened', {
      rank,
      stars,
      avatar_mode: koi.state?.preferences.avatarMode ?? '3d',
      effect_mode: effect.renderMode,
    });
  }, [effect.renderMode, koi.state?.preferences.avatarMode, rank, stars]);

  const openRoute = React.useCallback((nextRoute: KoiHubRoute) => {
    if (nextRoute !== 'home') {
      trackKoiEvent('koi_feature_opened', { feature: nextRoute });
    }
    setRoute(nextRoute);
  }, []);

  const goBack = React.useCallback(() => {
    if (route === 'home') onBack();
    else setRoute('home');
  }, [onBack, route]);

  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]);

  if (route === 'chat') {
    return <KoiChatPanel onBack={goBack} />;
  }

  return (
    <ScreenScaffold>
      <ScreenHeader
        title="Koi Sensei"
        subtitle={route === 'home' ? 'Your Japanese training companion' : ROUTE_TITLES[route]}
        onBack={goBack}
      />
      {route === 'home' ? (
        <KoiHubHome
          effect={effect}
          progression={progression}
          avatarMode={koi.state?.preferences.avatarMode ?? '3d'}
          reducedMotion={reducedMotion}
          equippedCosmeticIds={koi.state?.petSnapshot?.equippedCosmeticIds ?? {}}
          supportLanguage={supportLanguage}
          runtimeStage={koi.runtimeStage}
          onOpen={openRoute}
        />
      ) : (
        <KoiFeaturePanel route={route} />
      )}
    </ScreenScaffold>
  );
}

function KoiHubHome({
  effect,
  progression,
  avatarMode,
  reducedMotion,
  equippedCosmeticIds,
  supportLanguage,
  runtimeStage,
  onOpen,
}: {
  effect: KoiEffectProfile;
  progression: KoiProgressionStateV1;
  avatarMode: '3d' | '2d';
  reducedMotion: boolean;
  equippedCosmeticIds: Partial<Record<'crest' | 'face' | 'back' | 'hand', string>>;
  supportLanguage: LearnerLanguage;
  runtimeStage: 'mock' | 'development' | 'staging' | 'production';
  onOpen: (route: KoiHubRoute) => void;
}) {
  const rank = progression.currentRank;
  const stars = getKoiRankStars(progression);
  const starText = `${'★'.repeat(stars)}${'☆'.repeat(8 - stars)}`;
  const unlockedCount = getKoiUnlockedCosmetics(progression).length;
  return (
    <>
      <Card tone="brand" shadow="hero" style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View
            style={[styles.avatarFrame, { borderColor: effect.theme.primaryColor }]}
          >
            <KoiRankEffectLayer profile={effect} />
            <View style={styles.avatarMascot}>
              <KoiAvatarStage
                avatarMode={avatarMode}
                reducedMotion={reducedMotion}
                lowPowerMode={false}
                equippedCosmeticIds={equippedCosmeticIds}
                expression="happy"
                effectDescription={`${effect.theme.label} ${effect.renderMode === 'animated' ? 'effect' : 'rank frame'}`}
              />
            </View>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>KOI TRAINING PATH</Text>
            <Text style={styles.heroTitle}>{rank} · {stars} of 8 stars</Text>
            <Text style={styles.heroSubtitle}>Practice and mastery stars never disappear.</Text>
            <Text accessibilityLabel={`${stars} of 8 stars earned`} style={styles.stars}>{starText}</Text>
            <Text style={styles.effectLabel}>{effect.theme.staticDescription} · {unlockedCount}/24 cosmetics</Text>
          </View>
        </View>
      </Card>

      <Card tone="soft" shadow="none" style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>
          {runtimeStage === 'mock' ? 'Koi v2 local preview' : 'Koi personal live mode'}
        </Text>
        <Text style={styles.noticeText}>
          {runtimeStage === 'mock'
            ? 'Care, the mastery closet, dojo, league preview, and privacy controls work locally without contacting MiniMax.'
            : 'Your course stays local by default. Secure account sync and your MiniMax Token Plan power Koi chat; detailed progress is shared only if you turn it on.'}
        </Text>
      </Card>

      <View style={styles.primaryActions}>
        <Button
          label="Talk with Koi"
          icon="chat"
          onPress={() => onOpen('chat')}
          testID="koi-open-chat"
        />
        <Button
          label="Start Vocab Dojo"
          icon="practice"
          variant="secondary"
          onPress={() => onOpen('dojo')}
          testID="koi-open-dojo"
        />
      </View>

      <View style={styles.routeGrid}>
        {ROUTES.filter(item => item.id !== 'chat' && item.id !== 'dojo').map(item => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}. ${item.description}`}
            onPress={() => onOpen(item.id)}
            style={({ pressed }) => [styles.routeCard, pressed && styles.pressed]}
          >
            <Text style={styles.routeTitle}>{item.label}</Text>
            <Text style={styles.routeDescription}>{item.description}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.footnote}>
        Support language: {supportLanguage.toUpperCase()} · Koi ranks track in-app practice, not JLPT certification.
      </Text>
    </>
  );
}

function KoiFeaturePanel({ route }: { route: Exclude<KoiHubRoute, 'home' | 'chat'> }) {
  if (route === 'care') return <KoiCarePanel />;
  if (route === 'closet') return <KoiClosetPanel />;
  if (route === 'dojo') return <KoiDojoPanel />;
  if (route === 'league') return <KoiLeaguePanel />;
  return <KoiSettingsPanel />;
}

const styles = StyleSheet.create({
  heroCard: { padding: ds.spacing.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.md },
  avatarFrame: {
    width: 120,
    height: 148,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ds.radius.xl,
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  avatarMascot: { zIndex: 1, width: '100%', height: '100%' },
  heroCopy: { flex: 1, minWidth: 0, gap: ds.spacing.xs },
  eyebrow: { color: ds.colors.warmSoft, fontSize: ds.type.micro, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { color: ds.colors.brandInk, fontSize: ds.type.title, fontWeight: '900' },
  heroSubtitle: { color: ds.colors.brandInk, fontSize: ds.type.caption, lineHeight: 18, opacity: 0.9 },
  stars: { color: '#FFE082', fontSize: 23, letterSpacing: 1 },
  effectLabel: { color: ds.colors.brandInk, fontSize: ds.type.micro, lineHeight: 16, opacity: 0.88 },
  noticeCard: { gap: ds.spacing.xs },
  noticeTitle: { color: ds.colors.brandDark, fontSize: ds.type.caption, fontWeight: '900' },
  noticeText: { color: ds.colors.textMuted, fontSize: ds.type.caption, lineHeight: 19 },
  primaryActions: { gap: ds.spacing.sm },
  routeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm },
  routeCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 108,
    borderRadius: ds.radius.lg,
    padding: ds.spacing.md,
    justifyContent: 'center',
    gap: ds.spacing.xs,
    backgroundColor: ds.colors.surface,
    ...ds.shadow.card,
  },
  pressed: { opacity: 0.86 },
  routeTitle: { color: ds.colors.text, fontSize: ds.type.heading, fontWeight: '900' },
  routeDescription: { color: ds.colors.textMuted, fontSize: ds.type.caption, lineHeight: 18 },
  footnote: { color: ds.colors.textMuted, fontSize: ds.type.micro, lineHeight: 16, textAlign: 'center' },
});
