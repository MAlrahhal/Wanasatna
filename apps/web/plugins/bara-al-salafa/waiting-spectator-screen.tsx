'use client';

import { GameScreen } from '@/components/game/game-card';
import { SpectatorNotice } from '@/components/room/room-system-state';

export type WaitingSpectatorScreenProps = {
  className?: string;
};

export function WaitingSpectatorScreen({ className }: WaitingSpectatorScreenProps) {
  return (
    <GameScreen ariaLabel="مشاهدة" maxWidth="3xl" className={className}>
      <SpectatorNotice />
    </GameScreen>
  );
}
