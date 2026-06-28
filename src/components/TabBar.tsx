import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ds } from '../theme/designSystem';
import { TabIcon, type TabIconKey } from './TabIcon';
import type { AppTab } from '../types/navigation';

export interface TabBarItem {
  id: AppTab;
  label: string;
  icon: TabIconKey;
}

export interface TabBarProps {
  items: TabBarItem[];
  activeId: AppTab;
  onSelect: (id: AppTab) => void;
}

export function TabBar({ items, activeId, onSelect }: TabBarProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.shell}>
        {items.map(item => {
          const active = item.id === activeId;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id)}
              style={({ pressed }) => [
                styles.tab,
                active && styles.tabActive,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <TabIcon icon={item.icon} size={26} active={active} />
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: ds.colors.background },
  shell: {
    flexDirection: 'row',
    backgroundColor: ds.colors.background,
    borderTopWidth: 1,
    borderTopColor: ds.colors.border,
    paddingHorizontal: ds.spacing.xs,
    paddingTop: ds.spacing.xs,
    paddingBottom: ds.spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: ds.touch.comfortable,
    paddingVertical: ds.spacing.xs,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ds.radius.md,
    gap: ds.spacing.xs,
  },
  tabActive: { backgroundColor: ds.colors.brandSoft },
  label: { fontSize: 11, fontWeight: '800', color: ds.colors.textMuted, maxWidth: '100%' },
  labelActive: { color: ds.colors.brandDark },
});