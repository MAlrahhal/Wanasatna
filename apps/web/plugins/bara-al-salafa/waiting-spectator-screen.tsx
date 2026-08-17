'use client';

import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader, resolveHeaderTimer } from '@/components/game/game-header';
import { SpectatorNotice } from '@/components/room/room-system-state';
import { BARA_AL_SALAFA_GAME_ICON, BARA_AL_SALAFA_GAME_NAME } from '@/lib/game/bara-al-salafa-brand';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';

export type WaitingSpectatorScreenProps = {
  className?: string;
  civilianWord?: string | null;
  outsiderConcept?: string | null;
  categoryName?: string | null;
  currentRound?: number;
  totalRounds?: number;
  roomCode?: string;
  deadlineAtMs?: number | null;
};

export function WaitingSpectatorScreen({
  className,
  civilianWord,
  outsiderConcept,
  categoryName,
  currentRound,
  totalRounds,
  roomCode,
  deadlineAtMs,
}: WaitingSpectatorScreenProps) {
  const wordsReady = Boolean(civilianWord);

  return (
    <GameScreen ariaLabel="مشاهدة" maxWidth="3xl" className={className}>
      {roomCode ? (
        <GameHeader
          gameName={BARA_AL_SALAFA_GAME_NAME}
          gameIcon={BARA_AL_SALAFA_GAME_ICON}
          roomCode={roomCode}
          currentRound={currentRound}
          totalRounds={totalRounds}
          phaseLabel={SYSTEM_COPY.spectatorTitle}
          timer={
            deadlineAtMs
              ? resolveHeaderTimer({
                  deadlineAtMs,
                  format: 'seconds',
                  lowTimeThreshold: 10,
                })
              : undefined
          }
        />
      ) : null}
      <SpectatorNotice />
      {wordsReady ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <GameCard className="px-4 py-4 text-center sm:px-6">
            <p className="text-xs font-medium text-wanas-text-muted">كلمة اللاعبين</p>
            <p className="mt-2 break-words text-xl font-bold text-wanas-text-primary">{civilianWord}</p>
          </GameCard>
          <GameCard className="px-4 py-4 text-center sm:px-6">
            <p className="text-xs font-medium text-wanas-text-muted">مفهوم برا السالفة</p>
            <p className="mt-2 break-words text-xl font-bold text-wanas-text-primary">
              {outsiderConcept}
            </p>
          </GameCard>
        </div>
      ) : null}
      {categoryName ? (
        <p className="text-center text-xs text-wanas-text-muted">الفئة: {categoryName}</p>
      ) : null}
    </GameScreen>
  );
}
