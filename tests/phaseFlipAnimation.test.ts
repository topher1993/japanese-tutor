import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

describe('Phase FLIP-ANIM — Flashcard has a real 3D flip animation', () => {
  it('FlipCard imports react-native-reanimated', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toContain("from 'react-native-reanimated'");
  });

  it('FlipCard imports expo-haptics (for flip feedback)', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toContain("from 'expo-haptics'");
  });

  it('FlipCard uses useSharedValue for the rotation state', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toContain('useSharedValue');
  });

  it('FlipCard uses useAnimatedStyle for the front face', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toContain('useAnimatedStyle');
  });

  it('FlipCard rotates on the Y axis (3D flip, not 2D)', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toContain('rotateY');
    expect(src).toContain('perspective');
  });

  it('FlipCard uses spring-based timing (natural motion, not linear)', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toContain('withSpring');
    // Not just withTiming (which would feel robotic)
    expect(src).not.toMatch(/flip\.value\s*=\s*withTiming/);
  });

  it('FlipCard hides the back face mid-flip via opacity (no mirrored text)', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    // Front face: opacity = 1 when flip < 90, else 0
    expect(src).toMatch(/const\s+opacity\s*=\s*flip\.value\s*<\s*90\s*\?\s*1\s*:\s*0/);
    // Back face: opacity = 1 when flip >= 90, else 0
    expect(src).toMatch(/const\s+opacity\s*=\s*flip\.value\s*>=\s*90\s*\?\s*1\s*:\s*0/);
  });

  it('FlipCard uses backface-visibility to hide mirrored text at 90°', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toContain('backfaceVisibility');
  });

  it('RatingButtons has tiered haptic feedback (Again > Hard > Good > Easy)', () => {
    const src = readFileSync(join(SRC, 'components', 'RatingButtons.tsx'), 'utf8');
    // Each rating has a different haptic intensity
    expect(src).toContain('Haptics.notificationAsync'); // for Again (heavy/error)
    expect(src).toContain('Haptics.impactAsync');        // for Hard/Good
    expect(src).toContain('Haptics.selectionAsync');     // for Easy (soft)
  });

  it('app.json has expo-haptics plugin or auto-detected (no plugin needed in SDK 54)', () => {
    // Expo SDK 54 auto-detects expo-haptics — no plugin entry required.
    // We assert the package is installed and importable.
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.dependencies['expo-haptics']).toBeDefined();
  });

  it('package.json has react-native-reanimated installed', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.dependencies['react-native-reanimated']).toBeDefined();
  });

  it('FlashcardsScreen passes key={card.id} to FlipCard so it resets to front on card change', () => {
    // Without a key, the flip shared value persists across card changes
    // and the new card appears showing its back. The key forces a remount.
    const src = readFileSync(join(SRC, 'screens', 'FlashcardsScreen.tsx'), 'utf8');
    expect(src).toMatch(/<FlipCard[\s\S]{0,200}key=\{card\.id\}/);
  });
});

describe('Phase SWIPE — Flashcard carousel swipe gestures', () => {
  it('FlipCard imports PanResponder from react-native for swipe detection', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toContain("PanResponder");
    expect(src).toMatch(/import\s*\{[^}]*PanResponder[^}]*\}\s*from\s*'react-native'/);
  });

  it('FlipCard accepts onSwipeLeft and onSwipeRight props', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toMatch(/onSwipeLeft\?:\s*\(\)\s*=>\s*void/);
    expect(src).toMatch(/onSwipeRight\?:\s*\(\)\s*=>\s*void/);
  });

  it('FlipCard has swipe threshold constants (80px / 0.4 velocity)', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toMatch(/SWIPE_THRESHOLD_PX\s*=\s*80/);
    expect(src).toMatch(/SWIPE_VELOCITY_THRESHOLD\s*=\s*0\.4/);
  });

  it('FlipCard only claims horizontal gestures (dx > dy * 1.2)', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toMatch(/dx\s*>\s*dy\s*\*\s*1\.2/);
  });

  it('FlipCard animates the shell with translateX + rotation (carousel feel)', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    // shellSwipeStyle handles the swipe transform
    expect(src).toContain('shellSwipeStyle');
    expect(src).toMatch(/translateX/);
    expect(src).toMatch(/rotateZ/);
  });

  it('FlipCard flies off-screen on commit then fires the swipe callback', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toMatch(/runOnJS\(fireSwipeLeft\)/);
    expect(src).toMatch(/runOnJS\(fireSwipeRight\)/);
    expect(src).toMatch(/withTiming\(offScreen/);
  });

  it('FlipCard springs back to center when under threshold', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toMatch(/withSpring\(0,\s*\{\s*damping:\s*18/);
  });

  it('FlashcardsScreen wires onSwipeLeft → next card, onSwipeRight → previous', () => {
    const src = readFileSync(join(SRC, 'screens', 'FlashcardsScreen.tsx'), 'utf8');
    expect(src).toMatch(/onSwipeLeft=\{showRandomCard\}/);
    expect(src).toMatch(/onSwipeRight=\{showPreviousCard\}/);
  });

  it('FlipCard accepts swipeInDirection prop for new-card entry animation', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toMatch(/swipeInDirection\?:\s*'left'\s*\|\s*'right'\s*\|\s*null/);
  });

  it('FlipCard initializes entry shared values from swipeInDirection', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toMatch(/entryOpacity\s*=\s*useSharedValue\(swipeInDirection\s*\?\s*0\s*:\s*1\)/);
    expect(src).toMatch(/entryScale\s*=\s*useSharedValue\(swipeInDirection\s*\?\s*0\.92\s*:\s*1\)/);
  });

  it('FlipCard entry animation: starts from opposite side, springs to center', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    // If swiped LEFT → new card enters from RIGHT (+x)
    expect(src).toMatch(/fromX\s*=\s*swipeInDirection\s*===\s*'left'\s*\?\s*420\s*:\s*-420/);
    // Spring back to center
    expect(src).toMatch(/swipeX\.value\s*=\s*withSpring\(0/);
    // Fade in
    expect(src).toMatch(/entryOpacity\.value\s*=\s*withTiming\(1/);
  });

  it('FlipCard locks PanResponder during entry animation', () => {
    const src = readFileSync(join(SRC, 'components', 'FlipCard.tsx'), 'utf8');
    expect(src).toMatch(/entryLockRef\.current\s*=\s*false/);
    expect(src).toMatch(/if\s*\(\s*entryLockRef\.current\s*\)\s*return\s*false/);
  });

  it('FlashcardsScreen tracks incomingDirection state for the carousel entry', () => {
    const src = readFileSync(join(SRC, 'screens', 'FlashcardsScreen.tsx'), 'utf8');
    expect(src).toMatch(/incomingDirection/);
    // Setting it on swipe commit
    expect(src).toMatch(/setIncomingDirection\('left'\)/);
    expect(src).toMatch(/setIncomingDirection\('right'\)/);
    // Passing it to FlipCard
    expect(src).toMatch(/swipeInDirection=\{incomingDirection\}/);
  });
});
