'use client';

import { useMemo } from 'react';
import { AdPlaceholder } from '@/components/ads/ad-placeholder';
import { DeadlineProgress } from '@/components/game/deadline-progress';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { PlayerAvatar } from '@/components/player/player-avatar';
import { Button } from '@/components/ui/button';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import { compareByRoundPointsThenName } from '@/lib/game/leaderboard-sort';
import { SYSTEM_COPY, presentSystemCopy } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';

export type RoundResultPlayer = {
  id: string;
  name: string;
  roundPoints: number;
  totalPoints: number;
  isImpostor: boolean;
  earnedPoints: boolean;
};

export type RoundResultsScreenProps = {
  revealedWord: string;
  impostorPlayerId: string;
  impostorPlayerName: string;
  impostorGuessedCorrectly: boolean;
  roundResults: readonly RoundResultPlayer[];
  currentPlayerId: string;
  roundNumber: number;
  totalRounds: number;
  remainingSeconds?: number;
  deadlineAtMs?: number | null;
  totalDurationSeconds?: number;
  showTransitionTimer?: boolean;
  roomCode: string;
  gameName?: string;
  continueLabel?: string | null;
  waitingMessage?: string | null;
  isContinueLoading?: boolean;
  onContinue?: () => void;
  className?: string;
};

function RoundSummaryCards({
  revealedWord,
  impostorPlayerName,
}: Pick<RoundResultsScreenProps, 'revealedWord' | 'impostorPlayerName'>) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
      <div className="wanas-game-card flex h-[5.25rem] flex-col items-center justify-center rounded-[1.15rem] px-3 py-3 text-center sm:h-[8.5rem] sm:px-4">
        <p className="text-xs font-medium text-wanas-text-muted">برا السالفة</p>
        <p className="mt-1.5 max-w-full truncate text-base font-bold text-wanas-text-primary sm:text-lg">
          {impostorPlayerName}
        </p>
      </div>
      <div className="wanas-game-card flex h-[5.25rem] flex-col items-center justify-center rounded-[1.15rem] px-3 py-3 text-center sm:h-[8.5rem] sm:px-4">
        <p className="text-xs font-medium text-wanas-text-muted">الكلمة</p>
        <p className="mt-1.5 max-w-full break-words text-base font-bold text-wanas-text-primary sm:text-lg">
          {revealedWord}
        </p>
      </div>
    </div>
  );
}

function RoundTransitionProgressBar({
  remainingSeconds,
  deadlineAtMs,
  totalDurationSeconds,
}: {
  remainingSeconds: number;
  deadlineAtMs?: number | null;
  totalDurationSeconds: number;
}) {
  return (
    <DeadlineProgress
      deadlineAtMs={deadlineAtMs}
      remainingSeconds={remainingSeconds}
      totalDurationSeconds={totalDurationSeconds}
    />
  );
}

