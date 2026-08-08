'use client';

import './reveal-impostor-screen.css';
import { GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { Badge } from '@/components/ui/badge';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';

export type RevealImpostorPlayer = {
  id: string;
  name: string;
};

export type RevealImpostorScreenProps = {
  impostorPlayer: RevealImpostorPlayer;
  remainingSeconds: number;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  gameName?: string;
  className?: string;
};

function RevealedImpostorHero({ impostorPlayer }: { impostorPlayer: RevealImpostorPlayer }) {
  const avatarColors = getPlayerAvatarColors(impostorPlayer.id);

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-5 px-1 sm:gap-8">
      <p className="text-center text-xl font-semibold tracking-wide text-wanas-text-secondary sm:text-2xl">
        برا السالفة هو...
      </p>

      <div className="bara-reveal-impostor-card wanas-game-card relative mx-auto w-full max-w-md rounded-[2rem] border-2 border-wanas-error-border px-5 py-8 text-center sm:px-10 sm:py-12">
        <div className="flex flex-col items-center gap-5">
          <div
            className="flex size-28 items-center justify-center rounded-full text-4xl font-semibold shadow-[var(--wanas-game-shadow)] ring-4 ring-[color:var(--wanas-game-card-border)] sm:size-32 sm:text-5xl"
            style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
            role="img"
            aria-label={`صورة ${impostorPlayer.name}`}
          >
            {impostorPlayer.name.charAt(0)}
          </div>

          <div className="w-full max-w-[16rem] sm:max-w-xs">
            <h2 className="truncate text-3xl font-bold text-wanas-text-primary sm:text-4xl">
              {impostorPlayer.name}
            </h2>
          </div>

          <Badge variant="impostor" className="px-4 py-1.5 text-sm" />
        </div>
      </div>

      <p className="max-w-sm text-center wanas-game-helper sm:text-base">
        استعدوا، الآن سيحاول تخمين الكلمة.
      </p>
    </div>
  );
}

export function RevealImpostorScreen({
  impostorPlayer,
  remainingSeconds,
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
        timer={{ remainingSeconds, format: 'seconds', lowTimeThreshold: 2 }}
      />

      <RevealedImpostorHero key={impostorPlayer.id} impostorPlayer={impostorPlayer} />
    </GameScreen>
  );
}
