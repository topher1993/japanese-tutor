import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import type { Group } from 'three';

import type { MascotExpression } from '../../../components/Mascot';
import type { KoiCosmeticSlot } from '../domain';
import {
  getKoiEquippedCosmeticVisuals,
  type KoiEquippedCosmeticVisual,
} from './avatarCosmeticVisuals';

export interface KoiAvatarThreeStageProps {
  equippedCosmeticIds: Partial<Record<KoiCosmeticSlot, string>>;
  expression: MascotExpression;
}

type Vector3Tuple = [number, number, number];
type EulerTuple = [number, number, number];

function lerp(start: number, end: number, amount: number): number {
  return start + ((end - start) * amount);
}

const COLORS = Object.freeze({
  outline: '#2D1B2E',
  fur: '#A95F32',
  furDark: '#5C3328',
  furLight: '#D98A4E',
  cream: '#FFF0D0',
  creamShadow: '#E8C68D',
  eye: '#17131A',
  eyeHighlight: '#FFFFFF',
  blush: '#F4938E',
  scarf: '#243B6B',
  scarfLight: '#3D5E9C',
  gold: '#F2C14E',
});

interface SoftSphereProps {
  position?: Vector3Tuple;
  rotation?: EulerTuple;
  scale: Vector3Tuple;
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  name?: string;
}

function SoftSphere({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale,
  color,
  roughness = 0.72,
  metalness = 0.02,
  emissive = '#000000',
  name,
}: SoftSphereProps) {
  return (
    <mesh castShadow receiveShadow name={name} position={position} rotation={rotation} scale={scale}>
      <sphereGeometry args={[1, 16, 10]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissive === '#000000' ? 0 : 0.18}
        metalness={metalness}
        roughness={roughness}
      />
    </mesh>
  );
}

function Ear({ side }: { side: -1 | 1 }) {
  return (
    <group position={[side * 0.53, 0.56, 0.02]} rotation={[0, 0, side * -0.22]}>
      <mesh castShadow>
        <coneGeometry args={[0.31, 0.57, 18]} />
        <meshStandardMaterial color={COLORS.furDark} roughness={0.78} />
      </mesh>
      <mesh position={[0, -0.015, 0.12]} scale={[0.62, 0.64, 0.48]}>
        <coneGeometry args={[0.31, 0.57, 18]} />
        <meshStandardMaterial color={COLORS.creamShadow} roughness={0.82} />
      </mesh>
    </group>
  );
}

function Eye({ side, eyeRef }: { side: -1 | 1; eyeRef: React.RefObject<Group | null> }) {
  return (
    <group ref={eyeRef} position={[side * 0.265, 0.13, 0.595]}>
      <SoftSphere scale={[0.115, 0.145, 0.075]} color={COLORS.eye} roughness={0.25} metalness={0.08} />
      <SoftSphere position={[side * -0.025, 0.045, 0.07]} scale={[0.032, 0.045, 0.025]} color={COLORS.eyeHighlight} roughness={0.08} emissive="#FFFFFF" />
      <SoftSphere position={[side * 0.035, -0.045, 0.067]} scale={[0.014, 0.019, 0.012]} color={COLORS.eyeHighlight} roughness={0.08} />
    </group>
  );
}

function Whiskers() {
  return (
    <group position={[0, -0.13, 0.76]}>
      {([-1, 1] as const).flatMap(side => [-0.055, 0.055].map((offset, index) => (
        <mesh
          key={`${side}-${index}`}
          position={[side * 0.42, offset, 0]}
          rotation={[0, 0, side * (0.16 + (index * 0.08))]}
        >
          <cylinderGeometry args={[0.009, 0.009, 0.42, 6]} />
          <meshBasicMaterial color={COLORS.outline} />
        </mesh>
      )))}
    </group>
  );
}

