import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { getAsset } from '../../../assets/assetRequireMap';
import type { MascotExpression } from '../../../components/Mascot';

export interface KoiPetProps {
  expression?: MascotExpression;
  size?: number;
  accessible?: boolean;
  style?: StyleProp<ImageStyle>;
}

const EXPRESSION_TRANSFORM: Record<MascotExpression, ImageStyle['transform']> = {
  base: [{ rotate: '0deg' }],
  happy: [{ scale: 1.02 }],
  thinking: [{ rotate: '-3deg' }, { scale: 0.98 }],
  celebrate: [{ rotate: '3deg' }, { scale: 1.06 }],
  encourage: [{ rotate: '-2deg' }, { scale: 1.01 }],
};

/** Koi's production 2D identity: a magical tanuki virtual pet, never a fish. */
export function KoiPet({
  expression = 'happy',
  size = 96,
  accessible = true,
  style,
}: KoiPetProps) {
  return (
    <View style={[styles.frame, { width: size, height: Math.round(size * 1.13) }]}>
      <Image
        accessible={accessible}
        accessibilityLabel={`Koi, your cheerful tanuki companion, looking ${expression}`}
        resizeMode="contain"
        source={getAsset('avatar.koiTanukiPng')}
        style={[
          styles.image,
          { width: size, height: Math.round(size * 1.13), transform: EXPRESSION_TRANSFORM[expression] },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
  image: { alignSelf: 'center' },
});
