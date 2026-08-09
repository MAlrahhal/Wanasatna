'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GuessingChallengeVisibleIdentity } from '@wanasatna/shared';
import { resolveIdentityCardText } from '../identity-display';

type SpecialCardProps = {
  side: 'left' | 'right';
  variant: 'yellow' | 'red';
  title: string;
  description: string;
  available: boolean;
  disabled: boolean;
  remaining?: number | null;
  onClick?: () => void;
};

function SpecialTableCard({
  side,
  variant,
  title,
  description,
  available,
  disabled,
  remaining = null,
  onClick,
}: SpecialCardProps) {
  const x = side === 'left' ? 0.85 : -0.85;
  const color = variant === 'yellow' ? '#f59e0b' : '#f43f5e';
  const used = !available;

  return (
    <group position={[x, 0.82, 0.55]} rotation={[-0.55, side === 'left' ? 0.15 : -0.15, 0]}>
      <mesh>
        <boxGeometry args={[0.42, 0.58, 0.03]} />
        <meshStandardMaterial
          color={used ? '#475569' : color}
          emissive={used ? '#0f172a' : color}
          emissiveIntensity={used ? 0.05 : 0.22}
          transparent
          opacity={used ? 0.55 : 0.95}
        />
      </mesh>
      <Html
        transform
        position={[0, 0, 0.03]}
        distanceFactor={2.6}
        style={{ pointerEvents: disabled || used ? 'none' : 'auto' }}
      >
        <button
          type="button"
          data-testid={variant === 'yellow' ? 'gc-yellow-card' : 'gc-red-card'}
          data-available={available ? 'true' : 'false'}
          disabled={disabled || used}
          onClick={onClick}
          dir="rtl"
          style={{
            width: '5.6rem',
            minHeight: '4.8rem',
            borderRadius: '0.7rem',
            border: `1px solid ${used ? 'rgba(148,163,184,0.35)' : 'rgba(255,255,255,0.35)'}`,
            background: used ? 'rgba(15,23,42,0.55)' : 'rgba(15,23,42,0.28)',
            color: '#fff',
            textAlign: 'center',
            padding: '0.4rem',
            cursor: disabled || used ? 'not-allowed' : 'pointer',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: '0.6rem', marginTop: 4, opacity: 0.9 }}>
            {used ? 'تم الاستخدام' : description}
          </div>
          {variant === 'yellow' && remaining !== null ? (
            <div
              data-testid="gc-yellow-remaining"
              style={{ fontSize: '0.85rem', marginTop: 6, fontWeight: 800, color: '#fde68a' }}
            >
              {remaining}
            </div>
          ) : null}
        </button>
      </Html>
    </group>
  );
}

type SelfCardProps = {
  selfName: string;
  selfHidden: boolean;
  selfIdentity: GuessingChallengeVisibleIdentity | null;
  revealed: boolean;
  highlight?: boolean;
  reduceMotion?: boolean;
};

function SelfIdentityCard({
  selfName,
  selfHidden,
  selfIdentity,
  revealed,
  highlight = false,
  reduceMotion = false,
}: SelfCardProps) {
  const group = useRef<THREE.Group>(null);
  const target = useRef(revealed ? Math.PI : 0);

  useEffect(() => {
    target.current = revealed ? Math.PI : 0;
    if (reduceMotion && group.current) {
      group.current.rotation.y = target.current;
    }
  }, [revealed, reduceMotion]);

  useFrame((_, delta) => {
    if (!group.current || reduceMotion) return;
    const current = group.current.rotation.y;
    group.current.rotation.y = THREE.MathUtils.damp(current, target.current, 8, delta);
  });

  const frontText = '؟؟؟';
  const backText = resolveIdentityCardText(selfIdentity, false);

  return (
    <group position={[0, 0.95, 0.95]} rotation={[-0.35, 0, 0]}>
      <group ref={group}>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.72, 0.48, 0.03]} />
          <meshStandardMaterial color="#0f172a" emissive="#164e63" emissiveIntensity={0.25} />
        </mesh>
        <Html
          transform
          position={[0, 0, 0.04]}
          distanceFactor={2.4}
          style={{ pointerEvents: 'none', backfaceVisibility: 'hidden' }}
        >
          <div
            data-testid="gc-self-identity"
            data-revealed="false"
            dir="rtl"
            style={{
              width: '6.5rem',
              textAlign: 'center',
              color: '#e2e8f0',
              fontWeight: 800,
            }}
          >
            <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>{selfName} · هويتك</div>
            <div style={{ fontSize: '1.35rem', marginTop: 2 }}>{frontText}</div>
          </div>
        </Html>

        <group position={[0, 0, -0.02]} rotation={[0, Math.PI, 0]}>
          <mesh>
            <boxGeometry args={[0.72, 0.48, 0.03]} />
            <meshStandardMaterial
              color={highlight ? '#14532d' : '#083344'}
              emissive={highlight ? '#166534' : '#0e7490'}
              emissiveIntensity={0.3}
            />
          </mesh>
          <Html
            transform
            position={[0, 0, 0.02]}
            distanceFactor={2.4}
            style={{ pointerEvents: 'none', backfaceVisibility: 'hidden' }}
          >
            <div
              data-testid="gc-self-identity-revealed"
              data-revealed="true"
              dir="rtl"
              style={{
                width: '6.5rem',
                textAlign: 'center',
                color: highlight ? '#dcfce7' : '#ecfeff',
                fontWeight: 800,
              }}
            >
              <div style={{ fontSize: '0.6rem', opacity: 0.75 }}>كنت</div>
              <div style={{ fontSize: '1.1rem', marginTop: 2 }}>
                {selfHidden && !revealed ? frontText : backText}
              </div>
            </div>
          </Html>
        </group>
      </group>
    </group>
  );
}

