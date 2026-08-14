'use client';

import { useMemo } from 'react';
import type { JudgeRevealEntry, JudgeRoundResultEntry } from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { Button } from '@/components/ui/button';
import { JUDGE_GAME_ICON, JUDGE_GAME_NAME } from '@/lib/game/judge-brand';
import { SYSTEM_COPY, presentSystemCopy } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';

export type JudgeRoundResultsScreenProps = {
  winningAnswerText: string | null;
  winnerName: string | null;
  revealEntries: readonly JudgeRevealEntry[];
  roundResults: readonly JudgeRoundResultEntry[];
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
};

export function JudgeRoundResultsScreen({
  winningAnswerText,
  winnerName,
  revealEntries,
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
}: JudgeRoundResultsScreenProps) {
  const sortedResults = useMemo(
    () =>
      [...roundResults].sort((left, right) => {
        if (right.roundPoints !== left.roundPoints) {
          return right.roundPoints - left.roundPoints;
        }
        return left.name.localeCompare(right.name, 'ar');
      }),
    [roundResults],
  );

  const otherAnswers = revealEntries.filter((entry) => !entry.isWinner);
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
    <GameScreen ariaLabel="نتائج الجولة" maxWidth="4xl">
      <GameHeader
        gameName={JUDGE_GAME_NAME}
        gameIcon={JUDGE_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-3 sm:gap-4">
        {winningAnswerText && winnerName ? (
          <div className="rounded-[1.25rem] border border-wanas-success-border/80 bg-wanas-success-surface px-4 py-3">
            <p className="break-words text-base font-bold leading-snug text-wanas-success-dark sm:text-lg">
              🏆 «{winningAnswerText}»
            </p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-wanas-text-primary">{winnerName}</p>
              <p className="shrink-0 text-sm font-bold tabular-nums text-wanas-success-dark">
                +100
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-wanas-border bg-[color:var(--wanas-game-card)] px-4 py-3 text-center">
            <p className="text-sm font-semibold text-wanas-text-muted">لا توجد إجابة فائزة</p>
          </div>
        )}

        {otherAnswers.length > 0 ? (
          <GameCard className="p-3 sm:p-4">
            <h2 className="mb-2 text-sm font-bold text-wanas-text-primary">بقية الإجابات</h2>
            <ul className="space-y-1.5">
              {otherAnswers.map((entry) => (
                <li
                  key={entry.answerId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-wanas-border bg-wanas-surface-soft px-3 py-2"
                >
                  <p className="break-words text-sm font-semibold leading-snug text-wanas-text-primary">
                    «{entry.text}»
                  </p>
                  <p className="shrink-0 pt-0.5 text-xs font-semibold text-wanas-text-muted">
                    {entry.ownerName}
                  </p>
                </li>
              ))}
            </ul>
          </GameCard>
        ) : null}

        <GameCard className="p-3 sm:p-4">
          <h2 className="mb-2 text-sm font-bold text-wanas-text-primary">نقاط الجولة</h2>
          <ul className="space-y-1">
            {sortedResults.map((player) => {
              const colors = getPlayerAvatarColors(player.playerId);
              const isCurrent = player.playerId === currentPlayerId;

              return (
                <li
                  key={player.playerId}
                  className={cn(
                    'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5',
                    isCurrent && 'bg-wanas-accent/10',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        colors.bg,
                        colors.text,
                      )}
                    >
                      {player.name.slice(0, 1)}
                    </span>
                    <p className="truncate text-sm font-semibold text-wanas-text-primary">
                      {player.name}
                      {isCurrent ? ' (أنت)' : ''}
                    </p>
                  </div>
                  <p
                    className={cn(
                      'min-w-10 shrink-0 text-end text-sm font-bold tabular-nums',
                      player.roundPoints > 0
                        ? 'text-wanas-success-dark'
                        : 'text-wanas-text-muted',
                    )}
                  >
                    {player.roundPoints > 0 ? `+${player.roundPoints}` : '0'}
                  </p>
                  <p className="min-w-10 shrink-0 text-end text-xs tabular-nums text-wanas-text-muted">
                    {player.totalPoints}
                  </p>
                </li>
              );
            })}
          </ul>
        </GameCard>

        {continueLabel && onContinue ? (
          <div className="mx-auto w-full max-w-md space-y-2.5">
            <p className="text-center text-xs font-medium text-wanas-text-muted sm:text-sm">
              {presentSystemCopy(waitingMessage, SYSTEM_COPY.nextRoundAuto)}
            </p>
            {progressBar}
            <Button
              size="lg"
              className="w-full min-h-12 focus-visible:ring-offset-4"
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
            className="mx-auto w-full max-w-md space-y-2.5 rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-4 py-4 text-center shadow-sm"
          >
            <p className="text-sm font-medium text-wanas-text-secondary">
              {presentSystemCopy(waitingMessage)}
            </p>
            {progressBar}
          </div>
        ) : null}
      </div>
    </GameScreen>
  );
}
