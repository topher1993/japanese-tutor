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

  it('ships a true animated 3D tanuki with a safe 2D fallback', () => {
    const screen = readFileSync('src/features/koi-sensei/ui/KoiSenseiScreen.tsx', 'utf8');
    const stage = readFileSync('src/features/koi-sensei/ui/KoiAvatarStage.tsx', 'utf8');
    const threeStage = readFileSync('src/features/koi-sensei/ui/KoiAvatarThreeStage.tsx', 'utf8');
    const pet = readFileSync('src/features/koi-sensei/ui/KoiPet.tsx', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
    expect(screen).toContain('<KoiAvatarStage');
    expect(screen).toContain('equippedCosmeticIds=');
    expect(stage).toContain('selectKoiAvatarRenderPlan');
    expect(stage).toContain('KoiAvatarTwoDimensional');
    expect(stage).toContain('LazyKoiAvatarThreeStage');
    expect(stage).toContain('Animated.loop');
    expect(stage).toContain("assetStatus: rendererFailed ? 'failed' : 'ready'");
    expect(stage).toContain('KOI_AVATAR_TANUKI_MANIFEST');
    expect(stage).toContain("motionDisabled = reducedMotion || lowPowerMode || avatarMode === '2d'");
    expect(stage).toContain('let cachedWebGlSupport: boolean | undefined');
    expect(stage).toContain("getExtension('WEBGL_lose_context')?.loseContext()");
    expect(pet).toContain("getAsset('avatar.koiTanukiPng')");
    expect(pet).toContain('magical tanuki virtual pet, never a fish');
    expect(existsSync('src/features/koi-sensei/ui/KoiAvatarThreeStage.tsx')).toBe(true);
    expect(threeStage).toContain("from '@react-three/fiber/native'");
    expect(threeStage).toContain("import type { Group } from 'three'");
    expect(threeStage).not.toContain("import * as THREE from 'three'");
    expect(threeStage).toContain('function KoiTanukiModel');
    expect(threeStage).toContain('blinkCycle');
    expect(threeStage).toContain('name="Socket_Crest"');
    expect(threeStage).toContain('name="Socket_Face"');
    expect(threeStage).toContain('name="Socket_Back"');
    expect(threeStage).toContain('name="Socket_Hand"');
    expect(threeStage).toContain('testID="koi-avatar-procedural-canvas"');
    expect(packageJson.dependencies).toMatchObject({
      '@react-three/fiber': '9.6.1',
      'expo-gl': '16.0.10',
      three: '0.185.1',
    });
  });
});
