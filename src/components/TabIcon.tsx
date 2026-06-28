/**
 * TabIcon — small colored icon used in the bottom TabBar.
 *
 * Renders the hand-authored SVG-as-PNG icons. When `active=false`, the icon
 * is dimmed (opacity) to communicate inactive state. Tints are applied via
 * `tintColor` so we can theme the active variant without re-bundling PNGs.
 */
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { getAsset } from '../assets/assetRequireMap';

export type TabIconKey = 'home' | 'lessons' | 'flashcards' | 'quiz' | 'progress';

const KEY_TO_ASSET: Record<TabIconKey, Parameters<typeof getAsset>[0]> = {
  home: 'tabIcon.home',
  lessons: 'tabIcon.lessons',
  flashcards: 'tabIcon.flashcards',
  quiz: 'tabIcon.quiz',
  progress: 'tabIcon.progress',
};

export interface TabIconProps {
  icon: TabIconKey;
  size?: number;
  active?: boolean;
  tintColor?: string;
}

export function TabIcon({ icon, size = 24, active = false, tintColor }: TabIconProps) {
  const source = getAsset(KEY_TO_ASSET[icon]);
  return (
    <Image
      source={source}
      style={[
        { width: size, height: size },
        !active && styles.inactive,
        tintColor ? { tintColor } : null,
      ]}
      resizeMode="contain"
      accessibilityLabel={`${icon} tab icon`}
    />
  );
}

const styles = StyleSheet.create({
  inactive: { opacity: 0.5 },
});