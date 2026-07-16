import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame, useLoader } from '@react-three/fiber/native';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { getAsset } from '../../../assets/assetRequireMap';
import type { MascotExpression } from '../../../components/Mascot';
import type { KoiCosmeticSlot } from '../domain';
import {
  KOI_AVATAR_PLACEHOLDER_MANIFEST,
  type KoiAvatarAnimation,
} from '../media';
import {
  getKoiEquippedCosmeticVisuals,
  type KoiEquippedCosmeticVisual,
} from './avatarCosmeticVisuals';

export interface KoiAvatarThreeStageProps {
  equippedCosmeticIds: Partial<Record<KoiCosmeticSlot, string>>;
  expression: MascotExpression;
}

const ANIMATION_BY_EXPRESSION: Record<MascotExpression, KoiAvatarAnimation> = {
  base: 'idle',
  happy: 'idle',
  thinking: 'thinking',
  celebrate: 'celebration',
  encourage: 'encouragement',
};

function material(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.08 });
}

function createCosmeticObject(visual: KoiEquippedCosmeticVisual): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `KoiCosmetic_${visual.id}`;
  if (visual.primitive === 'crest') {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 8), material(visual.color));
    mesh.position.y = 0.12;
    group.add(mesh);
  } else if (visual.primitive === 'glasses') {
    const sharedMaterial = material(visual.color);
    const left = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 18), sharedMaterial);
    const right = left.clone();
    left.position.x = -0.13;
    right.position.x = 0.13;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.025), sharedMaterial);
    group.add(left, right, bridge);
  } else if (visual.primitive === 'pack') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.12), material(visual.color));
    mesh.position.z = -0.04;
    group.add(mesh);
  } else {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.42, 10), material(visual.color));
    mesh.rotation.z = -0.6;
    group.add(mesh);
  }
  return group;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(entry => entry.dispose());
  });
}

function KoiModel({ equippedCosmeticIds, expression }: KoiAvatarThreeStageProps) {
  const asset = getAsset('avatar.koiPlaceholderGlb') as unknown as string;
  const gltf = useLoader(GLTFLoader, asset) as GLTF;
  const scene = React.useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const mixer = React.useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const visuals = React.useMemo(
    () => getKoiEquippedCosmeticVisuals(equippedCosmeticIds),
    [equippedCosmeticIds],
  );

  for (const socket of Object.values(KOI_AVATAR_PLACEHOLDER_MANIFEST.sockets)) {
    if (!scene.getObjectByName(socket)) throw new Error(`Koi avatar is missing ${socket}.`);
  }
  const animationName = KOI_AVATAR_PLACEHOLDER_MANIFEST.animations[ANIMATION_BY_EXPRESSION[expression]];
  const animation = gltf.animations.find(clip => clip.name === animationName);
  if (!animation) throw new Error(`Koi avatar is missing ${animationName}.`);

  React.useEffect(() => {
    const attachments = visuals.map(visual => {
      const socketName = KOI_AVATAR_PLACEHOLDER_MANIFEST.sockets[visual.slot];
      const socket = scene.getObjectByName(socketName)!;
      const object = createCosmeticObject(visual);
      socket.add(object);
      return { socket, object };
    });
    return () => {
      for (const { socket, object } of attachments) {
        socket.remove(object);
        disposeObject(object);
      }
    };
  }, [scene, visuals]);

  React.useEffect(() => {
    const action = mixer.clipAction(animation);
    action.reset().fadeIn(0.15).play();
    return () => {
      action.fadeOut(0.1);
      mixer.stopAllAction();
    };
  }, [animation, mixer]);

  useFrame((_, delta) => mixer.update(Math.min(delta, 0.1)));
  return <primitive object={scene} scale={1.08} />;
}

export function KoiAvatarThreeStage(props: KoiAvatarThreeStageProps) {
  return (
    <View pointerEvents="none" style={styles.container} testID="koi-avatar-glb-canvas">
      <Canvas camera={{ position: [0, 0, 3.2], fov: 38 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[2, 3, 4]} intensity={2.2} />
        <directionalLight position={[-2, -1, 2]} intensity={0.8} />
        <React.Suspense fallback={null}>
          <KoiModel {...props} />
        </React.Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: '100%' },
});
