'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

export type IdentityCardMeshProps = {
  text: string;
  label?: string;
  highlight?: boolean;
  width?: number;
  height?: number;
  flipKey?: string;
  reduceMotion?: boolean;
  testId?: string;
  children?: ReactNode;
};

/**
 * Physical white identity card — Arabic text sits ON the card face via Drei Html.
 */
export function IdentityCardMesh({
  text,
  label,
  highlight = false,
  width = 0.55,
  height = 0.38,
  flipKey = '',
  reduceMotion = false,
  testId = 'gc-identity-card-mesh',
  children,
}: IdentityCardMeshProps) {
  const group = useRef<THREE.Group>(null);
  const flipProgress = useRef(1);
  const prevKey = useRef(flipKey);

  useEffect(() => {
    if (prevKey.current && prevKey.current !== flipKey) {
      flipProgress.current = reduceMotion ? 1 : 0;
      if (group.current && reduceMotion) {
        group.current.rotation.y = 0;
      }
    }
    prevKey.current = flipKey;
  }, [flipKey, reduceMotion]);

  useFrame((_, delta) => {
    if (!group.current || reduceMotion || flipProgress.current >= 1) return;
    flipProgress.current = Math.min(1, flipProgress.current + delta * 2.4);
    group.current.rotation.y = flipProgress.current * Math.PI * 2;
    if (flipProgress.current >= 1) {
      group.current.rotation.y = 0;
    }
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <boxGeometry args={[width, height, 0.028]} />
        <meshStandardMaterial
          color={highlight ? '#ecfdf5' : '#f8fafc'}
          emissive={highlight ? '#86efac' : '#e2e8f0'}
          emissiveIntensity={highlight ? 0.18 : 0.04}
          roughness={0.55}
          metalness={0.05}
        />
      </mesh>
      {/* Soft border rim */}
      <mesh position={[0, 0, 0.001]}>
        <boxGeometry args={[width * 0.92, height * 0.88, 0.01]} />
        <meshStandardMaterial color={highlight ? '#d1fae5' : '#f1f5f9'} roughness={0.7} />
      </mesh>
      <Html
        center
        transform
        position={[0, 0, 0.02]}
        distanceFactor={1.85}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[12, 0]}
      >
        <div
          data-testid={testId}
          data-identity-key={flipKey}
          dir="rtl"
          style={{
            width: `${width * 9.2}rem`,
            textAlign: 'center',
            color: highlight ? '#14532d' : '#0f172a',
            fontWeight: 800,
            lineHeight: 1.15,
            pointerEvents: 'none',
          }}
        >
          {label ? (
            <div style={{ fontSize: '0.55rem', opacity: 0.55, fontWeight: 600 }}>{label}</div>
          ) : null}
          <div style={{ fontSize: text === '؟؟؟' ? '1.35rem' : '0.95rem', marginTop: label ? 2 : 0 }}>
            {text}
          </div>
          {children}
        </div>
      </Html>
    </group>
  );
}
