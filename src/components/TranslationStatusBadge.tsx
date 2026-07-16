import { StyleSheet, Text, View } from 'react-native';
import type { LearnerLanguage } from '../types/onboarding';
import { ds } from '../theme/designSystem';

export type TranslationReviewStatus = 'approved' | 'draft';

export interface TranslationStatusBadgeProps {
  status: TranslationReviewStatus;
  supportLanguage?: LearnerLanguage;
  compact?: boolean;
}

/**
 * Visual indicator for phrases whose translations have not been reviewed by a
 * native speaker yet. Renders nothing for 'approved' status so callers can
 * use it unconditionally.
 */
export function TranslationStatusBadge({ status, supportLanguage, compact }: TranslationStatusBadgeProps) {
  if (status !== 'draft') return null;
  const label =
    supportLanguage === 'vi' ? 'Bản nháp' :
    supportLanguage === 'tl' ? 'Draft' :
    'Draft — pending review';
  return (
    <View style={[styles.badge, compact ? styles.badgeCompact : null]}>
      <Text style={[styles.text, compact ? styles.textCompact : null]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: ds.colors.warning,
    paddingHorizontal: ds.spacing.sm,
    paddingVertical: ds.spacing.xs,
    borderRadius: ds.radius.sm,
  },
  badgeCompact: {
    paddingHorizontal: ds.spacing.xs + 2,
    paddingVertical: 2,
  },
  text: {
    fontSize: ds.type.micro,
    fontWeight: '900',
    color: ds.colors.warningInk,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  textCompact: {
    fontSize: 10,
  },
});
