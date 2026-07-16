import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Mascot, type MascotExpression } from '../../../components/Mascot';
import { ds } from '../../../theme/designSystem';
import type { KoiAvatarMode, KoiCosmeticSlot } from '../domain';
import {
  KOI_AVATAR_PLACEHOLDER_MANIFEST,
  selectKoiAvatarRenderPlan,
} from '../media';
import { getKoiEquippedCosmeticVisuals } from './avatarCosmeticVisuals';

const LazyKoiAvatarThreeStage = React.lazy(async () => {
  const module = await import('./KoiAvatarThreeStage');
  return { default: module.KoiAvatarThreeStage };
});

export interface KoiAvatarStageProps {
  avatarMode: KoiAvatarMode;
  reducedMotion: boolean;
  lowPowerMode: boolean;
  equippedCosmeticIds: Partial<Record<KoiCosmeticSlot, string>>;
  expression?: MascotExpression;
  effectDescription?: string;
}

interface KoiAvatarBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError: () => void;
}

interface KoiAvatarBoundaryState {
  failed: boolean;
}

class KoiAvatarBoundary extends React.Component<KoiAvatarBoundaryProps, KoiAvatarBoundaryState> {
  state: KoiAvatarBoundaryState = { failed: false };

  static getDerivedStateFromError(): KoiAvatarBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function supportsWebGl(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof globalThis === 'object' && 'WebGLRenderingContext' in globalThis;
}

function KoiAvatarTwoDimensional({
  equippedCosmeticIds,
  expression,
}: Pick<KoiAvatarStageProps, 'equippedCosmeticIds' | 'expression'>) {
  const visuals = getKoiEquippedCosmeticVisuals(equippedCosmeticIds);
  return (
    <View pointerEvents="none" style={styles.twoDimensionalStage} testID="koi-avatar-2d">
      <Mascot expression={expression ?? 'happy'} size={104} />
      {visuals.map(visual => (
        <View
          key={visual.slot}
          accessible={false}
          style={[
            styles.cosmeticMarker,
            styles[`${visual.slot}Marker`],
            { backgroundColor: visual.color },
          ]}
          testID={`koi-avatar-cosmetic-${visual.slot}`}
        >
          <Text style={styles.cosmeticSymbol}>{visual.symbol}</Text>
        </View>
      ))}
    </View>
  );
}

export function KoiAvatarStage({
  avatarMode,
  reducedMotion,
  lowPowerMode,
  equippedCosmeticIds,
  expression = 'happy',
  effectDescription,
}: KoiAvatarStageProps) {
  const [rendererFailed, setRendererFailed] = React.useState(false);
  React.useEffect(() => setRendererFailed(false), [avatarMode]);

  const plan = selectKoiAvatarRenderPlan({
    preferredMode: avatarMode,
    reducedMotion,
    lowPowerMode,
    webGlAvailable: supportsWebGl(),
    assetStatus: rendererFailed ? 'failed' : 'ready',
    manifest: KOI_AVATAR_PLACEHOLDER_MANIFEST,
    fallback2dAvailable: true,
  });
  const visuals = getKoiEquippedCosmeticVisuals(equippedCosmeticIds);
  const outfit = visuals.length > 0
    ? ` Wearing ${visuals.map(item => item.label).join(', ')}.`
    : '';
  const effect = effectDescription ? ` ${effectDescription}.` : '';
  const fallback = (
    <KoiAvatarTwoDimensional
      equippedCosmeticIds={equippedCosmeticIds}
      expression={expression}
    />
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${plan.accessibilityLabel}.${effect}${outfit}`}
      style={styles.stage}
      testID={`koi-avatar-${plan.renderer}`}
    >
      {plan.renderer === '3d' ? (
        <KoiAvatarBoundary fallback={fallback} onError={() => setRendererFailed(true)}>
          <React.Suspense fallback={fallback}>
            <LazyKoiAvatarThreeStage
              equippedCosmeticIds={equippedCosmeticIds}
              expression={expression}
            />
          </React.Suspense>
        </KoiAvatarBoundary>
      ) : fallback}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  twoDimensionalStage: { width: 112, height: 132, alignItems: 'center', justifyContent: 'center' },
  cosmeticMarker: {
    position: 'absolute',
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: ds.colors.brandInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cosmeticSymbol: { color: ds.colors.brandDark, fontSize: 13, fontWeight: '900' },
  crestMarker: { top: 4, left: 42 },
  faceMarker: { top: 43, right: 7 },
  backMarker: { top: 48, left: 0 },
  handMarker: { bottom: 6, right: 13 },
});
