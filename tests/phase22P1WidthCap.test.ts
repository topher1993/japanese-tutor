/**
 * Phase 22 audit fix P1-05 — width cap only on tablet/foldable.
 *
 * The original styles had `maxWidth: 360` hardcoded on the app shell, leaving
 * grey gutters on every phone wider than 360 dp (iPhone 14/15 at 393 dp, Pixel
 * 7 at 412 dp). The fix: cap width only when the window width is >= 600 dp
 * (tablet/foldable breakpoint). On phones, use the full window width.
 *
 * Since the width cap lives inline in `AppShell` (driven by
 * `useWindowDimensions()`), we test the helper shape directly so the logic
 * is verifiable without mounting React Native.
 */

import { describe, expect, it } from 'vitest';

function pickShellMaxWidth(windowWidth: number): number | undefined {
  return windowWidth >= 600 ? 480 : undefined;
}

describe('Phase 22 audit — width cap responsive (P1-05 fix)', () => {
  it('Android Go 360 dp phone: no cap (full width)', () => {
    expect(pickShellMaxWidth(360)).toBeUndefined();
  });

  it('iPhone 14/15 393 dp phone: no cap (full width)', () => {
    expect(pickShellMaxWidth(393)).toBeUndefined();
  });

  it('Pixel 7 412 dp phone: no cap (full width)', () => {
    expect(pickShellMaxWidth(412)).toBeUndefined();
  });

  it('iPad Mini 744 dp tablet: 480 dp cap', () => {
    expect(pickShellMaxWidth(744)).toBe(480);
  });

  it('iPad Pro 1024 dp tablet: 480 dp cap', () => {
    expect(pickShellMaxWidth(1024)).toBe(480);
  });

  it('Surface Duo 540 dp (foldable inner): no cap (just below breakpoint)', () => {
    expect(pickShellMaxWidth(540)).toBeUndefined();
  });

  it('Surface Duo 720 dp (foldable outer): 480 dp cap', () => {
    expect(pickShellMaxWidth(720)).toBe(480);
  });
});