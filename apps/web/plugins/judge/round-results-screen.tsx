'use client';

import { useMemo } from 'react';
import { ResultsAdPlacement } from '@/components/ads/results-ad-placement';
import type { JudgeRevealEntry, JudgeRoundResultEntry } from '@wanasatna/shared';
import { DeadlineProgress } from '@/components/game/deadline-progress';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { PlayerAvatar } from '@/components/player/player-avatar';
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
  deadlineAtMs?: number | null;
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
  deadlineAtMs,
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
  const progressBar = (
    <DeadlineProgress
      deadlineAtMs={deadlineAtMs}
      remainingSeconds={remainingSeconds}
      totalDurationSeconds={totalDurationSeconds}
    />
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
          <div className="border-wanas-success-border/80 bg-wanas-success-surface rounded-[1.25rem] border px-4 py-3">
            <p className="text-wanas-success-dark break-words text-base font-bold leading-snug sm:text-lg">
              🏆 «{winningAnswerText}»
            </p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-wanas-text-primary truncate text-sm font-semibold">{winnerName}</p>
              <p className="text-wanas-success-dark shrink-0 text-sm font-bold tabular-nums">
                +100
              </p>
            </div>
          </div>
        ) : (
          <div className="border-wanas-border rounded-[1.25rem] border bg-[color:var(--wanas-game-card)] px-4 py-3 text-center">
            <p className="text-wanas-text-muted text-sm font-semibold">لا توجد إجابة فائزة</p>
          </div>
        )}

        {otherAnswers.length > 0 ? (
          <GameCard className="p-3 sm:p-4">
            <h2 className="text-wanas-text-primary mb-2 text-sm font-bold">بقية الإجابات</h2>
            <ul className="space-y-1.5">
              {otherAnswers.map((entry) => (
                <li
                  key={entry.answerId}
                  className="border-wanas-border bg-wanas-surface-soft grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border px-3 py-2"
                >
                  <p className="text-wanas-text-primary break-words text-sm font-semibold leading-snug">
                    «{entry.text}»
                  </p>
                  <p className="text-wanas-text-muted shrink-0 pt-0.5 text-xs font-semibold">
                    {entry.ownerName}
                  </p>
                </li>
              ))}
            </ul>
          </GameCard>
        ) : null}

        <GameCard className="p-3 sm:p-4">
          <h2 className="text-wanas-text-primary mb-2 text-sm font-bold">نقاط الجولة</h2>
          <ul className="space-y-1">
            {sortedResults.map((player) => {
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
                    <PlayerAvatar
                      playerId={player.playerId}
                      playerName={player.name}
                      className="size-7"
                      sizes="28px"
                    />
                    <p className="text-wanas-text-primary truncate text-sm font-semibold">
                      {player.name}
                      {isCurrent ? ' (أنت)' : ''}
                    </p>
                  </div>
                  <p
                    className={cn(
                      'min-w-10 shrink-0 text-end text-sm font-bold tabular-nums',
                      player.roundPoints > 0 ? 'text-wanas-success-dark' : 'text-wanas-text-muted',
                    )}
                  >
                    {player.roundPoints > 0 ? `+${player.roundPoints}` : '0'}
                  </p>
                  <p className="text-wanas-text-muted min-w-10 shrink-0 text-end text-xs tabular-nums">
                    {player.totalPoints}
                  </p>
                </li>
              );
            })}
          </ul>
        </GameCard>

        <ResultsAdPlacement />

        {continueLabel && onContinue ? (
          <div className="mx-auto w-full max-w-md space-y-2.5">
            <p className="text-wanas-text-muted text-center text-xs font-medium sm:text-sm">
              {presentSystemCopy(waitingMessage, SYSTEM_COPY.nextRoundAuto)}
            </p>
            {progressBar}
            <Button
              size="lg"
              className="min-h-12 w-full focus-visible:ring-offset-4"
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
            <p className="text-wanas-text-secondary text-sm font-medium">
              {presentSystemCopy(waitingMessage)}
            </p>
            {progressBar}
          </div>
        ) : null}
      </div>
    </GameScreen>
  );
}
