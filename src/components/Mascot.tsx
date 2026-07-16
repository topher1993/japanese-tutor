/**
 * Mascot component — renders Kō (the chibi samurai) in one of 5 expressions.
 *
 * Uses require() via assetRequireMap so the bundler can include the PNG.
 * Falls back to the base mascot if the requested expression isn't found.
 *
 * IMPORTANT: The source PNGs are portrait (1024×1536, 2:3 aspect ratio).
 * We render the image at `size × size * 1.5` and use `resizeMode="contain"`
 * so the full illustration fits without clipping. If you pass a `size`, you
 * get a portrait box; don't try to force a square — that crops the helmet.
 */
import { Image, View, StyleSheet, ImageStyle } from 'react-native';
import { getAsset } from '../assets/assetRequireMap';
import { ds } from '../theme/designSystem';

export type MascotExpression = 'base' | 'happy' | 'thinking' | 'celebrate' | 'encourage';

const EXPRESSION_KEY: Record<MascotExpression, Parameters<typeof getAsset>[0]> = {
  base: 'mascot.basePng',
  happy: 'mascot.happyPng',
  thinking: 'mascot.thinkingPng',
  celebrate: 'mascot.celebratePng',
  encourage: 'mascot.encouragePng',
};

export interface MascotProps {
  expression?: MascotExpression;
  size?: number;
  style?: ImageStyle;
  /** Show a soft circular background behind the mascot */
  framed?: boolean;
}

export function Mascot({ expression = 'base', size = 96, style, framed = false }: MascotProps) {
  const source = getAsset(EXPRESSION_KEY[expression]);
  const height = Math.round(size * 1.5);

  if (framed) {
    const frameSize = size + 16;
    const frameHeight = frameSize + 24; // taller than wide, matching portrait
    return (
      <View
        style={[
          styles.frame,
          {
            width: frameSize,
            height: frameHeight,
            borderRadius: frameSize / 2,
          },
        ]}
      >
        <Image
          source={source}
          style={[{ width: frameSize, height: frameSize * 1.5 }, style]}
          resizeMode="contain"
          accessibilityLabel={`Koi Sensei expressing ${expression}`}
        />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[{ width: size, height }, style]}
      resizeMode="contain"
      accessibilityLabel={`Koi Sensei expressing ${expression}`}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: ds.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
