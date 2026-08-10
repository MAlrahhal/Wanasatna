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
  holdHand?: 'both' | 'left' | 'right';
  highlight?: boolean;
  labelPrefix?: string;
  reduceMotion?: boolean;
  position?: [number, number, number];
  /** World-space body yaw. Keep near 0 so characters face opponents, not camera. */
  rotationY?: number;
  testId?: string;
  nameTestId?: string;
};

const DOT_COLORS: Record<'blue' | 'red' | 'opponent', string> = {
  blue: '#38bdf8',
  red: '#fb7185',
  opponent: '#c4b5fd',
};

/**
 * Bean character seated in orange armchair.
 * Name label is anchored BELOW the seat — never on the identity card.
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
  holdHand = 'both',
  highlight = false,
  labelPrefix = 'هوية الخصم',
  reduceMotion = false,
  position = [0, 0, -2.55],
  rotationY = 0,
  testId = 'gc-opponent-character',
  nameTestId = 'gc-opponent-name',
}: SeatedOpponentProps) {
  const text = resolveIdentityCardText(identity, false);
  const identityKey = identity?.value ?? '';

  return (
    <group position={position} rotation={[0, rotationY, 0]} data-seat-facing="forward">
      <OrangeArmchair />

      <group position={[0, 0.4, 0.06]}>
        <BeanCharacter
          teamTint={teamTint}
          lookYaw={lookYaw}
          lookPitch={lookPitch}
          reduceMotion={reduceMotion}
          reachToward={reachToward}
          holdHand={holdHand}
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

      {/* Fixed name anchor below seat / torso — away from card */}
      <Html
        center
        position={[0, 0.08, 0.62]}
        distanceFactor={7}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[5, 0]}
      >
        <div
          data-testid={testId}
          data-name-anchor="below-seat"
          dir="rtl"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            background: 'rgba(15,23,42,0.72)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#f8fafc',
            fontWeight: 700,
            fontSize: '0.72rem',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            aria-hidden
            style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '999px',
              background: DOT_COLORS[teamDot],
              flexShrink: 0,
            }}
          />
          <span data-testid={nameTestId}>{name}</span>
        </div>
      </Html>
    </group>
  );
}
