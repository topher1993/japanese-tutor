import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { KoiEffectProfile } from '../domain';
import { getKoiEffectDecorations } from './koiEffectDecorations';

export { getKoiEffectDecorations } from './koiEffectDecorations';

export function KoiRankEffectLayer({ profile }: { profile: KoiEffectProfile }) {
  const pulse = React.useRef(new Animated.Value(0)).current;
  const decorations = React.useMemo(() => getKoiEffectDecorations(profile), [profile]);

  React.useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (profile.renderMode !== 'animated') return undefined;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1_800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1_800, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [profile.renderMode, pulse]);

  if (decorations.length === 0) return null;
  const animatedStyle = profile.renderMode === 'animated'
    ? {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.9] }),
        transform: [{ translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [2, -3] }) }],
      }
    : { opacity: 0.62 };

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.layer, animatedStyle]}
      testID={`koi-effect-${profile.theme.id}`}
    >
      {decorations.map(decoration => (
        <View
          key={decoration.id}
          style={[
            styles.decoration,
            decoration.position,
            {
              width: decoration.size,
              height: decoration.shape === 'ring' ? Math.max(5, decoration.size * 0.45) : decoration.size,
              borderColor: decoration.color,
              backgroundColor: decoration.shape === 'ring' || decoration.shape === 'scale'
                ? 'transparent'
                : decoration.color,
              borderRadius: decoration.shape === 'mote' || decoration.shape === 'petal' ? 3 : 999,
              transform: [{ rotate: `${decoration.rotation}deg` }],
            },
            decoration.shape === 'ring' && styles.ring,
            decoration.shape === 'mote' && styles.mote,
            decoration.shape === 'petal' && styles.petal,
            decoration.shape === 'moon' && styles.moon,
            decoration.shape === 'scale' && styles.scale,
          ]}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 0 },
  decoration: { position: 'absolute' },
  ring: { borderWidth: 2 },
  mote: { opacity: 0.72, borderWidth: 1, borderColor: '#D9E3EA' },
  petal: { opacity: 0.78, borderTopLeftRadius: 999, borderBottomRightRadius: 999 },
  moon: { opacity: 0.34, borderWidth: 2, backgroundColor: 'transparent' },
  scale: { opacity: 0.7, borderWidth: 2 },
});