function RoundPointsList({
  roundResults,
  currentPlayerId,
}: Pick<RoundResultsScreenProps, 'roundResults' | 'currentPlayerId'>) {
  const sortedRoundResults = useMemo(
    () =>
      [...roundResults].sort((left, right) =>
        compareByRoundPointsThenName(
          { roundPoints: left.roundPoints, name: left.name, playerId: left.id },
          { roundPoints: right.roundPoints, name: right.name, playerId: right.id },
        ),
      ),
    [roundResults],
  );

  const topRoundPoints = sortedRoundResults.reduce(
    (max, player) => Math.max(max, player.roundPoints),
    0,
  );

  return (
    <GameCard className="p-5 sm:p-6">
      <h2 className="wanas-game-title mb-4">نقاط الجولة</h2>
      <ul className="space-y-2.5">
        {sortedRoundResults.map((player) => {
          const isCurrentPlayer = player.id === currentPlayerId;
          const isTopScorer = player.roundPoints === topRoundPoints && topRoundPoints > 0;

          return (
            <li
              key={player.id}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-[18px] border px-3 py-3 sm:gap-3 sm:px-3.5',
                isCurrentPlayer && 'ring-2 ring-wanas-accent/30',
                player.isImpostor
                  ? 'border-wanas-accent/25 bg-wanas-accent-soft/35'
                  : 'border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)]',
                isTopScorer &&
                  !player.isImpostor &&
                  'border-wanas-warning-border/70 bg-wanas-warning-surface/40',
              )}
              aria-current={isCurrentPlayer ? 'true' : undefined}
            >
              <PlayerAvatar playerId={player.id} playerName={player.name} className="size-10 ring-2 ring-[color:var(--wanas-game-card-border)]" sizes="40px" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-wanas-text-primary">{player.name}</p>
                  {isCurrentPlayer ? (
                    <span className="rounded-full bg-wanas-accent px-2 py-0.5 text-xs font-semibold text-white">
                      أنت
                    </span>
                  ) : null}
                  {player.isImpostor ? (
                    <span className="rounded-full border border-wanas-accent/30 px-2 py-0.5 text-[10px] font-semibold text-wanas-accent-hover">
                      برا السالفة
                    </span>
                  ) : null}
                  {isTopScorer ? (
                    <span className="rounded-full border border-wanas-warning-border px-2 py-0.5 text-[10px] font-semibold text-wanas-warning-dark">
                      ⭐ الأعلى
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
  );
}

function RoundTransitionFooter({
  continueLabel,
  waitingMessage,
  isContinueLoading,
  onContinue,
  remainingSeconds,
  deadlineAtMs,
  totalDurationSeconds,
}: Pick<
  RoundResultsScreenProps,
  'continueLabel' | 'waitingMessage' | 'isContinueLoading' | 'onContinue'
> & {
  remainingSeconds: number;
  deadlineAtMs?: number | null;
  totalDurationSeconds: number;
}) {
  const progress = (
    <RoundTransitionProgressBar
      remainingSeconds={remainingSeconds}
      deadlineAtMs={deadlineAtMs}
      totalDurationSeconds={totalDurationSeconds}
    />
  );

  if (continueLabel && onContinue) {
    return (
      <div className="mx-auto w-full max-w-md space-y-3">
        <p className="text-center text-xs font-medium text-wanas-text-muted sm:text-sm">
          {presentSystemCopy(waitingMessage, SYSTEM_COPY.nextRoundAuto)}
        </p>
        {progress}
        <Button
          size="lg"
          className="w-full min-h-14 focus-visible:ring-offset-4"
          onClick={onContinue}
          loading={isContinueLoading}
        >
          {continueLabel}
        </Button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-md space-y-3 rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-5 py-5 text-center shadow-sm"
    >
      <p className="wanas-game-helper font-medium text-wanas-text-secondary">
        {presentSystemCopy(waitingMessage, SYSTEM_COPY.nextRoundAuto)}
      </p>
      {progress}
    </div>
  );
}

export function RoundResultsScreen({
  revealedWord,
  impostorPlayerName,
  roundResults,
  currentPlayerId,
  roundNumber,
  totalRounds,
  remainingSeconds = 0,
  deadlineAtMs,
  totalDurationSeconds = 10,
  roomCode,
  gameName = 'برا السالفة',
  continueLabel,
  waitingMessage,
  isContinueLoading = false,
  onContinue,
  className,
}: RoundResultsScreenProps) {
  return (
    <GameScreen ariaLabel="نتائج الجولة" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={gameName}
        gameIcon={BARA_AL_SALAFA_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-4 sm:gap-5">
        <RoundSummaryCards revealedWord={revealedWord} impostorPlayerName={impostorPlayerName} />

        <RoundPointsList roundResults={roundResults} currentPlayerId={currentPlayerId} />

        <AdPlaceholder placement="round-results" format="horizontal" />

        <RoundTransitionFooter
          continueLabel={continueLabel}
          waitingMessage={waitingMessage}
          isContinueLoading={isContinueLoading}
          onContinue={onContinue}
          remainingSeconds={remainingSeconds}
          deadlineAtMs={deadlineAtMs}
          totalDurationSeconds={totalDurationSeconds}
        />
      </div>
    </GameScreen>
  );
}
