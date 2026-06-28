import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

/**
 * Phase JISHO-CORNER — The "Jisho" corner badge on flashcards must:
 * 1. Display the Jisho logo (not just text)
 * 2. Capture the tap itself so the parent card-flip Pressable does NOT fire
 *
 * The original bug: clicking the Jisho link flipped the card instead of
 * opening Jisho.org, because the parent Pressable was receiving the tap.
 *
 * Fix: JishoLink's corner-variant Pressable sets
 *   onStartShouldSetResponder={() => true}
 *   onResponderTerminationRequest={() => false}
 * which claims the touch and refuses to surrender it, preventing the
 * parent Pressable's onPress from firing.
 */
describe('Phase JISHO-CORNER — Jisho corner badge on flashcards', () => {
  it('JishoLink exports a "corner" variant for use on flashcards', () => {
    const src = readFileSync(join(SRC, 'components', 'JishoLink.tsx'), 'utf8');
    expect(src).toMatch(/variant\s*===\s*['"]corner['"]/);
  });

  it('JishoLink corner variant renders the Jisho LOGO image (not just text)', () => {
    const src = readFileSync(join(SRC, 'components', 'JishoLink.tsx'), 'utf8');
    // The corner branch must contain an <Image source={logoSource} ... />
    // before the Jisho text label.
    const cornerIdx = src.indexOf("variant === 'corner'");
    expect(cornerIdx).toBeGreaterThan(-1);
    const cornerBlock = src.slice(cornerIdx, cornerIdx + 1500);
    expect(cornerBlock).toMatch(/<Image[^>]*source=\{logoSource\}/);
  });

  it('JishoLink corner variant claims the responder so the parent Pressable does NOT fire onPress', () => {
    const src = readFileSync(join(SRC, 'components', 'JishoLink.tsx'), 'utf8');
    const cornerIdx = src.indexOf("variant === 'corner'");
    const cornerBlock = src.slice(cornerIdx, cornerIdx + 2000);
    // onStartShouldSetResponder returning true claims the touch
    expect(cornerBlock).toMatch(/onStartShouldSetResponder=\{\(\)\s*=>\s*true\}/);
    // onResponderTerminationRequest returning false REFUSES to surrender the
    // responder to the parent — critical for preventing the card flip
    expect(cornerBlock).toMatch(/onResponderTerminationRequest=\{\(\)\s*=>\s*false\}/);
  });

  it('JishoLink corner variant has a generous hitSlop so it is easy to tap', () => {
    const src = readFileSync(join(SRC, 'components', 'JishoLink.tsx'), 'utf8');
    const cornerIdx = src.indexOf("variant === 'corner'");
    const cornerBlock = src.slice(cornerIdx, cornerIdx + 2000);
    expect(cornerBlock).toMatch(/hitSlop=/);
  });

  it('JishoLink opens the correct jisho.org URL for the Japanese phrase', () => {
    const src = readFileSync(join(SRC, 'components', 'JishoLink.tsx'), 'utf8');
    expect(src).toMatch(/jisho\.org\/search\//);
    expect(src).toMatch(/encodeURIComponent\(japanese\)/);
  });

  it('FlashcardsScreen wires the JishoLink as the FlipCard corner badge', () => {
    const src = readFileSync(join(SRC, 'screens', 'FlashcardsScreen.tsx'), 'utf8');
    expect(src).toMatch(/cornerBadge=\{?\s*<JishoLink/);
  });

  it('FlipCard renders the corner badge slot with pointerEvents="box-none" (slot is transparent to taps)', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    // JSX usage: <View style={styles.cornerBadgeSlot} pointerEvents="box-none">
    // Use a permissive regex (no ^> in middle, allow newlines).
    expect(src).toMatch(/style=\{styles\.cornerBadgeSlot\}[^>]*pointerEvents="box-none"/);
  });
});
