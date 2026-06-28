import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View, Image, type ImageSourcePropType } from 'react-native';
import { Icon } from './Icon';
import { ds } from '../theme/designSystem';
import { getAsset } from '../assets/assetRequireMap';

export interface JishoLinkProps {
  japanese: string;
  /** 'compact' = inline pill (logo only); 'full' = full row with helper text; 'corner' = bottom-right corner badge for cards. */
  variant?: 'compact' | 'full' | 'corner';
  testID?: string;
}

/**
 * Builds a Jisho.org search URL for the given Japanese phrase and opens it in
 * the device's default browser. On native, this switches the user out of the
 * app to Jisho.org where they can self-verify the dictionary entry, example
 * sentences, and JLPT level.
 *
 * No external API call is made from inside the app — we just hand off to a
 * tool the learner can use themselves.
 */
export function JishoLink({ japanese, variant = 'compact', testID }: JishoLinkProps) {
  const url = `https://jisho.org/search/${encodeURIComponent(japanese)}`;
  const logoSource = getAsset('jisho.logo') as unknown as ImageSourcePropType;
  const a11yLabel = `Look up ${japanese} on Jisho.org`;

  async function open() {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Cannot open browser', `Jisho link: ${url}`);
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[JishoLink] failed to open URL', err);
      Alert.alert('Cannot open browser', `Jisho link: ${url}`);
    }
  }

  if (variant === 'corner') {
    // Bottom-right corner badge — logo + label, sits on top of a card.
    // The parent card's flip Pressable must NOT receive this tap.
    return (
      <Pressable
        onPress={open}
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        style={({ pressed }) => [styles.cornerBadge, { opacity: pressed ? 0.7 : 1 }]}
        testID={testID}
        accessibilityRole="link"
        accessibilityLabel={a11yLabel}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Image source={logoSource} style={styles.cornerLogo} resizeMode="contain" />
        <Text style={styles.cornerLabel}>Jisho</Text>
      </Pressable>
    );
  }

  if (variant === 'full') {
    return (
      <Pressable
        onPress={open}
        style={({ pressed }) => [styles.fullRow, { opacity: pressed ? 0.7 : 1 }]}
        testID={testID}
        accessibilityRole="link"
        accessibilityLabel={a11yLabel}
      >
        <Image source={logoSource} style={styles.fullLogo} resizeMode="contain" />
        <Text style={styles.fullText}>Look up on Jisho.org</Text>
        <Icon name="external-link" size={16} />
      </Pressable>
    );
  }

  // Compact inline pill — logo + label.
  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.pill, { opacity: pressed ? 0.7 : 1 }]}
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={a11yLabel}
      hitSlop={8}
    >
      <Image source={logoSource} style={styles.pillLogo} resizeMode="contain" />
      <Text style={styles.pillText}>Jisho</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Compact inline pill (used on lesson list items and category rows)
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: ds.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.colors.primary,
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
  },
  pillLogo: {
    width: 14,
    height: 14,
  },
  pillText: {
    fontSize: ds.type.micro,
    fontWeight: '800',
    color: ds.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  // Full row (used in the Flashcards "Card info" disclosure)
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.spacing.xs,
    paddingVertical: ds.spacing.xs,
    paddingHorizontal: ds.spacing.sm,
    borderRadius: ds.radius.sm,
    backgroundColor: ds.colors.brandSoft,
    alignSelf: 'flex-start',
  },
  fullLogo: {
    width: 20,
    height: 20,
  },
  fullText: {
    fontSize: ds.type.caption,
    fontWeight: '800',
    color: ds.colors.primary,
  },
  // Corner badge — a row of logo + label. The PARENT container (FlipCard's
  // cornerBadgeSlot) handles absolute positioning. This style just shapes
  // the pill itself. Shadow/elevation are omitted because the FlipCard
  // shell uses overflow: hidden which clips them.
  cornerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: ds.radius.sm,
    backgroundColor: ds.colors.surface,
    borderWidth: 1,
    borderColor: ds.colors.primary,
  },
  cornerLogo: {
    width: 18,
    height: 18,
  },
  cornerLabel: {
    fontSize: ds.type.micro,
    fontWeight: '900',
    color: ds.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
