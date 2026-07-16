/**
 * AppLogo — renders the chibi-samurai "に helmet + にほんご" wordmark.
 *
 * Used in screen headers (small corner mark) and as a centered hero on
 * welcoming / profile screens. Same pattern as Mascot — typed size prop,
 * calls getAsset() with the registered manifest key, falls back gracefully
 * if the asset bundle is missing (returns null in dev/test).
 */
import { Image, StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';
import { getAsset } from '../assets/assetRequireMap';
import { ds } from '../theme/designSystem';

export interface AppLogoProps {
  /** Edge length in points. Default 40 — header-sized. */
  size?: number;
  /** Optional margin around the logo. Default none. */
  style?: ImageStyle;
  /** Container style — useful when centering inside a flex parent. */
  containerStyle?: ViewStyle;
  /** Accessibility label override. */
  accessibilityLabel?: string;
}

export function AppLogo({ size = 40, style, containerStyle, accessibilityLabel }: AppLogoProps) {
  let source: number | null = null;
  try {
    source = getAsset('logo.appLogo');
  } catch {
    // Asset missing in this environment (test fixture, etc.) — render a
    // placeholder so layout doesn't collapse.
    return (
      <View
        style={[
          styles.placeholder,
          { width: size, height: size, borderRadius: ds.radius.md },
          containerStyle,
        ]}
        accessibilityLabel={accessibilityLabel ?? 'App logo placeholder'}
      />
    );
  }

  return (
    <View style={containerStyle}>
      <Image
        source={source}
        style={[{ width: size, height: size }, style]}
        resizeMode="contain"
        accessibilityLabel={accessibilityLabel ?? 'Japanese tutor — にほんご'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: ds.colors.brandSoft,
    borderWidth: 1,
    borderColor: ds.colors.primary,
  },
});
