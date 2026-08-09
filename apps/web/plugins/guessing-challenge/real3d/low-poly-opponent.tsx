'use client';

import { Html } from '@react-three/drei';
import type { GuessingChallengeVisibleIdentity } from '@wanasatna/shared';
import { resolveIdentityCardText } from '../identity-display';
import { BeanCharacter, type BeanTeamTint } from './bean-character';
import { IdentityCardMesh } from './identity-card-mesh';
import { OrangeArmchair } from './lounge-room';

export type SeatedOpponentProps = {
  name: string;
  identity?: GuessingChallengeVisibleIdentity | null;
  /** When false, character reaches toward external shared card (2v2). */
  holdOwnCard?: boolean;
  teamTint?: BeanTeamTint;
  teamDot?: 'blue' | 'red' | 'opponent';
  lookYaw?: number;
  lookPitch?: number;
  reachToward?: [number, number, number] | null;
  highlight?: boolean;
  labelPrefix?: string;
  reduceMotion?: boolean;
  position?: [number, number, number];
  rotationY?: number;
  testId?: string;
};

const DOT_COLORS: Record<'blue' | 'red' | 'opponent', string> = {
  blue: '#38bdf8',
  red: '#fb7185',
  opponent: '#c4b5fd',
};

/**
 * Bean character seated in orange armchair, holding identity card in hands.
 * Name label sits BELOW the character (not floating above head).
 */
export function LowPolyOpponent({
  name,
  identity = null,
  holdOwnCard = true,
  teamTint = 'opponent',
  teamDot = 'opponent',
  lookYaw = 0,
  lookPitch = 0,
  reachToward = null,
  highlight = false,
  labelPrefix = 'هوية الخصم',
  reduceMotion = false,
  position = [0, 0, -2.55],
  rotationY = 0,
  testId = 'gc-opponent-character',
}: SeatedOpponentProps) {
  const text = resolveIdentityCardText(identity, false);
  const identityKey = identity?.value ?? '';

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <OrangeArmchair />

      <group position={[0, 0.42, 0.08]}>
        <BeanCharacter
          teamTint={teamTint}
          lookYaw={lookYaw}
          lookPitch={lookPitch}
          reduceMotion={reduceMotion}
          reachToward={reachToward}
          holdCard={
            holdOwnCard ? (
              <IdentityCardMesh
                text={text}
                label={labelPrefix}
                highlight={highlight}
                flipKey={identityKey}
                reduceMotion={reduceMotion}
                testId="gc-opponent-identity"
              />
            ) : null
          }
        />
      </group>

      {/* Name below character */}
      <Html
        center
        position={[0, -0.05, 0.35]}
        distanceFactor={6.5}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[8, 0]}
      >
        <div
          data-testid={testId}
          dir="rtl"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            minWidth: '6rem',
            color: '#f8fafc',
            fontWeight: 700,
            fontSize: '0.78rem',
            textShadow: '0 1px 4px rgba(0,0,0,0.55)',
          }}
        >
          <span
            aria-hidden
            style={{
              width: '0.55rem',
              height: '0.55rem',
              borderRadius: '999px',
              background: DOT_COLORS[teamDot],
              boxShadow: `0 0 6px ${DOT_COLORS[teamDot]}`,
              flexShrink: 0,
            }}
          />
          <span data-testid="gc-opponent-name">{name}</span>
        </div>
      </Html>
    </group>
  );
}
