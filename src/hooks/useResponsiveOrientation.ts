import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

import { getResponsiveLayout } from '../services/responsiveLayoutService';

/**
 * Keep phones portrait while allowing tablet-sized devices to use landscape.
 *
 * The smallest window dimension is the tablet signal, so a phone in landscape
 * is still locked back to portrait. Web is intentionally excluded because the
 * browser viewport should remain user-controlled during responsive testing.
 */
export function useResponsiveOrientation(): void {
  const { width, height } = useWindowDimensions();
  const { isTablet } = getResponsiveLayout(width, height);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const lock = isTablet
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : ScreenOrientation.OrientationLock.PORTRAIT;

    void ScreenOrientation.lockAsync(lock).catch(() => {
      // Some desktop/foldable environments do not expose orientation locks.
      // Layout still responds to the measured window dimensions in that case.
    });
  }, [isTablet]);
}
