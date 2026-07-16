/**
 * Shared responsive breakpoints for the app shell and tablet layout.
 *
 * The minimum dimension (rather than only the width) is used to identify a
 * tablet. This prevents a phone held sideways from being treated as a tablet
 * just because its landscape width happens to be large enough.
 */
export const TABLET_MIN_DIMENSION = 600;

export interface ResponsiveLayout {
  isTablet: boolean;
  isTabletLandscape: boolean;
}

export function getResponsiveLayout(width: number, height: number): ResponsiveLayout {
  const isTablet = Math.min(width, height) >= TABLET_MIN_DIMENSION;
  return {
    isTablet,
    isTabletLandscape: isTablet && width > height,
  };
}

export function getShellMaxWidth(width: number, height: number): number | undefined {
  const { isTablet, isTabletLandscape } = getResponsiveLayout(width, height);
  // Portrait tablets keep the focused reading column. Landscape tablets use
  // the full canvas so the two-pane layout can breathe.
  return isTablet && !isTabletLandscape ? 480 : undefined;
}
