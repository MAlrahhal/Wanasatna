'use client';

import { useMemo } from 'react';
import type { DrawGuessRoundResultEntry } from '@wanasatna/shared';
import { DeadlineProgress } from '@/components/game/deadline-progress';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { PlayerAvatar } from '@/components/player/player-avatar';
import { Button } from '@/components/ui/button';
import { DRAW_GUESS_GAME_ICON, DRAW_GUESS_GAME_NAME } from '@/lib/game/draw-guess-brand';
import { compareByRoundPointsThenName } from '@/lib/game/leaderboard-sort';
import { SYSTEM_COPY, presentSystemCopy } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';

export type DrawGuessRoundResultsScreenProps = {
  revealedWord: string;
  guessedCorrectly: boolean;
  correctGuesserName: string | null;
  drawerName: string;
  roundResults: readonly DrawGuessRoundResultEntry[];
  currentPlayerId: string;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  remainingSeconds?: number;
  deadlineAtMs?: number | null;
  totalDurationSeconds?: number;
  continueLabel?: string | null;
  waitingMessage?: string | null;
  isContinueLoading?: boolean;
  onContinue?: () => void;
  className?: string;
};

export function DrawGuessRoundResultsScreen({
  revealedWord,
  guessedCorrectly,
  correctGuesserName,
  drawerName,
  roundResults,
  currentPlayerId,
  roundNumber,
  totalRounds,
  roomCode,
  remainingSeconds = 0,
  deadlineAtMs,
  totalDurationSeconds = 10,
  continueLabel,
  waitingMessage,
  isContinueLoading = false,
  onContinue,
  className,
}: DrawGuessRoundResultsScreenProps) {
  const sortedRoundResults = useMemo(
    () =>
      [...roundResults].sort((left, right) =>
        compareByRoundPointsThenName(
          { roundPoints: left.roundPoints, name: left.name, playerId: left.playerId },
          { roundPoints: right.roundPoints, name: right.name, playerId: right.playerId },
        ),
      ),
    [roundResults],
  );

  return (
    <GameScreen ariaLabel="نتائج الجولة" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={DRAW_GUESS_GAME_NAME}
        gameIcon={DRAW_GUESS_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-4 sm:gap-5">
        <div
          className={cn(
            'wanas-game-card rounded-[1.5rem] px-5 py-5 text-center sm:px-8 sm:py-6',
            guessedCorrectly && 'border-wanas-success-border/80 bg-wanas-success-surface',
          )}
        >
          <p
            className={cn(
              'text-xl font-semibold sm:text-2xl',
              guessedCorrectly ? 'text-wanas-success-dark' : 'text-wanas-accent-hover',
            )}
          >
            {guessedCorrectly ? 'تم تخمين الكلمة!' : 'انتهى الوقت بدون تخمين صحيح'}
          </p>
          <p className="mt-3 wanas-game-helper">
            {guessedCorrectly && correctGuesserName
              ? `${correctGuesserName} خمّن بشكل صحيح`
              : `${drawerName} كان الرسام`}
          </p>
        </div>

        <div className="wanas-game-card rounded-[1.5rem] px-5 py-5 text-center sm:px-8 sm:py-6">
          <p className="text-xs font-medium tracking-wide text-wanas-text-muted">الكلمة كانت</p>
          <p className="mt-2 break-words text-2xl font-bold leading-tight tracking-tight text-wanas-text-primary sm:text-3xl">
            {revealedWord}
          </p>
        </div>

        <GameCard className="p-5 sm:p-6">
          <h2 className="wanas-game-title mb-4">نقاط الجولة</h2>
          <ul className="space-y-2.5">
            {sortedRoundResults.map((player) => {
              const isCurrentPlayer = player.playerId === currentPlayerId;

              return (
                <li
                  key={player.playerId}
                  className={cn(
                    'flex min-w-0 items-center gap-2 rounded-[18px] border px-3 py-3 sm:gap-3 sm:px-3.5',
                    isCurrentPlayer && 'ring-2 ring-wanas-accent/30',
                    player.isDrawer
                      ? 'border-wanas-accent/25 bg-wanas-accent-soft/35'
                      : 'border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)]',
                    player.isCorrectGuesser &&
                      'border-wanas-success-border/70 bg-wanas-success-surface/40',
                  )}
                  aria-current={isCurrentPlayer ? 'true' : undefined}
                >
                  <PlayerAvatar playerId={player.playerId} playerName={player.name} className="size-10 ring-2 ring-[color:var(--wanas-game-card-border)]" sizes="40px" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-wanas-text-primary">
                        {player.name}
                      </p>
                      {isCurrentPlayer ? (
                        <span className="rounded-full bg-wanas-accent px-2 py-0.5 text-xs font-semibold text-white">
                          أنت
                        </span>
                      ) : null}
                      {player.isDrawer ? (
                        <span className="rounded-full border border-wanas-accent/30 px-2 py-0.5 text-[10px] font-semibold text-wanas-accent-hover">
                          الرسام
                        </span>
                      ) : null}
                      {player.isCorrectGuesser ? (
                        <span className="rounded-full border border-wanas-success-border px-2 py-0.5 text-[10px] font-semibold text-wanas-success-dark">
                          خمّن صح
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 text-end sm:gap-3">
                    <div>
                      <p className="text-xs font-medium text-wanas-text-muted">الجولة</p>
                      <p className="font-mono text-sm font-bold tabular-nums text-wanas-success-dark">
                        +{player.roundPoints}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-wanas-text-muted">المجموع</p>
                      <p className="font-mono text-sm font-bold tabular-nums text-wanas-text-primary">
                        {player.totalPoints}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </GameCard>

        {continueLabel && onContinue ? (
          <div className="mx-auto w-full max-w-md space-y-3">
            <p className="text-center text-xs font-medium text-wanas-text-muted sm:text-sm">
              {presentSystemCopy(waitingMessage, SYSTEM_COPY.nextRoundAuto)}
            </p>
            <DeadlineProgress
              deadlineAtMs={deadlineAtMs}
              remainingSeconds={remainingSeconds}
              totalDurationSeconds={totalDurationSeconds}
            />
            <Button
              size="lg"
              className="w-full min-h-14 focus-visible:ring-offset-4"
              onClick={onContinue}
              loading={isContinueLoading}
            >
              {continueLabel}
            </Button>
          </div>
        ) : waitingMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="mx-auto w-full max-w-md space-y-3 rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-5 py-6 text-center shadow-sm"
          >
            <p className="wanas-game-helper font-medium text-wanas-text-secondary">
              {presentSystemCopy(waitingMessage)}
            </p>
            <DeadlineProgress
              deadlineAtMs={deadlineAtMs}
              remainingSeconds={remainingSeconds}
              totalDurationSeconds={totalDurationSeconds}
            />
          </div>
        ) : null}
      </div>
    </GameScreen>
  );
}
