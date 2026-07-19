import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { getKoiEquippedCosmeticVisuals } from '../src/features/koi-sensei/ui/avatarCosmeticVisuals';

describe('Koi avatar renderer integration', () => {
  it('maps equipped catalog items to their exact cosmetic sockets', () => {
    expect(getKoiEquippedCosmeticVisuals({
      crest: 'mastery-n5-vocabulary-sakura-pin',
      face: 'starter-sunset-shades',
      back: 'mastery-n4-phrases-koinobori-banner',
      hand: 'mastery-n1-quizzes-golden-pointer',
    })).toMatchObject([
      { slot: 'back', primitive: 'pack', label: 'Festival Banner' },
      { slot: 'crest', primitive: 'crest', label: 'Sakura Pin' },
      { slot: 'face', primitive: 'glasses', label: 'Sunset Shades' },
      { slot: 'hand', primitive: 'tool', label: 'Golden Pointer' },
    ]);
  });

  it('ignores unknown and wrong-slot persisted cosmetic identifiers', () => {
    expect(getKoiEquippedCosmeticVisuals({
      crest: 'starter-sunset-shades',
      hand: 'not-in-the-catalog',
    })).toEqual([]);
  });

  it('ships only the animated tanuki renderer while retaining the safe render plan', () => {
    const screen = readFileSync('src/features/koi-sensei/ui/KoiSenseiScreen.tsx', 'utf8');
    const stage = readFileSync('src/features/koi-sensei/ui/KoiAvatarStage.tsx', 'utf8');
    const pet = readFileSync('src/features/koi-sensei/ui/KoiPet.tsx', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
    expect(screen).toContain('<KoiAvatarStage');
    expect(screen).toContain('equippedCosmeticIds=');
    expect(stage).toContain('selectKoiAvatarRenderPlan');
    expect(stage).toContain('KoiAvatarTwoDimensional');
    expect(stage).toContain('Animated.loop');
    expect(stage).toContain("assetStatus: 'missing'");
    expect(stage).toContain("motionDisabled = reducedMotion || avatarMode === '2d'");
    expect(pet).toContain("getAsset('avatar.koiTanukiPng')");
    expect(pet).toContain('magical tanuki virtual pet, never a fish');
    expect(existsSync('src/features/koi-sensei/ui/KoiAvatarThreeStage.tsx')).toBe(false);
    expect(packageJson.dependencies).not.toHaveProperty('@react-three/fiber');
    expect(packageJson.dependencies).not.toHaveProperty('expo-gl');
    expect(packageJson.dependencies).not.toHaveProperty('three');
  });
});