function CrestEquipment({ visual }: { visual: KoiEquippedCosmeticVisual }) {
  return (
    <group name="Socket_Crest" position={[0, 1.38, 0.02]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.54, 1]}>
        <torusGeometry args={[0.43, 0.055, 8, 24]} />
        <meshStandardMaterial color={visual.color} roughness={0.54} />
      </mesh>
      <SoftSphere position={[0, 0.09, 0.34]} scale={[0.17, 0.17, 0.07]} color={visual.color} roughness={0.45} metalness={0.12} />
      <SoftSphere position={[0, 0.09, 0.405]} scale={[0.075, 0.075, 0.022]} color={COLORS.gold} roughness={0.35} metalness={0.34} />
    </group>
  );
}

function GlassesEquipment({ visual }: { visual: KoiEquippedCosmeticVisual }) {
  return (
    <group name="Socket_Face" position={[0, 0.75, 0.69]}>
      {([-1, 1] as const).map(side => (
        <group key={side} position={[side * 0.27, 0, 0]}>
          <mesh>
            <circleGeometry args={[0.145, 24]} />
            <meshStandardMaterial color="#BDE9FF" opacity={0.2} transparent roughness={0.08} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <torusGeometry args={[0.15, 0.025, 8, 24]} />
            <meshStandardMaterial color={visual.color} metalness={0.22} roughness={0.32} />
          </mesh>
        </group>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 0.15, 8]} />
        <meshStandardMaterial color={visual.color} metalness={0.22} roughness={0.32} />
      </mesh>
    </group>
  );
}

function PackEquipment({ visual }: { visual: KoiEquippedCosmeticVisual }) {
  return (
    <group name="Socket_Back" position={[-0.62, -0.34, -0.22]} rotation={[0.08, -0.18, 0.08]}>
      <SoftSphere scale={[0.34, 0.46, 0.2]} color={visual.color} roughness={0.68} />
      <SoftSphere position={[0, 0.14, 0.18]} scale={[0.23, 0.16, 0.07]} color={COLORS.creamShadow} roughness={0.7} />
      <mesh position={[0, -0.06, 0.22]}>
        <boxGeometry args={[0.25, 0.055, 0.04]} />
        <meshStandardMaterial color={COLORS.gold} metalness={0.25} roughness={0.4} />
      </mesh>
    </group>
  );
}

function ToolEquipment({ visual }: { visual: KoiEquippedCosmeticVisual }) {
  return (
    <group name="Socket_Hand" position={[0.69, -0.47, 0.37]} rotation={[0, 0, -0.58]}>
      <mesh>
        <cylinderGeometry args={[0.045, 0.052, 0.72, 12]} />
        <meshStandardMaterial color={visual.color} roughness={0.56} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.43, 0]}>
        <coneGeometry args={[0.09, 0.24, 14]} />
        <meshStandardMaterial color={COLORS.outline} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.39, 0]}>
        <sphereGeometry args={[0.075, 12, 8]} />
        <meshStandardMaterial color={COLORS.gold} metalness={0.3} roughness={0.36} />
      </mesh>
    </group>
  );
}

function KoiEquipment({ visuals }: { visuals: KoiEquippedCosmeticVisual[] }) {
  return (
    <>
      {visuals.map(visual => {
        if (visual.primitive === 'crest') return <CrestEquipment key={visual.id} visual={visual} />;
        if (visual.primitive === 'glasses') return <GlassesEquipment key={visual.id} visual={visual} />;
        if (visual.primitive === 'pack') return <PackEquipment key={visual.id} visual={visual} />;
        return <ToolEquipment key={visual.id} visual={visual} />;
      })}
    </>
  );
}

