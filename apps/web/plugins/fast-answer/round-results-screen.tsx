'use client';

import { useMemo } from 'react';
import type { FastAnswerRoundResultEntry } from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { Button } from '@/components/ui/button';
import { FAST_ANSWER_GAME_ICON, FAST_ANSWER_GAME_NAME } from '@/lib/game/fast-answer-brand';
import { compareByRoundPointsThenName } from '@/lib/game/leaderboard-sort';
import { cn } from '@/lib/utils';

export type FastAnswerRoundResultsScreenProps = {
  revealedAnswer: string;
  timedOut: boolean;
  winnerName: string | null;
  categoryLabel?: string | null;
  roundResults: readonly FastAnswerRoundResultEntry[];
  currentPlayerId: string;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  remainingSeconds?: number;
  totalDurationSeconds?: number;
  continueLabel?: string | null;
  waitingMessage?: string | null;
  isContinueLoading?: boolean;
  onContinue?: () => void;
  className?: string;
};

export function FastAnswerRoundResultsScreen({
  revealedAnswer,
  timedOut,
  winnerName,
  categoryLabel = null,
  roundResults,
  currentPlayerId,
  roundNumber,
  totalRounds,
  roomCode,
  remainingSeconds = 0,
  totalDurationSeconds = 10,
  continueLabel,
  waitingMessage,
  isContinueLoading = false,
  onContinue,
  className,
}: FastAnswerRoundResultsScreenProps) {
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

  const hasWinner = Boolean(winnerName) && !timedOut;
  const progressMax = Math.max(totalDurationSeconds, 1);
  const progressNow = Math.max(0, Math.min(remainingSeconds, totalDurationSeconds));
  const progressPercent = Math.round((progressNow / progressMax) * 100);

  const progressBar = (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-wanas-surface-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={progressMax}
      aria-valuenow={progressNow}
      aria-label={`الانتقال التلقائي ${progressNow} من ${progressMax} ثانية`}
    >
      <div
        className="h-full rounded-full bg-wanas-accent transition-[width] duration-200 ease-linear"
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );

  return (
    <GameScreen ariaLabel="نتائج الجولة" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={FAST_ANSWER_GAME_NAME}
        gameIcon={FAST_ANSWER_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-6 sm:gap-7">
        {categoryLabel ? (
          <p className="text-center text-xs font-medium text-wanas-text-muted sm:text-sm">
            الفئة: {categoryLabel}
          </p>
        ) : null}

        <div
          className={cn(
            'wanas-game-card rounded-[2rem] px-6 py-10 text-center sm:px-10 sm:py-12',
            hasWinner && 'border-wanas-success-border/80 bg-wanas-success-surface',
          )}
        >
          <p
            className={cn(
              'text-xl font-semibold sm:text-2xl',
              hasWinner ? 'text-wanas-success-dark' : 'text-wanas-accent-hover',
            )}
          >
            {hasWinner ? `أسرع إجابة: ${winnerName}` : 'انتهى الوقت'}
          </p>
        </div>

        <div className="wanas-game-card rounded-[2rem] px-5 py-8 text-center sm:px-10 sm:py-12">
          <p className="text-xs font-medium tracking-wide text-wanas-text-muted">الإجابة الصحيحة</p>
          <p className="mt-4 break-words text-3xl font-bold leading-tight tracking-tight text-wanas-text-primary min-[360px]:text-4xl sm:text-5xl">
            {revealedAnswer}
          </p>
        </div>

        <GameCard className="p-5 sm:p-6">
          <h2 className="wanas-game-title mb-4">نقاط الجولة</h2>
          <ul className="space-y-2.5">
            {sortedRoundResults.map((player) => {
              const colors = getPlayerAvatarColors(player.playerId);
              const isCurrent = player.playerId === currentPlayerId;

              return (
                <li
                  key={player.playerId}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5',
                    isCurrent && 'bg-wanas-accent/10',
                    player.isWinner && 'ring-1 ring-wanas-success-border/60',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        colors.bg,
                        colors.text,
                      )}
                    >
                      {player.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-wanas-text-primary">
                        {player.name}
                        {isCurrent ? ' (أنت)' : ''}
                      </p>
                      <p className="text-xs text-wanas-text-muted">
                        المجموع: {player.totalPoints}
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      'shrink-0 text-sm font-bold tabular-nums',
                      player.roundPoints > 0
                        ? 'text-wanas-success-dark'
                        : 'text-wanas-text-muted',
                    )}
                  >
                    {player.roundPoints > 0 ? `+${player.roundPoints}` : '0'}
                  </p>
                </li>
              );
            })}
          </ul>
        </GameCard>

        {continueLabel && onContinue ? (
          <div className="mx-auto w-full max-w-md space-y-3">
            <p className="text-center text-xs font-medium text-wanas-text-muted sm:text-sm">
              {waitingMessage ?? 'الجولة التالية تبدأ تلقائياً...'}
            </p>
            {progressBar}
            <Button
              size="lg"
              className="w-full min-h-14 focus-visible:ring-offset-4"
              loading={isContinueLoading}
              onClick={onContinue}
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
              {waitingMessage}
            </p>
            {progressBar}
          </div>
        ) : null}
      </div>
    </GameScreen>
  );
}
