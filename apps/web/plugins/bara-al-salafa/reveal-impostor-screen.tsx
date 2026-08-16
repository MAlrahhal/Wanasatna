'use client';

import './reveal-impostor-screen.css';
import { GameScreen } from '@/components/game/game-card';
import { GameHeader, resolveHeaderTimer } from '@/components/game/game-header';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';

export type RevealImpostorPlayer = {
  id: string;
  name: string;
};

export type RevealImpostorScreenProps = {
  impostorPlayer: RevealImpostorPlayer;
  remainingSeconds: number;
  deadlineAtMs?: number | null;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  gameName?: string;
  className?: string;
};

function RevealImpostorContent({ impostorPlayer }: { impostorPlayer: RevealImpostorPlayer }) {
  return (
    <div className="bara-reveal-impostor-card flex w-full min-w-0 flex-col items-center justify-center px-2 py-10 text-center sm:py-14">
      <p className="text-base font-medium text-wanas-text-secondary sm:text-lg">برا السالفة:</p>
      <h2 className="mt-2 max-w-full break-words px-1 pb-1.5 text-3xl font-bold leading-[1.35] text-wanas-text-primary sm:text-4xl md:text-5xl">
        {impostorPlayer.name}
      </h2>
    </div>
  );
}

export function RevealImpostorScreen({
  impostorPlayer,
  remainingSeconds,
  deadlineAtMs,
  roundNumber,
  totalRounds,
  roomCode,
  gameName = 'برا السالفة',
  className,
}: RevealImpostorScreenProps) {
  return (
    <GameScreen ariaLabel="كشف برا السالفة" maxWidth="3xl" className={className}>
      <GameHeader
        gameName={gameName}
        gameIcon={BARA_AL_SALAFA_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="كشف برا السالفة"
        timer={resolveHeaderTimer({
          deadlineAtMs,
          remainingSeconds,
          format: 'seconds',
          lowTimeThreshold: 2,
        })}
      />

      <RevealImpostorContent key={impostorPlayer.id} impostorPlayer={impostorPlayer} />
    </GameScreen>
  );
}
