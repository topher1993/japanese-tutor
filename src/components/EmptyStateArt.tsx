/**
 * EmptyStateArt — illustrated empty-state art for Home / Lessons / Progress
 * plus the Phase 45 Tier-2 keys (flashcards / quiz / survival).
 */
import React from 'react';
import { Image, View, StyleSheet, ImageStyle } from 'react-native';
import { getAsset } from '../assets/assetRequireMap';

export type EmptyStateKey = 'home' | 'lessons' | 'progress' | 'flashcards' | 'quiz' | 'survival';

const KEY_TO_ASSET: Record<EmptyStateKey, Parameters<typeof getAsset>[0]> = {
  home: 'emptyState.home',
  lessons: 'emptyState.lessons',
  progress: 'emptyState.progress',
  flashcards: 'emptyState.flashcards',
  quiz: 'emptyState.quiz',
  survival: 'emptyState.survival',
};

export interface EmptyStateArtProps {
  screen: EmptyStateKey;
  size?: number;
  style?: ImageStyle;
}

export function EmptyStateArt({ screen, size = 200, style }: EmptyStateArtProps) {
  const source = getAsset(KEY_TO_ASSET[screen]);
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        source={source}
        style={[styles.img, style]}
        resizeMode="contain"
        accessibilityLabel={`${screen} empty state illustration`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
});