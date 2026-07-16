import { readFileSync } from 'node:fs';
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
      { slot: 'back', primitive: 'pack', label: 'Koinobori Banner' },
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

  it('wires the bundled GLB, render-plan fallback, animation, and socket attachments into the hub', () => {
    const screen = readFileSync('src/features/koi-sensei/ui/KoiSenseiScreen.tsx', 'utf8');
    const stage = readFileSync('src/features/koi-sensei/ui/KoiAvatarStage.tsx', 'utf8');
    const threeStage = readFileSync('src/features/koi-sensei/ui/KoiAvatarThreeStage.tsx', 'utf8');
    expect(screen).toContain('<KoiAvatarStage');
    expect(screen).toContain('equippedCosmeticIds=');
    expect(stage).toContain('selectKoiAvatarRenderPlan');
    expect(stage).toContain('KoiAvatarTwoDimensional');
    expect(threeStage).toContain("getAsset('avatar.koiPlaceholderGlb')");
    expect(threeStage).toContain('new THREE.AnimationMixer');
    expect(threeStage).toContain('scene.getObjectByName(socketName)');
    expect(threeStage).toContain('socket.add(object)');
  });
});

