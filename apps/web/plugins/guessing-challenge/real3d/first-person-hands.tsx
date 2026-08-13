'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { GuessingChallengeVisibleIdentity } from '@wanasatna/shared';
import { IdentityCardMesh } from './identity-card-mesh';

type FirstPersonHandsProps = {
  selfName: string;
  selfHidden: boolean;
  selfIdentity: GuessingChallengeVisibleIdentity | null;
  revealed: boolean;
  selfHighlight?: boolean;
  reduceMotion?: boolean;
};

/**
 * Orange sleeves + white gloves holding the local blank card in camera foreground.
 * Revealed own-identity text is not painted here — Round Results owns that reveal.
 */
export function FirstPersonHands({
  selfName: _selfName,
  selfHidden: _selfHidden,
  selfIdentity: _selfIdentity,
  revealed: _revealed,
  selfHighlight: _selfHighlight = false,
  reduceMotion = false,
}: FirstPersonHandsProps) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const bob = useRef(0);

  useFrame((_, delta) => {
    if (!group.current) return;
    // Parent near camera each frame
    group.current.position.copy(camera.position);
    group.current.quaternion.copy(camera.quaternion);

    if (!reduceMotion) {
      bob.current += delta;
      const y = Math.sin(bob.current * 1.4) * 0.008;
      group.current.translateY(y);
    }
  });

  return (
    <group ref={group}>
      {/* Local space in front of camera — slightly lower so it does not dominate */}
      <group position={[0, -0.48, -0.9]} rotation={[-0.12, 0, 0]}>
        {/* Left sleeve + glove */}
        <group position={[0.28, -0.02, 0.05]} rotation={[0.35, 0.25, 0.45]}>
          <mesh position={[0, 0, -0.12]} castShadow>
            <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
            <meshStandardMaterial color="#ea580c" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.02, 0.06]} castShadow>
            <boxGeometry args={[0.13, 0.11, 0.15]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
          {([-0.045, -0.015, 0.015, 0.045] as const).map((fx, i) => (
            <mesh key={i} position={[fx, 0.01, 0.15]}>
              <capsuleGeometry args={[0.016, 0.035, 3, 5]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          ))}
        </group>

        {/* Right sleeve + glove */}
        <group position={[-0.28, -0.02, 0.05]} rotation={[0.35, -0.25, -0.45]}>
          <mesh position={[0, 0, -0.12]} castShadow>
            <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
            <meshStandardMaterial color="#ea580c" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.02, 0.06]} castShadow>
            <boxGeometry args={[0.13, 0.11, 0.15]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
          {([-0.045, -0.015, 0.015, 0.045] as const).map((fx, i) => (
            <mesh key={i} position={[fx, 0.01, 0.15]}>
              <capsuleGeometry args={[0.016, 0.035, 3, 5]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          ))}
        </group>

        {/* Self identity card between hands */}
        <pointLight intensity={0.85} distance={2.2} color="#fff7ed" position={[0, 0.2, 0.35]} />
        <group position={[0, 0.06, 0.1]} rotation={[Math.PI + 0.2, 0, 0]}>
          <IdentityCardMesh
            text=""
            blank
            width={0.42}
            height={0.28}
            flipKey="blank"
            reduceMotion={reduceMotion}
            testId="gc-self-identity"
          />
        </group>
      </group>
    </group>
  );
}
