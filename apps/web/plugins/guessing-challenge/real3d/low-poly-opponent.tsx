'use client';

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

function NameBadge({
  name,
  teamDot,
  testId,
  nameTestId,
}: {
  name: string;
  teamDot: 'blue' | 'red' | 'opponent';
  testId: string;
  nameTestId: string;
}) {
  return (
    <div
      data-testid={testId}
      data-name-anchor="above-head"
      dir="rtl"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.16rem 0.48rem',
        borderRadius: '999px',
        background: 'rgba(15,23,42,0.78)',
        border: '1px solid rgba(255,255,255,0.2)',
        color: '#f8fafc',
        fontWeight: 700,
        fontSize: '0.68rem',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: '0.42rem',
          height: '0.42rem',
          borderRadius: '999px',
          background: DOT_COLORS[teamDot],
          flexShrink: 0,
        }}
      />
      <span data-testid={nameTestId}>{name}</span>
    </div>
  );
}

/**
 * Bean character seated in orange armchair.
 * Name badge is parented to the head bone (not a floating room-space label).
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
    <group position={position} rotation={[0, rotationY, 0]} userData={{ seatFacing: 'forward' }}>
      <OrangeArmchair />

      <group position={[0, 0.4, 0.06]}>
        <BeanCharacter
          teamTint={teamTint}
          lookYaw={lookYaw}
          lookPitch={lookPitch}
          reduceMotion={reduceMotion}
          reachToward={reachToward}
          holdHand={holdHand}
          nameBadge={
            <NameBadge name={name} teamDot={teamDot} testId={testId} nameTestId={nameTestId} />
          }
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
    </group>
  );
}