function KoiTanukiModel({ equippedCosmeticIds, expression }: KoiAvatarThreeStageProps) {
  const rootRef = React.useRef<Group>(null);
  const headRef = React.useRef<Group>(null);
  const tailRef = React.useRef<Group>(null);
  const leftArmRef = React.useRef<Group>(null);
  const rightArmRef = React.useRef<Group>(null);
  const leftEyeRef = React.useRef<Group>(null);
  const rightEyeRef = React.useRef<Group>(null);
  const visuals = React.useMemo(
    () => getKoiEquippedCosmeticVisuals(equippedCosmeticIds),
    [equippedCosmeticIds],
  );

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const root = rootRef.current;
    const head = headRef.current;
    const tail = tailRef.current;
    const leftArm = leftArmRef.current;
    const rightArm = rightArmRef.current;
    if (!root || !head || !tail || !leftArm || !rightArm) return;

    const celebrate = expression === 'celebrate';
    const thinking = expression === 'thinking';
    const encourage = expression === 'encourage';
    const responsiveness = Math.min(delta, 0.1) * 8;
    root.position.y = -0.05 + (Math.sin(t * 1.55) * 0.035) + (celebrate ? Math.abs(Math.sin(t * 4.5)) * 0.09 : 0);
    root.rotation.y = lerp(root.rotation.y, Math.sin(t * 0.72) * 0.12, responsiveness);
    root.rotation.z = lerp(root.rotation.z, celebrate ? Math.sin(t * 4.5) * 0.055 : 0, responsiveness);
    head.rotation.z = lerp(head.rotation.z, thinking ? -0.13 : encourage ? Math.sin(t * 2.4) * 0.045 : Math.sin(t * 0.9) * 0.018, responsiveness);
    head.rotation.y = lerp(head.rotation.y, thinking ? -0.16 : Math.sin(t * 0.65) * 0.035, responsiveness);
    tail.rotation.z = -0.42 + (Math.sin(t * (celebrate ? 4.2 : 2.1)) * (celebrate ? 0.22 : 0.12));
    leftArm.rotation.z = lerp(leftArm.rotation.z, celebrate ? -2.05 : -0.48, responsiveness);
    rightArm.rotation.z = lerp(rightArm.rotation.z, celebrate ? 2.05 : thinking ? 1.28 : 0.48, responsiveness);

    const blinkCycle = t % 4.4;
    const blinkScale = blinkCycle < 0.14
      ? Math.max(0.08, Math.abs(blinkCycle - 0.07) / 0.07)
      : 1;
    if (leftEyeRef.current) leftEyeRef.current.scale.y = blinkScale;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = blinkScale;
  });

  return (
    <group ref={rootRef} name="KoiRoot" scale={0.83}>
      <group ref={tailRef} position={[0.52, -0.54, -0.28]} rotation={[0.05, -0.18, -0.42]}>
        <SoftSphere position={[0.2, 0.06, 0]} scale={[0.46, 0.28, 0.3]} color={COLORS.furDark} />
        <SoftSphere position={[0.55, 0.24, -0.01]} rotation={[0, 0, 0.4]} scale={[0.43, 0.27, 0.29]} color={COLORS.furLight} />
        <SoftSphere position={[0.84, 0.49, -0.02]} rotation={[0, 0, 0.62]} scale={[0.39, 0.25, 0.27]} color={COLORS.furDark} />
        <SoftSphere position={[1.02, 0.79, -0.03]} rotation={[0, 0, 0.82]} scale={[0.32, 0.23, 0.24]} color={COLORS.creamShadow} />
      </group>

      <group name="KoiBody">
        <SoftSphere position={[0, -0.42, 0]} scale={[0.7, 0.84, 0.52]} color={COLORS.fur} name="KoiBodyMesh" />
        <SoftSphere position={[0, -0.36, 0.47]} scale={[0.43, 0.59, 0.115]} color={COLORS.cream} />
        <group ref={leftArmRef} position={[-0.56, -0.3, 0.18]} rotation={[0, 0, -0.48]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.16, 0.46, 6, 12]} />
            <meshStandardMaterial color={COLORS.furDark} roughness={0.75} />
          </mesh>
          <SoftSphere position={[0, -0.34, 0.02]} scale={[0.19, 0.17, 0.16]} color={COLORS.cream} />
        </group>
        <group ref={rightArmRef} position={[0.56, -0.3, 0.18]} rotation={[0, 0, 0.48]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.16, 0.46, 6, 12]} />
            <meshStandardMaterial color={COLORS.furDark} roughness={0.75} />
          </mesh>
          <SoftSphere position={[0, -0.34, 0.02]} scale={[0.19, 0.17, 0.16]} color={COLORS.cream} />
        </group>
        {([-1, 1] as const).map(side => (
          <group key={side} position={[side * 0.34, -1.05, 0.05]} rotation={[0, 0, side * -0.08]}>
            <mesh castShadow>
              <capsuleGeometry args={[0.21, 0.25, 6, 12]} />
              <meshStandardMaterial color={COLORS.furDark} roughness={0.76} />
            </mesh>
            <SoftSphere position={[side * 0.025, -0.22, 0.15]} scale={[0.27, 0.16, 0.31]} color={COLORS.cream} />
          </group>
        ))}
      </group>

      <group ref={headRef} position={[0, 0.62, 0.08]}>
        <Ear side={-1} />
        <Ear side={1} />
        <SoftSphere scale={[0.76, 0.69, 0.61]} color={COLORS.fur} />
        <SoftSphere position={[-0.28, 0.13, 0.52]} rotation={[0, 0, -0.18]} scale={[0.25, 0.31, 0.095]} color={COLORS.furDark} />
        <SoftSphere position={[0.28, 0.13, 0.52]} rotation={[0, 0, 0.18]} scale={[0.25, 0.31, 0.095]} color={COLORS.furDark} />
        <Eye side={-1} eyeRef={leftEyeRef} />
        <Eye side={1} eyeRef={rightEyeRef} />
        <SoftSphere position={[0, -0.13, 0.59]} scale={[0.34, 0.25, 0.17]} color={COLORS.cream} />
        <SoftSphere position={[0, -0.035, 0.735]} scale={[0.105, 0.075, 0.075]} color={COLORS.eye} roughness={0.25} />
        <mesh position={[0, -0.22, 0.73]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.13, 0.018, 6, 18, Math.PI]} />
          <meshBasicMaterial color={COLORS.outline} />
        </mesh>
        <SoftSphere position={[-0.46, -0.11, 0.54]} scale={[0.12, 0.065, 0.035]} color={COLORS.blush} roughness={0.5} />
        <SoftSphere position={[0.46, -0.11, 0.54]} scale={[0.12, 0.065, 0.035]} color={COLORS.blush} roughness={0.5} />
        <Whiskers />
      </group>

      <group position={[0, 0.05, 0.03]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.44, 0.09, 10, 24]} />
          <meshStandardMaterial color={COLORS.scarf} roughness={0.56} />
        </mesh>
        <SoftSphere position={[0.1, -0.09, 0.5]} scale={[0.15, 0.13, 0.11]} color={COLORS.gold} roughness={0.36} metalness={0.24} />
        <mesh position={[0.19, -0.33, 0.46]} rotation={[0, 0, -0.25]}>
          <coneGeometry args={[0.14, 0.47, 10]} />
          <meshStandardMaterial color={COLORS.scarfLight} roughness={0.62} />
        </mesh>
      </group>

      <KoiEquipment visuals={visuals} />
    </group>
  );
}

export function KoiAvatarThreeStage(props: KoiAvatarThreeStageProps) {
  return (
    <View pointerEvents="none" style={styles.container} testID="koi-avatar-procedural-canvas">
      <Canvas
        camera={{ position: [0, 0.08, 4.7], fov: 31 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <hemisphereLight args={['#FFF5DF', '#28435F', 1.7]} />
        <directionalLight castShadow intensity={2.35} position={[2.5, 3.4, 4.6]} />
        <directionalLight color="#9DDCFF" intensity={0.75} position={[-3, 0.8, 2]} />
        <pointLight color="#FFD48A" intensity={1.25} position={[0, -1.8, 3]} />
        <mesh position={[0, -1.52, -0.44]} scale={[1.2, 0.26, 1]}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial color="#1D4160" opacity={0.2} transparent />
        </mesh>
        <mesh position={[0, 0.03, -0.72]}>
          <torusGeometry args={[1.58, 0.025, 8, 48]} />
          <meshStandardMaterial color="#72C7FF" emissive="#72C7FF" emissiveIntensity={1.5} opacity={0.48} transparent />
        </mesh>
        <React.Suspense fallback={null}>
          <KoiTanukiModel {...props} />
        </React.Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: '100%' },
});
