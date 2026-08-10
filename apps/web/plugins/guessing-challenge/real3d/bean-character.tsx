'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

export type BeanTeamTint = 'blue' | 'red' | 'opponent';

export type BeanCharacterProps = {
  teamTint?: BeanTeamTint;
  lookYaw?: number;
  lookPitch?: number;
  holdCard?: ReactNode;
  /** Offset for arm reach toward a shared card (2v2). */
  reachToward?: [number, number, number] | null;
  /** Which hand(s) extend toward the card. */
  holdHand?: 'both' | 'left' | 'right';
  reduceMotion?: boolean;
  scale?: number;
  /** Small name badge parented to the head (world-space via Html). */
  nameBadge?: ReactNode;
};

const TINTS: Record<
  BeanTeamTint,
  { body: string; head: string; sleeve: string; pants: string }
> = {
  blue: {
    body: '#38bdf8',
    head: '#7dd3fc',
    sleeve: '#2563eb',
    pants: '#1e3a5f',
  },
  red: {
    body: '#fb7185',
    head: '#fda4af',
    sleeve: '#e11d48',
    pants: '#7f1d1d',
  },
  opponent: {
    body: '#c4b5fd',
    head: '#ddd6fe',
    sleeve: '#f97316',
    pants: '#5b21b6',
  },
};

/**
 * Rounded procedural party-game bean character — seated, mittens, soft face.
 */
