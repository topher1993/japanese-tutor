import { describe, expect, it } from 'vitest';

import {
  appSafeAreaEdges,
  createAppShellPadding,
  minimumReadableStatusBarGap,
} from '../src/services/appSafeAreaLayoutService';

describe('Phase 12 safe-area UI polish', () => {
  it('protects both the phone status bar and bottom home/navigation area', () => {
    expect(appSafeAreaEdges).toEqual(['top', 'bottom']);
  });

  it('adds a readable gap below the native status bar before screen titles begin', () => {
    expect(minimumReadableStatusBarGap).toBeGreaterThanOrEqual(16);
    expect(createAppShellPadding()).toMatchObject({
      paddingTop: minimumReadableStatusBarGap,
      paddingBottom: 0,
    });
  });
});
