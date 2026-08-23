'use client';

import { useMemo } from 'react';
import type {
  WhoWroteItRevealEntry,
  WhoWroteItRoundResultEntry,
} from '@wanasatna/shared';
import { DeadlineProgress } from '@/components/game/deadline-progress';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { PlayerAvatar } from '@/components/player/player-avatar';
import { Button } from '@/components/ui/button';
import { WHO_WROTE_IT_GAME_ICON, WHO_WROTE_IT_GAME_NAME } from '@/lib/game/who-wrote-it-brand';
import { SYSTEM_COPY, presentSystemCopy } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';

export type WhoWroteItRoundResultsScreenProps = {
  revealEntries: readonly WhoWroteItRevealEntry[];
  roundResults: readonly WhoWroteItRoundResultEntry[];
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

export function WhoWroteItRoundResultsScreen({
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
}: WhoWroteItRoundResultsScreenProps) {
  const sortedResults = useMemo(
    () =>
      [...roundResults].sort((left, right) => {
        if (right.roundPoints !== left.roundPoints) {
          return right.roundPoints - left.roundPoints;
        }
        if (right.correctCount !== left.correctCount) {
          return right.correctCount - left.correctCount;
        }
        return left.name.localeCompare(right.name, 'ar');
      }),
    [roundResults],
  );

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
        gameName={WHO_WROTE_IT_GAME_NAME}
        gameIcon={WHO_WROTE_IT_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-3 sm:gap-4">
        <GameCard className="p-3 sm:p-4">
          <h2 className="mb-2 text-sm font-bold text-wanas-text-primary">من كتب كل إجابة؟</h2>
          <ul className="space-y-1.5">
            {revealEntries.map((entry) => {
              const isOwn = entry.ownerPlayerId === currentPlayerId;

              return (
                <li
                  key={entry.answerId}
                  className="rounded-lg border border-wanas-border bg-wanas-surface-soft px-3 py-2"
                >
                  <p className="break-words text-sm font-semibold leading-snug text-wanas-text-primary">
                    «{entry.text}»
                  </p>
                  <p className="mt-0.5 text-xs text-wanas-text-muted">
                    كتبها:{' '}
                    <span className="font-semibold text-wanas-text-primary">{entry.ownerName}</span>
                  </p>
                  {isOwn ? null : (
                    <p className="text-xs">
                      تخمينك:{' '}
                      <span
                        className={cn(
                          'font-semibold',
                          entry.isCorrect ? 'text-wanas-success-dark' : 'text-destructive',
                        )}
                      >
                        {entry.guessedOwnerName ?? '—'} {entry.isCorrect ? '✓' : '✕'}
                      </span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </GameCard>

        <GameCard className="p-3 sm:p-4">
          <h2 className="mb-2 text-sm font-bold text-wanas-text-primary">نقاط الجولة</h2>
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
                    <PlayerAvatar playerId={player.playerId} playerName={player.name} className="size-7" sizes="28px" />
                    <p className="truncate text-sm font-semibold text-wanas-text-primary">
                      {player.name}
                      {isCurrent ? ' (أنت)' : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs tabular-nums text-wanas-text-muted">
                    {player.correctCount} صحيحة
                  </p>
                  <p
                    className={cn(
                      'min-w-12 shrink-0 text-end text-sm font-bold tabular-nums',
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
