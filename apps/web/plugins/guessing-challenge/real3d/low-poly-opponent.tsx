'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import type { GuessingChallengeVisibleIdentity } from '@wanasatna/shared';
import { resolveIdentityCardText } from '../identity-display';

type LowPolyOpponentProps = {
  name: string;
  identity: GuessingChallengeVisibleIdentity | null;
  highlight?: boolean;
  labelPrefix?: string;
  reduceMotion?: boolean;
};

/**
 * Seated low-poly opponent + chair. Identity text via Drei Html for Arabic.
 */
export function LowPolyOpponent({
  name,
  identity,
  highlight = false,
  labelPrefix = 'هوية الخصم',
  reduceMotion = false,
}: LowPolyOpponentProps) {
  const text = resolveIdentityCardText(identity, false);
  const identityKey = identity?.value ?? '';
  const cardGroup = useRef<Group>(null);
  const flipProgress = useRef(1); // 1 = idle/done, 0..1 during animation
  const prevKey = useRef(identityKey);

  useEffect(() => {
    if (prevKey.current && prevKey.current !== identityKey) {
      flipProgress.current = reduceMotion ? 1 : 0;
      if (cardGroup.current && reduceMotion) {
        cardGroup.current.rotation.y = 0;
      }
    }
    prevKey.current = identityKey;
  }, [identityKey, reduceMotion]);

  useFrame((_, delta) => {
    if (!cardGroup.current || reduceMotion || flipProgress.current >= 1) return;
    flipProgress.current = Math.min(1, flipProgress.current + delta * 2.4);
    cardGroup.current.rotation.y = flipProgress.current * Math.PI * 2;
    if (flipProgress.current >= 1) {
      cardGroup.current.rotation.y = 0;
    }
  });

  return (
    <group position={[0, 0, -2.55]}>
      {/* Chair */}
      <mesh position={[0, 0.35, 0.05]} castShadow>
        <boxGeometry args={[0.72, 0.08, 0.72]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 0.78, -0.28]} castShadow>
        <boxGeometry args={[0.72, 0.78, 0.1]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {(
        [
          [-0.28, 0.16, -0.28],
          [0.28, 0.16, -0.28],
          [-0.28, 0.16, 0.28],
          [0.28, 0.16, 0.28],
        ] as const
      ).map((pos, index) => (
        <mesh key={index} position={pos}>
          <boxGeometry args={[0.08, 0.32, 0.08]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      ))}

      {/* Seated low-poly body */}
      <group position={[0, 0.55, 0.05]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.42, 0.55, 0.28]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[0, 1.0, 0.02]} castShadow>
          <boxGeometry args={[0.34, 0.34, 0.34]} />
          <meshStandardMaterial color="#7dd3fc" />
        </mesh>
        <mesh position={[-0.28, 0.45, 0.18]}>
          <boxGeometry args={[0.14, 0.14, 0.42]} />
          <meshStandardMaterial color="#0ea5e9" />
        </mesh>
        <mesh position={[0.28, 0.45, 0.18]}>
          <boxGeometry args={[0.14, 0.14, 0.42]} />
          <meshStandardMaterial color="#0ea5e9" />
        </mesh>
        <mesh position={[-0.12, 0.12, 0.22]}>
          <boxGeometry args={[0.16, 0.28, 0.36]} />
          <meshStandardMaterial color="#1e3a5f" />
        </mesh>
        <mesh position={[0.12, 0.12, 0.22]}>
          <boxGeometry args={[0.16, 0.28, 0.36]} />
          <meshStandardMaterial color="#1e3a5f" />
        </mesh>
      </group>

      {/* Identity card above head */}
      <group position={[0, 2.05, 0.05]} ref={cardGroup}>
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.62, 0.04]} />
          <meshStandardMaterial
            color={highlight ? '#14532d' : '#0f172a'}
            emissive={highlight ? '#166534' : '#083344'}
            emissiveIntensity={0.35}
          />
        </mesh>
        <mesh position={[0, 0, 0.025]}>
          <boxGeometry args={[0.98, 0.55, 0.01]} />
          <meshStandardMaterial color={highlight ? '#bbf7d0' : '#164e63'} />
        </mesh>
        <Html
          center
          distanceFactor={4.2}
          position={[0, 0, 0.06]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          zIndexRange={[20, 0]}
        >
          <div
            data-testid="gc-opponent-identity"
            data-identity-key={identityKey}
            dir="rtl"
            style={{
              minWidth: '7.5rem',
              textAlign: 'center',
              color: highlight ? '#14532d' : '#ecfeff',
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            <div style={{ fontSize: '0.65rem', opacity: 0.75, fontWeight: 600 }}>{labelPrefix}</div>
            <div style={{ fontSize: '1.15rem', marginTop: 2 }}>{text}</div>
            <div style={{ fontSize: '0.72rem', marginTop: 4, opacity: 0.9 }}>{name}</div>
          </div>
        </Html>
      </group>
    </group>
  );
}
