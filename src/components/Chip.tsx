import { Pressable, StyleSheet, Text } from 'react-native';
import { ds } from '../theme/designSystem';

// Selectable chip — for level filters, topic filters, language pickers.

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'danger' | 'warning';
}

export function Chip({ label, selected = false, onPress, tone = 'default' }: ChipProps) {
  const selectedStyle =
    tone === 'danger'
      ? styles.selectedDanger
      : tone === 'warning'
        ? styles.selectedWarning
        : styles.selected;
  const textSelectedStyle =
    tone === 'danger'
      ? styles.textSelectedDanger
      : tone === 'warning'
        ? styles.textSelectedWarning
        : styles.textSelected;
  return (
    <Pressable
      onPress={onPress}
      accessible={Boolean(onPress)}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? label : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      style={({ pressed }) => [
        styles.base,
        selected ? selectedStyle : styles.unselected,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        style={[styles.text, selected ? textSelectedStyle : styles.textUnselected]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  unselected: { backgroundColor: ds.colors.surface, borderColor: ds.colors.border },
  selected:   { backgroundColor: ds.colors.brand, borderColor: ds.colors.brand },
  selectedDanger: { backgroundColor: ds.colors.danger, borderColor: ds.colors.danger },
  selectedWarning: { backgroundColor: ds.colors.warning, borderColor: ds.colors.warning },
  text: { fontSize: ds.type.caption, fontWeight: '800' },
  textUnselected: { color: ds.colors.text },
  textSelected:   { color: ds.colors.brandInk },
  textSelectedDanger: { color: '#FFFFFF' },
  textSelectedWarning: { color: ds.colors.warningInk },
});
