import { ds } from '../theme/designSystem';

export const appSafeAreaEdges = ['top', 'bottom'] as const;
export const minimumReadableStatusBarGap = ds.spacing.md;

export function createAppShellPadding() {
  return {
    paddingTop: minimumReadableStatusBarGap,
    paddingBottom: 0,
  } as const;
}