type TableAndCardsProps = {
  selfName: string;
  selfHidden: boolean;
  selfIdentity: GuessingChallengeVisibleIdentity | null;
  revealed: boolean;
  selfHighlight?: boolean;
  isMyTurn?: boolean;
  showSpecialCards?: boolean;
  yellowAvailable?: boolean;
  redAvailable?: boolean;
  canUseYellow?: boolean;
  canUseRed?: boolean;
  yellowDisabled?: boolean;
  redDisabled?: boolean;
  yellowQuestionsRemaining?: number | null;
  onUseYellow?: () => void;
  onUseRed?: () => void;
  reduceMotion?: boolean;
};

export function TableAndCards({
  selfName,
  selfHidden,
  selfIdentity,
  revealed,
  selfHighlight = false,
  isMyTurn = false,
  showSpecialCards = true,
  yellowAvailable = true,
  redAvailable = true,
  canUseYellow = false,
  canUseRed = false,
  yellowDisabled = true,
  redDisabled = true,
  yellowQuestionsRemaining = null,
  onUseYellow,
  onUseRed,
  reduceMotion = false,
}: TableAndCardsProps) {
  const accent = useMemo(() => (isMyTurn ? '#22d3ee' : '#334155'), [isMyTurn]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.4]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#0b1220" />
      </mesh>

      <mesh position={[0, 1.6, -4.2]} receiveShadow>
        <boxGeometry args={[9, 3.4, 0.2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[-3.2, 1.6, -2]} rotation={[0, Math.PI / 2.4, 0]}>
        <boxGeometry args={[4.5, 3.4, 0.15]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[3.2, 1.6, -2]} rotation={[0, -Math.PI / 2.4, 0]}>
        <boxGeometry args={[4.5, 3.4, 0.15]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      <mesh position={[0, 0.72, -0.35]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.08, 1.55]} />
        <meshStandardMaterial
          color="#1e293b"
          emissive={accent}
          emissiveIntensity={isMyTurn ? 0.18 : 0.04}
        />
      </mesh>
      <mesh position={[0, 0.76, -0.35]}>
        <boxGeometry args={[2.42, 0.015, 1.57]} />
        <meshStandardMaterial color="#083344" emissive="#22d3ee" emissiveIntensity={0.15} />
      </mesh>
      {(
        [
          [-0.95, 0.36, -0.85],
          [0.95, 0.36, -0.85],
          [-0.95, 0.36, 0.15],
          [0.95, 0.36, 0.15],
        ] as const
      ).map((pos, index) => (
        <mesh key={index} position={pos} castShadow>
          <boxGeometry args={[0.1, 0.72, 0.1]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      ))}

      <SelfIdentityCard
        selfName={selfName}
        selfHidden={selfHidden}
        selfIdentity={selfIdentity}
        revealed={revealed}
        highlight={selfHighlight}
        reduceMotion={reduceMotion}
      />

      {showSpecialCards ? (
        <>
          <SpecialTableCard
            side="left"
            variant="yellow"
            title="البطاقة الصفراء"
            description="3 أسئلة متتالية"
            available={yellowAvailable}
            disabled={yellowDisabled || !canUseYellow}
            remaining={yellowQuestionsRemaining}
            onClick={onUseYellow}
          />
          <SpecialTableCard
            side="right"
            variant="red"
            title="البطاقة الحمراء"
            description="غيّر هوية خصمك"
            available={redAvailable}
            disabled={redDisabled || !canUseRed}
            onClick={onUseRed}
          />
        </>
      ) : null}
    </group>
  );
}
