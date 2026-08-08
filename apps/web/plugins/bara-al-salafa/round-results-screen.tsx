'use client';

import { useMemo } from 'react';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { Button } from '@/components/ui/button';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import { compareByRoundPointsThenName } from '@/lib/game/leaderboard-sort';
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
  showTransitionTimer?: boolean;
  roomCode: string;
  gameName?: string;
  continueLabel?: string | null;
  waitingMessage?: string | null;
  isContinueLoading?: boolean;
  onContinue?: () => void;
  className?: string;
};

function RoundOutcomeHero({
  impostorPlayerName,
  impostorGuessedCorrectly,
}: Pick<RoundResultsScreenProps, 'impostorPlayerName' | 'impostorGuessedCorrectly'>) {
  const succeeded = impostorGuessedCorrectly;

  return (
    <div
      className={cn(
        'wanas-game-card rounded-[2rem] px-6 py-10 text-center sm:px-10 sm:py-12',
        succeeded && 'border-wanas-success-border/80 bg-wanas-success-surface',
        !succeeded && 'border-[color:var(--wanas-game-card-border)]',
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <span
          className={cn(
            'flex size-16 items-center justify-center rounded-full text-3xl sm:size-[4.5rem] sm:text-4xl',
            succeeded ? 'bg-wanas-success/15' : 'bg-wanas-accent/10',
          )}
          aria-hidden
        >
          {succeeded ? '🎯' : '🔍'}
        </span>

        <div className="space-y-2">
          <p
            className={cn(
              'text-xl font-semibold sm:text-2xl',
              succeeded ? 'text-wanas-success-dark' : 'text-wanas-accent-hover',
            )}
          >
            {succeeded ? 'نجح برا السالفة في معرفة الكلمة!' : 'تم اكتشاف برا السالفة!'}
          </p>
          <p className="wanas-game-helper">
            {impostorPlayerName}{' '}
            <span className="font-medium text-wanas-text-secondary">كان برا السالفة</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function RevealedWordCard({ revealedWord }: Pick<RoundResultsScreenProps, 'revealedWord'>) {
  return (
    <div className="wanas-game-card rounded-[2rem] px-5 py-8 text-center sm:px-10 sm:py-12">
      <div>
        <p className="text-xs font-medium tracking-wide text-wanas-text-muted">الكلمة كانت</p>
        <p className="mt-4 break-words text-3xl font-bold leading-tight tracking-tight text-wanas-text-primary min-[360px]:text-4xl sm:text-5xl md:text-[3.25rem]">
          {revealedWord}
        </p>
      </div>
    </div>
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
          const avatarColors = getPlayerAvatarColors(player.id);
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
                isTopScorer && !player.isImpostor && 'border-wanas-warning-border/70 bg-wanas-warning-surface/40',
              )}
              aria-current={isCurrentPlayer ? 'true' : undefined}
            >
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-[color:var(--wanas-game-card-border)]"
                style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
                aria-hidden
              >
                {player.name.charAt(0)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-wanas-text-primary">{player.name}</p>
                  {isCurrentPlayer ? (
                    <span className="rounded-full bg-wanas-accent px-2 py-0.5 text-[10px] font-semibold text-white">
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
                  <p className="text-[10px] font-medium text-wanas-text-muted">الجولة</p>
                  <p className="font-mono text-sm font-bold tabular-nums text-wanas-success-dark">
                    +{player.roundPoints}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-wanas-text-muted">المجموع</p>
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
}: Pick<
  RoundResultsScreenProps,
  'continueLabel' | 'waitingMessage' | 'isContinueLoading' | 'onContinue'
>) {
  if (continueLabel && onContinue) {
    return (
      <div className="mx-auto w-full max-w-md">
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

  if (waitingMessage) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto w-full max-w-md rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-5 py-6 text-center shadow-sm"
      >
        <p className="wanas-game-helper font-medium text-wanas-text-secondary">{waitingMessage}</p>
      </div>
    );
  }

  return null;
}

export function RoundResultsScreen({
  revealedWord,
  impostorPlayerName,
  impostorGuessedCorrectly,
  roundResults,
  currentPlayerId,
  roundNumber,
  totalRounds,
  remainingSeconds = 0,
  showTransitionTimer = false,
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
        timer={
          showTransitionTimer
            ? { remainingSeconds, format: 'seconds' }
            : undefined
        }
      />

      <div className="flex flex-col gap-6 sm:gap-7">
        <RoundOutcomeHero
          impostorPlayerName={impostorPlayerName}
          impostorGuessedCorrectly={impostorGuessedCorrectly}
        />

        <RevealedWordCard revealedWord={revealedWord} />

        <RoundPointsList roundResults={roundResults} currentPlayerId={currentPlayerId} />

        <RoundTransitionFooter
          continueLabel={continueLabel}
          waitingMessage={waitingMessage}
          isContinueLoading={isContinueLoading}
          onContinue={onContinue}
        />
      </div>
    </GameScreen>
  );
}
