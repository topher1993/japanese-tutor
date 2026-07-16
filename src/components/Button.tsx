import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ds } from '../theme/designSystem';
import { Icon, type IconName } from './Icon';

// One button component, four variants. Pill shape, big tap target, no surprises.

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  fullWidth = true,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const minHeight = size === 'lg' ? ds.touch.comfortable : ds.touch.min;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border, minHeight, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        fullWidth && styles.full,
        style,
      ]}
    >
      <View style={styles.inner}>
        {icon ? <Icon name={icon} size={size === 'lg' ? 18 : 16} /> : null}
        <Text style={[styles.text, { color: v.text }, size === 'lg' ? styles.textLg : styles.textMd]}>
          {label}
        </Text>
        {iconRight ? <Icon name={iconRight} size={size === 'lg' ? 18 : 16} /> : null}
      </View>
    </Pressable>
  );
}

const VARIANT_STYLES = {
  primary:   { bg: ds.colors.brand,    border: ds.colors.brand,    text: ds.colors.brandInk },
  secondary: { bg: ds.colors.brandSoft, border: ds.colors.brandSoft, text: ds.colors.brandDark },
  soft:      { bg: ds.colors.surface,  border: ds.colors.border,    text: ds.colors.brandDark },
  ghost:     { bg: 'transparent',      border: 'transparent',        text: ds.colors.brandDark },
  danger:    { bg: ds.colors.danger,   border: ds.colors.danger,     text: '#fff' },
} as const;

const styles = StyleSheet.create({
  base: {
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    paddingHorizontal: ds.spacing.lg,
    paddingVertical: ds.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ds.spacing.sm },
  text: { fontWeight: '900', textAlign: 'center' },
  textLg: { fontSize: 16 },
  textMd: { fontSize: 14 },
});