export function BeanCharacter({
  teamTint = 'opponent',
  lookYaw = 0,
  lookPitch = 0,
  holdCard = null,
  reachToward = null,
  holdHand = 'both',
  reduceMotion = false,
  scale = 1,
  nameBadge = null,
}: BeanCharacterProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const breath = useRef(0);
  const colors = useMemo(() => TINTS[teamTint], [teamTint]);
  // Network look: +yaw = look left, +pitch = look up (matches LookControls emit).
  // Bean face is on +Z. +rot.y → turn left; -rot.x → tip back (look up).
  const headYaw = lookYaw * 0.62;
  const headPitch = -lookPitch * 0.45;

  useFrame((_, delta) => {
    if (reduceMotion) {
      if (head.current) {
        head.current.rotation.y = headYaw;
        head.current.rotation.x = headPitch;
      }
      // Body stays mostly forward — only tiny look sway.
      if (body.current) {
        body.current.rotation.y = lookYaw * 0.04;
      }
      return;
    }

    breath.current += delta;
    const inhale = Math.sin(breath.current * 1.6) * 0.012;
    if (root.current) {
      root.current.position.y = inhale;
    }
    if (body.current) {
      body.current.scale.y = 1 + inhale * 0.25;
      body.current.rotation.y = THREE.MathUtils.damp(
        body.current.rotation.y,
        lookYaw * 0.05,
        6,
        delta,
      );
    }
    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.damp(
        head.current.rotation.y,
        headYaw,
        8,
        delta,
      );
      head.current.rotation.x = THREE.MathUtils.damp(
        head.current.rotation.x,
        headPitch,
        8,
        delta,
      );
    }
  });

  const restLeft: [number, number, number] = [-0.2, 0.12, 0.28];
  const restRight: [number, number, number] = [0.2, 0.12, 0.28];
  const reach = reachToward ?? [0, 0.42, 0.42];
  const leftArmTarget: [number, number, number] =
    holdHand === 'right' ? restLeft : holdHand === 'left' ? reach : reachToward ? [reach[0] - 0.08, reach[1], reach[2]] : [-0.22, 0.38, 0.38];
  const rightArmTarget: [number, number, number] =
    holdHand === 'left' ? restRight : holdHand === 'right' ? reach : reachToward ? [reach[0] + 0.08, reach[1], reach[2]] : [0.22, 0.38, 0.38];

  return (
    <group ref={root} scale={scale}>
      {/* Soft shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.05]} receiveShadow>
        <circleGeometry args={[0.38, 24]} />
        <meshStandardMaterial color="#1e1b4b" transparent opacity={0.22} />
      </mesh>

      <group ref={body} position={[0, 0.55, 0]}>
        {/* Capsule-ish torso */}
        <mesh position={[0, 0.32, 0]} castShadow>
          <capsuleGeometry args={[0.28, 0.32, 6, 12]} />
          <meshStandardMaterial color={colors.body} roughness={0.55} />
        </mesh>

        {/* Pants / seated hips */}
        <mesh position={[0, 0.02, 0.06]} castShadow>
          <sphereGeometry args={[0.3, 16, 12]} />
          <meshStandardMaterial color={colors.pants} roughness={0.65} />
        </mesh>

        {/* Stubby legs */}
        <mesh position={[-0.12, -0.18, 0.22]} rotation={[0.55, 0, 0.1]} castShadow>
          <capsuleGeometry args={[0.09, 0.12, 4, 8]} />
          <meshStandardMaterial color={colors.pants} />
        </mesh>
        <mesh position={[0.12, -0.18, 0.22]} rotation={[0.55, 0, -0.1]} castShadow>
          <capsuleGeometry args={[0.09, 0.12, 4, 8]} />
          <meshStandardMaterial color={colors.pants} />
        </mesh>

        {/* Head — name badge parented here (~0.2 above head top) */}
        <group ref={head} position={[0, 0.72, 0.02]}>
          <mesh castShadow>
            <sphereGeometry args={[0.26, 18, 14]} />
            <meshStandardMaterial color={colors.head} roughness={0.5} />
          </mesh>
          {/* Face panel */}
          <mesh position={[0, -0.02, 0.22]}>
            <boxGeometry args={[0.28, 0.18, 0.04]} />
            <meshStandardMaterial color="#1e1b4b" roughness={0.8} />
          </mesh>
          {/* Eyes */}
          <mesh position={[-0.07, 0.01, 0.25]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.07, 0.01, 0.25]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.07, 0.0, 0.3]}>
            <sphereGeometry args={[0.028, 8, 6]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0.07, 0.0, 0.3]}>
            <sphereGeometry args={[0.028, 8, 6]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          {nameBadge ? (
            <Html
              position={[0, 0.22, 0.04]}
              occlude={false}
              zIndexRange={[20, 0]}
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
                direction: 'ltr',
                // Explicit centering — Drei `center` breaks under page dir=rtl.
                transform: 'translate(-50%, -100%)',
                whiteSpace: 'nowrap',
              }}
            >
              {nameBadge}
            </Html>
          ) : null}
        </group>

        {/* Left arm + mitt */}
        <group position={[-0.28, 0.28, 0.05]}>
          <mesh
            position={[
              (leftArmTarget[0] + 0.28) * 0.45,
              (leftArmTarget[1] - 0.28) * 0.35,
              leftArmTarget[2] * 0.35,
            ]}
            rotation={[0.85, 0.35, -0.4]}
            castShadow
          >
            <capsuleGeometry args={[0.07, 0.22, 4, 8]} />
            <meshStandardMaterial color={colors.sleeve} />
          </mesh>
          <mesh position={leftArmTarget} castShadow>
            <boxGeometry args={[0.14, 0.12, 0.16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
          {/* Four stubby fingers */}
          {([-0.05, -0.015, 0.02, 0.055] as const).map((fx, i) => (
            <mesh key={i} position={[leftArmTarget[0] + fx, leftArmTarget[1] - 0.02, leftArmTarget[2] + 0.1]}>
              <capsuleGeometry args={[0.018, 0.04, 3, 6]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          ))}
        </group>

        {/* Right arm + mitt */}
        <group position={[0.28, 0.28, 0.05]}>
          <mesh
            position={[
              (rightArmTarget[0] - 0.28) * 0.45,
              (rightArmTarget[1] - 0.28) * 0.35,
              rightArmTarget[2] * 0.35,
            ]}
            rotation={[0.85, -0.35, 0.4]}
            castShadow
          >
            <capsuleGeometry args={[0.07, 0.22, 4, 8]} />
            <meshStandardMaterial color={colors.sleeve} />
          </mesh>
          <mesh position={rightArmTarget} castShadow>
            <boxGeometry args={[0.14, 0.12, 0.16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
          {([-0.05, -0.015, 0.02, 0.055] as const).map((fx, i) => (
            <mesh
              key={i}
              position={[rightArmTarget[0] + fx, rightArmTarget[1] - 0.02, rightArmTarget[2] + 0.1]}
            >
              <capsuleGeometry args={[0.018, 0.04, 3, 6]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          ))}
        </group>

        {/* Held card between mittens */}
        {holdCard ? (
          <group position={reach as [number, number, number]} rotation={[-0.35, 0, 0]}>
            {holdCard}
          </group>
        ) : null}
      </group>
    </group>
  );
}
