/**
 * BadgeImage — renders a badge PNG keyed by achievement ID.
 *
 * The badge label text is rendered separately by the screen so this component
 * stays a pure visual square.
 */
import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { getAsset } from '../assets/assetRequireMap';

export type BadgeKey =
  | 'firstLesson'
  | 'streak7'
  | 'streak30'
  | 'firstKanji'
  | 'vocab100'
  | 'levelUp'
  | 'survivalComplete'
  | 'perfectQuiz'
  | 'jlptN5'
  | 'jlptN4';

const KEY_TO_ASSET: Record<BadgeKey, Parameters<typeof getAsset>[0]> = {
  firstLesson: 'badge.firstLesson',
  streak7: 'badge.streak7',
  streak30: 'badge.streak30',
  firstKanji: 'badge.firstKanji',
  vocab100: 'badge.vocab100',
  levelUp: 'badge.levelUp',
  survivalComplete: 'badge.survivalComplete',
  perfectQuiz: 'badge.perfectQuiz',
  jlptN5: 'badge.jlptN5',
  jlptN4: 'badge.jlptN4',
};

export interface BadgeImageProps {
  badge: BadgeKey;
  size?: number;
  /** Dim the badge (when achievement not yet earned) */
  earned?: boolean;
}

export function BadgeImage({ badge, size = 64, earned = true }: BadgeImageProps) {
  const source = getAsset(KEY_TO_ASSET[badge]);
  return (
    <View style={[styles.wrap, { width: size, height: size, opacity: earned ? 1 : 0.35 }]}>
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel={`${badge} badge${earned ? '' : ' (locked)'}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});