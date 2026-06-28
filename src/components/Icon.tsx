import React from 'react';
import { Text, StyleSheet, type TextStyle } from 'react-native';
import { ds } from '../theme/designSystem';

// Lightweight emoji icon set. Avoids adding a vector-icons dependency.
// Each name maps to a single emoji glyph rendered at a consistent size.

export type IconName =
  | 'today'        // 📅
  | 'learn'        // 📚
  | 'practice'     // 🎴
  | 'test'         // ✏️
  | 'progress'     // 📈
  | 'flame'        // 🔥
  | 'star'         // ⭐
  | 'check'        // ✅
  | 'cross'        // ❌
  | 'arrow-right'  // →
  | 'arrow-left'   // ←
  | 'arrow-up'     // ↑
  | 'arrow-down'   // ↓
  | 'chevron-down' // ▾
  | 'chevron-up'   // ▴
  | 'play'         // ▶
  | 'kanji'        // 漢
  | 'chat'         // 💬
  | 'help'         // ❓
  | 'back'         // ←
  | 'more'         // ⋯
  | 'settings'     // ⚙
  | 'feedback'     // 💬
  | 'fire'         // 🔥
  | 'trophy'       // 🏆
  | 'clock'        // ⏱
  | 'heart'        // ❤️
  | 'info'         // ℹ️
  | 'refresh'      // 🔄
  | 'book'         // 📖
  | 'external-link'; // 🔗

const GLYPHS: Record<IconName, string> = {
  'today': '📅',
  'learn': '📚',
  'practice': '🎴',
  'test': '✏️',
  'progress': '📈',
  'flame': '🔥',
  'fire': '🔥',
  'star': '⭐',
  'check': '✅',
  'cross': '❌',
  'arrow-right': '→',
  'arrow-left': '←',
  'arrow-up': '↑',
  'arrow-down': '↓',
  'chevron-down': '▾',
  'chevron-up': '▴',
  'play': '▶',
  'kanji': '漢',
  'chat': '💬',
  'help': '❓',
  'back': '←',
  'more': '⋯',
  'settings': '⚙',
  'feedback': '💬',
  'trophy': '🏆',
  'clock': '⏱',
  'heart': '❤',
  'info': 'ℹ️',
  'refresh': '🔄',
  'book': '📖',
  'external-link': '🔗',
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;     // only applied via style on Text; emoji ignores color but kept for API symmetry
  style?: TextStyle;
}

export function Icon({ name, size = 20, style }: IconProps) {
  return <Text style={[styles.base, { fontSize: size, lineHeight: size + 2 }, style]}>{GLYPHS[name]}</Text>;
}

const styles = StyleSheet.create({
  base: {
    textAlign: 'center',
  },
});
