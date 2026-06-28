/**
 * Illustration component — renders onboarding-scene illustrations.
 *
 * Source PNGs are portrait 1024x1536. We preserve native aspect ratio so
 * the chibi is never cropped, and cap the rendered height via maxHeight
 * so the full illustration (including bottom kanji cards) fits within the
 * available card area without being cut off by the viewport.
 */
import React from 'react';
import { Image, View, StyleSheet, ImageStyle, AccessibilityProps } from 'react-native';
import { getAsset } from '../assets/assetRequireMap';

export type IllustrationKey = 'welcome' | 'workplace' | 'habit';

// Source PNGs are 1024x1536 portrait — chibi must remain full-body visible
const NATIVE_ASPECT = 1024 / 1536;
const MAX_HEIGHT = 340;  // fits inside the onboarding card with title+body+CTA

const KEY_TO_ASSET: Record<IllustrationKey, Parameters<typeof getAsset>[0]> = {
  welcome: 'onboarding.welcomeFinal',
  workplace: 'onboarding.workplaceFinal',
  habit: 'onboarding.habitFinal',
};

export interface IllustrationProps {
  scene: IllustrationKey;
  width?: number | string;
  height?: number | string;
  style?: ImageStyle;
  accessibilityLabel?: string;
}

export function Illustration({
  scene,
  width: widthProp = '100%',
  style,
  accessibilityLabel,
}: IllustrationProps) {
  const source = getAsset(KEY_TO_ASSET[scene]);
  const a11y: AccessibilityProps = {
    accessibilityLabel: accessibilityLabel ?? `Onboarding illustration: ${scene}`,
    accessibilityRole: 'image',
  };

  // Numeric width drives everything else; a string width ('100%') falls back
  // to a card-width-safe maximum so the chibi is never taller than the card
  // area can show.
  const numericWidth = typeof widthProp === 'number' ? widthProp : MAX_HEIGHT * NATIVE_ASPECT;
  const width = Math.min(numericWidth, MAX_HEIGHT * NATIVE_ASPECT);
  return (
    <View style={[styles.wrap, { width: width as any, aspectRatio: NATIVE_ASPECT, alignSelf: 'center' }]}>
      <Image source={source} style={[styles.img, style]} resizeMode="contain" {...a11y} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  img: { width: '100%', height: '100%' },
});