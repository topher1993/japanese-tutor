import React from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import type { MascotExpression } from '../../../components/Mascot';
import { ds } from '../../../theme/designSystem';
import type { KoiAvatarMode, KoiCosmeticSlot } from '../domain';
import {
  KOI_AVATAR_PLACEHOLDER_MANIFEST,
  selectKoiAvatarRenderPlan,
} from '../media';
import { getKoiEquippedCosmeticVisuals } from './avatarCosmeticVisuals';
import { KoiPet } from './KoiPet';

export interface KoiAvatarStageProps {
  avatarMode: KoiAvatarMode;
  reducedMotion: boolean;
  lowPowerMode: boolean;
  equippedCosmeticIds: Partial<Record<KoiCosmeticSlot, string>>;
  expression?: MascotExpression;
  effectDescription?: string;
}

function KoiAvatarTwoDimensional({
  equippedCosmeticIds,
  expression,
}: Pick<KoiAvatarStageProps, 'equippedCosmeticIds' | 'expression'>) {
  const visuals = getKoiEquippedCosmeticVisuals(equippedCosmeticIds);
  return (
    <View pointerEvents="none" style={styles.twoDimensionalStage} testID="koi-avatar-2d">
      <KoiPet accessible={false} expression={expression ?? 'happy'} size={118} />
      {visuals.map(visual => {
        if (visual.primitive === 'glasses') {
          return (
            <View key={visual.slot} accessible={false} style={styles.faceEquipment} testID={`koi-avatar-cosmetic-${visual.slot}`}>
              <View style={[styles.lens, { borderColor: visual.color }]} />
              <View style={[styles.glassesBridge, { backgroundColor: visual.color }]} />
              <View style={[styles.lens, { borderColor: visual.color }]} />
            </View>
          );
        }
        return (
          <View
            key={visual.slot}
            accessible={false}
            style={[
              styles.cosmeticPiece,
              styles[`${visual.slot}Equipment`],
              { backgroundColor: visual.color },
            ]}
            testID={`koi-avatar-cosmetic-${visual.slot}`}
          >
            <Text style={styles.cosmeticSymbol}>{visual.symbol}</Text>
          </View>
        );
      })}
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
  const motionDisabled = reducedMotion || avatarMode === '2d';
  const useNativeDriver = Platform.OS !== 'web';
  const entrance = React.useRef(new Animated.Value(motionDisabled ? 1 : 0)).current;
  const floatOffset = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    entrance.stopAnimation();
    floatOffset.stopAnimation();
    if (motionDisabled) {
      entrance.setValue(1);
      floatOffset.setValue(0);
      return undefined;
    }

    entrance.setValue(0);
    floatOffset.setValue(0);
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(floatOffset, {
        toValue: -7,
        duration: 1_650,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver,
      }),
      Animated.timing(floatOffset, {
        toValue: 5,
        duration: 1_650,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver,
      }),
    ]));
    const entranceAnimation = Animated.spring(entrance, {
      toValue: 1,
      damping: 13,
      stiffness: 115,
      mass: 0.85,
      useNativeDriver,
    });
    entranceAnimation.start(({ finished }) => {
      if (finished) floatLoop.start();
    });
    return () => {
      entranceAnimation.stop();
      floatLoop.stop();
    };
  }, [entrance, floatOffset, motionDisabled, useNativeDriver]);

  const plan = selectKoiAvatarRenderPlan({
    preferredMode: avatarMode,
    reducedMotion,
    lowPowerMode,
    webGlAvailable: false,
    // The bundled GLB is an engineering contract, not production character
    // art. Never surface its old fish-like placeholder as the user's pet.
    assetStatus: 'missing',
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
      <Animated.View
        style={[
          styles.animatedPet,
          {
            opacity: entrance,
            transform: [
              { translateY: Animated.add(entrance.interpolate({ inputRange: [0, 1], outputRange: [92, 0] }), floatOffset) },
              { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) },
            ],
          },
        ]}
      >
        {fallback}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  animatedPet: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  twoDimensionalStage: { width: 132, height: 146, alignItems: 'center', justifyContent: 'center' },
  cosmeticPiece: {
    position: 'absolute',
    minWidth: 30,
    minHeight: 26,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ds.colors.brandInk,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOpacity: 0.28,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cosmeticSymbol: { color: ds.colors.brandDark, fontSize: 14, fontWeight: '900' },
  crestEquipment: { top: 5, left: 49, width: 38, height: 25, borderRadius: 13 },
  backEquipment: { top: 70, left: 0, width: 35, height: 42, borderRadius: 12, transform: [{ rotate: '-8deg' }] },
  handEquipment: { bottom: 11, right: 8, width: 28, height: 50, borderRadius: 10, transform: [{ rotate: '-18deg' }] },
  faceEquipment: {
    position: 'absolute',
    top: 47,
    left: 42,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 4,
  },
  lens: { width: 24, height: 18, borderWidth: 3, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.16)' },
  glassesBridge: { width: 8, height: 3 },
});
