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
  /** Use a compact navigation rail for tablet landscape layouts. */
  variant?: 'bottom' | 'rail';
}

export function TabBar({ items, activeId, onSelect, variant = 'bottom' }: TabBarProps) {
  const isRail = variant === 'rail';
  // Bottom navigation retains the original SafeAreaView edges={['bottom']} contract.
  return (
    <SafeAreaView edges={isRail ? ['left', 'top', 'bottom'] : ['bottom']} style={[styles.safe, isRail && styles.safeRail]}>
      <View style={[styles.shell, isRail && styles.shellRail]}>
        {items.map(item => {
          const active = item.id === activeId;
          return (
            <Pressable
              key={item.id}
              testID={`tab-${item.id.toLowerCase()}`}
              onPress={() => onSelect(item.id)}
              accessibilityRole="tab"
              accessibilityLabel={`${item.label} tab`}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.tab,
                isRail && styles.tabRail,
                active && styles.tabActive,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <TabIcon icon={item.icon} size={26} active={active} />
              <Text style={[styles.label, isRail && styles.labelRail, active && styles.labelActive]} numberOfLines={isRail ? 2 : 1}>
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
  safeRail: { width: 116, flexShrink: 0 },
  shell: {
    flexDirection: 'row',
    backgroundColor: ds.colors.background,
    borderTopWidth: 1,
    borderTopColor: ds.colors.border,
    paddingHorizontal: ds.spacing.xs,
    paddingTop: ds.spacing.xs,
    paddingBottom: ds.spacing.xs,
  },
  shellRail: {
    flex: 1,
    flexDirection: 'column',
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderRightColor: ds.colors.border,
    paddingHorizontal: ds.spacing.sm,
    paddingVertical: ds.spacing.md,
    gap: ds.spacing.sm,
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
  tabRail: { width: '100%', flex: 0, minHeight: 64, paddingVertical: ds.spacing.sm, paddingHorizontal: ds.spacing.xs },
  label: { fontSize: 11, fontWeight: '800', color: ds.colors.textMuted, maxWidth: '100%' },
  labelRail: { textAlign: 'center', lineHeight: 14 },
  labelActive: { color: ds.colors.brandDark },
});
