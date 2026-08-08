'use client';

import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import type { LobbyPlayer } from '@/lib/lobby/types';

export type FreeDiscussionScreenProps = {
  players: LobbyPlayer[];
  currentPlayerId: string;
  remainingSeconds: number;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  gameName?: string;
  className?: string;
};

function DiscussionIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 10h8M8 14h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M6 5.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7.5L5 19.5V7.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FreeDiscussionContent() {
  return (
    <GameCard className="px-6 py-10 text-center sm:px-10 sm:py-12">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-wanas-accent-soft text-wanas-primary-dark shadow-sm">
        <DiscussionIcon />
      </div>
      <h2 className="mt-6 text-3xl font-semibold text-wanas-text-primary sm:text-4xl">ناقشوا الإجابات</h2>
      <p className="mt-4 text-lg font-medium text-wanas-text-secondary sm:text-xl">
        يمكن لأي لاعب سؤال أي لاعب.
      </p>
      <p className="mx-auto mt-4 max-w-xl wanas-game-helper sm:text-base">
        تحدثوا مع بعضكم وحاولوا معرفة من هو برا السالفة قبل بدء التصويت.
      </p>
    </GameCard>
  );
}

export function FreeDiscussionScreen({
  players: _players,
  currentPlayerId: _currentPlayerId,
  remainingSeconds,
  roundNumber,
  totalRounds,
  roomCode,
  gameName = 'برا السالفة',
  className,
}: FreeDiscussionScreenProps) {
  return (
    <GameScreen ariaLabel="مرحلة النقاش الحر" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={gameName}
        gameIcon={BARA_AL_SALAFA_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="النقاش الحر"
        timer={{ remainingSeconds, format: 'mm:ss', lowTimeThreshold: 10 }}
      />

      <FreeDiscussionContent />
    </GameScreen>
  );
}
