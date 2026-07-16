import { describe, expect, it } from 'vitest';

import { getResponsiveLayout, getShellMaxWidth } from '../src/services/responsiveLayoutService';

describe('responsive tablet landscape layout', () => {
  it('identifies a landscape tablet from both dimensions', () => {
    expect(getResponsiveLayout(1180, 820)).toEqual({ isTablet: true, isTabletLandscape: true });
  });

  it('keeps a portrait tablet in the focused portrait layout', () => {
    expect(getResponsiveLayout(820, 1180)).toEqual({ isTablet: true, isTabletLandscape: false });
    expect(getShellMaxWidth(820, 1180)).toBe(480);
  });

  it('does not mistake a phone in landscape for a tablet', () => {
    expect(getResponsiveLayout(780, 390)).toEqual({ isTablet: false, isTabletLandscape: false });
    expect(getShellMaxWidth(780, 390)).toBeUndefined();
  });

  it('gives landscape tablets the full canvas for the two-pane layout', () => {
    expect(getShellMaxWidth(1180, 820)).toBeUndefined();
  });
});
